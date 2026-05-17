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

function extractCorrelationId(msg: ConsumeMessage): string {
    const headers = msg.properties.headers as Record<string, any>;
    return headers?.['x-correlation-id'] || 'unknown';
}

export async function consumeQueue(
    queueName: string,
    handler: MessageHandler,
    options: ConsumerOptions = {}
): Promise<void> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const channel = await rabbitMQ.getChannel();
    await channel.prefetch(mergedOptions.prefetch!);

    logger.info(`Starting consumer for queue: ${queueName}`);

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
                channel.ack(msg);
            } else {
                const delay = mergedOptions.retryDelayMs! * Math.pow(2, retryCount);
                const newHeaders = {
                    ...(msg.properties.headers as Record<string, any>),
                    'x-retry-count': retryCount + 1,
                    'x-retry-delay-ms': delay,
                };

                channel.publish(
                    msg.fields.exchange,
                    msg.fields.routingKey,
                    msg.content,
                    {
                        persistent: true,
                        priority: msg.properties.priority,
                        headers: newHeaders,
                    }
                );
                channel.ack(msg);
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
