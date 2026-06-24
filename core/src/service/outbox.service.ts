import db from '../config/db';
import { outboxMessages } from '../db/schema/outbox';
import { eq, lte, asc, and, sql } from 'drizzle-orm';
import { publishToExchange } from '../queues/rabbitmq/publisher';
import logger from '../config/logger.config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface OutboxMessage {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, any>;
    exchange: string;
    routingKey: string;
    maxAttempts?: number;
}

export async function saveOutboxMessage(
    message: OutboxMessage,
    txDb?: NodePgDatabase<any>
): Promise<string> {
    const database = txDb || db;
    const result = await database.insert(outboxMessages).values({
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        eventType: message.eventType,
        payload: message.payload,
        exchange: message.exchange,
        routingKey: message.routingKey,
        maxAttempts: message.maxAttempts || 3,
    }).returning({ id: outboxMessages.id });

    logger.debug(`Outbox message saved`, { id: result[0].id, eventType: message.eventType });
    return result[0].id;
}

export async function processOutboxBatch(batchSize: number = 10): Promise<number> {
    // We use FOR UPDATE SKIP LOCKED inside a transaction so that two
    // concurrent CDC / poller invocations never claim the same row.
    return await db.transaction(async (tx) => {
        const pendingMessages = await tx
            .select()
            .from(outboxMessages)
            .where(
                and(
                    eq(outboxMessages.status, 'PENDING'),
                    lte(outboxMessages.attempts, outboxMessages.maxAttempts)
                )
            )
            .orderBy(asc(outboxMessages.createdAt))
            .limit(batchSize)
            .for('update', { skipLocked: true });

        if (pendingMessages.length === 0) {
            return 0;
        }

        // Mark as IN_FLIGHT within the same transaction. Other workers
        // see this and skip these rows.
        const ids = pendingMessages.map((m) => m.id);
        await tx
            .update(outboxMessages)
            .set({ status: 'IN_FLIGHT', updatedAt: new Date() })
            .where(sql`${outboxMessages.id} = ANY(${ids})`);

        let processed = 0;

        for (const msg of pendingMessages) {
            try {
                await publishToExchange(msg.exchange, msg.routingKey, msg.payload as Record<string, any>, {
                    correlationId: msg.aggregateId,
                });

                await tx
                    .update(outboxMessages)
                    .set({
                        status: 'PUBLISHED',
                        publishedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(outboxMessages.id, msg.id));

                processed++;
            } catch (err: any) {
                logger.error(`Failed to publish outbox message ${msg.id}: ${err.message}`);

                const newAttempts = msg.attempts + 1;

                if (newAttempts >= msg.maxAttempts) {
                    await tx
                        .update(outboxMessages)
                        .set({
                            status: 'FAILED',
                            attempts: newAttempts,
                            updatedAt: new Date(),
                        })
                        .where(eq(outboxMessages.id, msg.id));
                } else {
                    // Revert to PENDING so the next poller (or CDC) can retry
                    await tx
                        .update(outboxMessages)
                        .set({
                            status: 'PENDING',
                            attempts: newAttempts,
                            updatedAt: new Date(),
                        })
                        .where(eq(outboxMessages.id, msg.id));
                }
            }
        }

        return processed;
    });
}

export async function getOutboxStats(): Promise<{ pending: number; failed: number; published: number; inFlight: number }> {
    const [pending] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'PENDING'));
    const [failed] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'FAILED'));
    const [published] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'PUBLISHED'));
    const [inFlight] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'IN_FLIGHT'));

    return {
        pending: Number(pending?.count || 0),
        failed: Number(failed?.count || 0),
        published: Number(published?.count || 0),
        inFlight: Number(inFlight?.count || 0),
    };
}

import { Client } from 'pg';

export async function initializeCDC() {
    try {
        await db.execute(sql`
            CREATE OR REPLACE FUNCTION notify_outbox() RETURNS TRIGGER AS $$
            BEGIN
                PERFORM pg_notify('new_outbox_message', NEW.id::text);
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS outbox_notify_trigger ON outbox_messages;
            CREATE TRIGGER outbox_notify_trigger
            AFTER INSERT ON outbox_messages
            FOR EACH ROW EXECUTE FUNCTION notify_outbox();
        `);
        logger.info("PostgreSQL CDC trigger verified via raw SQL");
    } catch (err: any) {
        logger.error("Failed to initialize PostgreSQL CDC trigger", { error: err.message });
    }
}

const CDC_RECONNECT_DELAY_MS = 5000;
const OUTBOX_POLL_INTERVAL_MS = 30000;
let cdcClient: Client | null = null;
let cdcReconnectTimer: NodeJS.Timeout | null = null;
let outboxPollerTimer: NodeJS.Timeout | null = null;

export async function startCDCListener() {
    const connect = async () => {
        cdcClient = new Client({ connectionString: process.env.DATABASE_URL });
        try {
            await cdcClient.connect();
        } catch (err: any) {
            logger.error("CDC Listener failed to connect", { error: err.message });
            scheduleReconnect();
            return;
        }

        cdcClient.on('notification', async (msg) => {
            if (msg.channel === 'new_outbox_message') {
                try {
                    const processed = await processOutboxBatch(20);
                    if (processed > 0) {
                        logger.info(`CDC Push triggered: Instantly relayed ${processed} messages to RabbitMQ`);
                    }
                } catch (err: any) {
                    logger.error('CDC batch processing failed', { error: err.message });
                }
            }
        });

        cdcClient.on('error', (err) => {
            logger.error('CDC listener connection error', { error: err.message });
            cleanupAndReconnect();
        });

        cdcClient.on('end', () => {
            logger.warn('CDC listener connection ended');
            cleanupAndReconnect();
        });

        try {
            await cdcClient.query("LISTEN new_outbox_message");
            logger.info("PostgreSQL CDC Listener connected to 'new_outbox_message' channel (Zero-Polling mode enabled)");
        } catch (err: any) {
            logger.error('CDC LISTEN failed', { error: err.message });
            cleanupAndReconnect();
        }
    };

    const cleanupAndReconnect = () => {
        if (cdcClient) {
            cdcClient.removeAllListeners();
            cdcClient.end().catch(() => undefined);
            cdcClient = null;
        }
        scheduleReconnect();
    };

    const scheduleReconnect = () => {
        if (cdcReconnectTimer) return;
        cdcReconnectTimer = setTimeout(() => {
            cdcReconnectTimer = null;
            connect().catch((err) => {
                logger.error('CDC reconnect failed', { error: err.message });
                scheduleReconnect();
            });
        }, CDC_RECONNECT_DELAY_MS);
    };

    await connect();
}

export function startOutboxPoller() {
    if (outboxPollerTimer) return;
    outboxPollerTimer = setInterval(async () => {
        try {
            const processed = await processOutboxBatch(20);
            if (processed > 0) {
                logger.info(`Outbox poller relayed ${processed} stuck PENDING messages`);
            }
        } catch (err: any) {
            logger.error('Outbox poller failed', { error: err.message });
        }
    }, OUTBOX_POLL_INTERVAL_MS);
    logger.info(`Outbox poller started (every ${OUTBOX_POLL_INTERVAL_MS / 1000}s)`);
}

export async function stopOutboxPoller() {
    if (outboxPollerTimer) {
        clearInterval(outboxPollerTimer);
        outboxPollerTimer = null;
    }
}

export async function stopCDCListener() {
    if (cdcReconnectTimer) {
        clearTimeout(cdcReconnectTimer);
        cdcReconnectTimer = null;
    }
    if (cdcClient) {
        cdcClient.removeAllListeners();
        await cdcClient.end().catch(() => undefined);
        cdcClient = null;
    }
    await stopOutboxPoller();
}
