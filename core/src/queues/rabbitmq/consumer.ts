import { ConsumeMessage } from 'amqplib';
import { rabbitMQ } from './connection';
import { QUEUES } from './config';
import logger from '../../config/logger.config';

export type MessageHandler = (msg: any, correlationId: string) => Promise<any>;

export interface ConsumerOptions {
    prefetch?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

const DEFAULT_OPTIONS: ConsumerOptions = {
    prefetch: 10,
    maxRetries: 3,
    retryDelayMs: 1000,
};

// Dedicated retry exchanges / queues. Messages published here sit until
// their TTL expires, at which point the broker dead-letters them back to
// the original exchange. This avoids the tight redelivery loop that the
// previous "publish back to the same exchange" caused.
const RETRY_EXCHANGE = 'retry.exchange';

function extractCorrelationId(msg: ConsumeMessage): string {
    const headers = msg.properties.headers as Record<string, any>;
    return headers?.['x-correlation-id'] || 'unknown';
}

// Per-queue retry queue name. Each consumer maintains its own retry queue
// so the DLX routing doesn't conflict between consumers.
function getRetryQueueName(queueName: string): string {
    return `${queueName}.retry`;
}

export async function consumeQueue(
    queueName: string,
    handler: MessageHandler,
    options: ConsumerOptions = {}
): Promise<void> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const channel = await rabbitMQ.getChannel();
    await channel.prefetch(mergedOptions.prefetch!);

    // Set up the retry topology: a per-queue retry queue with TTL that
    // dead-letters back to the original exchange/routing key.
    const retryQueue = getRetryQueueName(queueName);
    await channel.assertExchange(RETRY_EXCHANGE, 'direct', { durable: true });
    await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
            // No per-message TTL here; the message carries its own delay in
            // the 'x-retry-delay-ms' header. We use a dead-letter exchange
            // to bounce expired messages back to the main queue.
            'x-dead-letter-exchange': '', // default exchange
            'x-dead-letter-routing-key': queueName,
        },
    });
    await channel.bindQueue(retryQueue, RETRY_EXCHANGE, queueName);

    logger.info(`Starting consumer for queue: ${queueName} (retry queue: ${retryQueue})`);

    await channel.consume(queueName, async (msg) => {
        if (!msg) return;

        const correlationId = extractCorrelationId(msg);
        const retryCount = (msg.properties.headers as any)?.['x-retry-count'] || 0;

        try {
            const payload = JSON.parse(msg.content.toString());
            logger.info(`Processing message from ${queueName}`, { correlationId, retryCount });

            await handler(payload, correlationId);

            channel.ack(msg);
            logger.info(`Message processed successfully from ${queueName}`, { correlationId });
        } catch (err: any) {
            logger.error(`Error processing message from ${queueName}`, {
                correlationId,
                retryCount,
                error: err.message,
            });

            if (retryCount >= mergedOptions.maxRetries!) {
                logger.error(`Message exceeded max retries, sending to DLQ`, { correlationId });
                // nack without requeue → falls through to the queue's
                // x-dead-letter-exchange (DLX) which we configured to point
                // at the .dlq queue.
                channel.nack(msg, false, false);
                return;
            }

            const delay = mergedOptions.retryDelayMs! * Math.pow(2, retryCount);
            const newHeaders = {
                ...(msg.properties.headers as Record<string, any>),
                'x-retry-count': retryCount + 1,
                // Per-message TTL — RabbitMQ's per-queue TTL argument
                // doesn't support variable delays, but per-message does
                // via the 'expiration' field.
                'x-retry-delay-ms': delay,
            };

            // Publish to the retry exchange with a per-message TTL. When
            // the TTL expires the message dead-letters back to the original
            // queue, ready for another attempt.
            const published = channel.publish(
                RETRY_EXCHANGE,
                queueName,
                msg.content,
                {
                    persistent: true,
                    priority: msg.properties.priority,
                    headers: newHeaders,
                    expiration: String(delay),
                }
            );

            if (published) {
                // Wait for broker confirm so we don't ack the original
                // until the retry copy is safely stored.
                try {
                    await channel.waitForConfirms();
                    channel.ack(msg);
                } catch (confirmErr: any) {
                    logger.error('Retry publish confirm failed; leaving message unacked', {
                        correlationId,
                        error: confirmErr.message,
                    });
                    channel.nack(msg, false, true); // requeue
                }
            } else {
                // Buffer was full; nack and let the broker requeue.
                channel.nack(msg, false, true);
            }
        }
    });
}

export async function consumeSubmissionQueue(handler: MessageHandler, options?: ConsumerOptions): Promise<void> {
    return consumeQueue(QUEUES.SUBMISSION, handler, options);
}

export async function consumeVerdictQueue(handler: MessageHandler, options?: ConsumerOptions): Promise<void> {
    return consumeQueue(QUEUES.VERDICT, handler, options);
}

export async function consumePlagiarismQueue(handler: MessageHandler, options?: ConsumerOptions): Promise<void> {
    return consumeQueue(QUEUES.PLAGIARISM, handler, options);
}
