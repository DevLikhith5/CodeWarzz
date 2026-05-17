import db from '../config/db';
import { outboxMessages } from '../db/schema/outbox';
import { eq, lte, asc, and } from 'drizzle-orm';
import { publishToExchange } from '../queues/rabbitmq/publisher';
import logger from '../config/logger.config';

export interface OutboxMessage {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, any>;
    exchange: string;
    routingKey: string;
    maxAttempts?: number;
}

export async function saveOutboxMessage(message: OutboxMessage): Promise<string> {
    const result = await db.insert(outboxMessages).values({
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
    const pendingMessages = await db
        .select()
        .from(outboxMessages)
        .where(
            and(
                eq(outboxMessages.status, 'PENDING'),
                lte(outboxMessages.attempts, outboxMessages.maxAttempts)
            )
        )
        .orderBy(asc(outboxMessages.createdAt))
        .limit(batchSize);

    if (pendingMessages.length === 0) {
        return 0;
    }

    let processed = 0;

    for (const msg of pendingMessages) {
        try {
            await publishToExchange(msg.exchange, msg.routingKey, msg.payload as Record<string, any>, {
                correlationId: msg.aggregateId,
            });

            await db
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
                await db
                    .update(outboxMessages)
                    .set({
                        status: 'FAILED',
                        attempts: newAttempts,
                        updatedAt: new Date(),
                    })
                    .where(eq(outboxMessages.id, msg.id));
            } else {
                await db
                    .update(outboxMessages)
                    .set({
                        attempts: newAttempts,
                        updatedAt: new Date(),
                    })
                    .where(eq(outboxMessages.id, msg.id));
            }
        }
    }

    return processed;
}

export async function getOutboxStats(): Promise<{ pending: number; failed: number; published: number }> {
    const pending = await db
        .select({ count: outboxMessages.id })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'PENDING'));

    const failed = await db
        .select({ count: outboxMessages.id })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'FAILED'));

    const published = await db
        .select({ count: outboxMessages.id })
        .from(outboxMessages)
        .where(eq(outboxMessages.status, 'PUBLISHED'));

    return {
        pending: pending.length,
        failed: failed.length,
        published: published.length,
    };
}
