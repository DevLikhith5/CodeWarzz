import { rabbitMQ } from './connection';
import { EXCHANGES, ROUTING_KEYS } from './config';
import logger from '../../config/logger.config';

export interface PublishOptions {
    priority?: number;
    correlationId?: string;
    traceContext?: Record<string, string>;
    headers?: Record<string, string>;
}

export async function publishToExchange(
    exchange: string,
    routingKey: string,
    payload: Record<string, any>,
    options: PublishOptions = {}
): Promise<boolean> {
    const channel = await rabbitMQ.getChannel();

    const headers: Record<string, any> = {
        'x-correlation-id': options.correlationId || 'unknown',
        'x-published-at': new Date().toISOString(),
        ...options.traceContext,
        ...options.headers,
    };

    const messageBuffer = Buffer.from(JSON.stringify(payload));

    const published = channel.publish(exchange, routingKey, messageBuffer, {
        persistent: true,
        priority: options.priority,
        headers,
        contentType: 'application/json',
    });

    if (!published) {
        logger.warn('RabbitMQ publish buffer full, waiting for drain', { exchange, routingKey });
        await new Promise<void>((resolve) => {
            channel.once('drain', resolve);
        });
    }

    // Wait for broker confirm — this is what makes the publish durable.
    // Without this, a network blip between client and broker can cause silent
    // message loss, and the outbox processor would mark a message PUBLISHED
    // before the broker has actually received it.
    try {
        await channel.waitForConfirms();
    } catch (err: any) {
        logger.error('RabbitMQ publish confirm failed', { exchange, routingKey, error: err.message });
        throw err;
    }

    logger.debug(`Published to ${exchange} [${routingKey}]`, { correlationId: options.correlationId });
    return true;
}

export async function publishSubmission(payload: Record<string, any>, options: PublishOptions = {}): Promise<boolean> {
    return publishToExchange(EXCHANGES.SUBMISSION, ROUTING_KEYS.SUBMISSION, payload, {
        priority: options.priority || 1,
        ...options,
    });
}

export async function publishVerdict(payload: Record<string, any>, options: PublishOptions = {}): Promise<boolean> {
    return publishToExchange(EXCHANGES.VERDICT, ROUTING_KEYS.VERDICT, payload, options);
}

export async function publishPlagiarism(payload: Record<string, any>, options: PublishOptions = {}): Promise<boolean> {
    return publishToExchange(EXCHANGES.PLAGIARISM, ROUTING_KEYS.PLAGIARISM, payload, options);
}

export async function publishEvent(payload: Record<string, any>, options: PublishOptions = {}): Promise<boolean> {
    return publishToExchange(EXCHANGES.EVENTS, '', payload, options);
}
