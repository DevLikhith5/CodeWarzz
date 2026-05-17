import { rabbitMQ } from './connection';
import { EXCHANGES, QUEUES, ROUTING_KEYS, QUEUE_CONFIG } from './config';
import logger from '../../config/logger.config';

export async function setupRabbitMQTopology(): Promise<void> {
    const channel = await rabbitMQ.getChannel();

    await channel.assertExchange(EXCHANGES.DLX, 'direct', { durable: true });
    await channel.assertExchange(EXCHANGES.SUBMISSION, 'direct', { durable: true });
    await channel.assertExchange(EXCHANGES.VERDICT, 'direct', { durable: true });
    await channel.assertExchange(EXCHANGES.PLAGIARISM, 'direct', { durable: true });
    await channel.assertExchange(EXCHANGES.EVENTS, 'fanout', { durable: true });

    await channel.assertQueue(QUEUES.SUBMISSION_DLQ, { durable: true });
    await channel.bindQueue(QUEUES.SUBMISSION_DLQ, EXCHANGES.DLX, ROUTING_KEYS.SUBMISSION_DLQ);

    await channel.assertQueue(QUEUES.VERDICT_DLQ, { durable: true });
    await channel.bindQueue(QUEUES.VERDICT_DLQ, EXCHANGES.DLX, ROUTING_KEYS.VERDICT_DLQ);

    await channel.assertQueue(QUEUES.PLAGIARISM_DLQ, { durable: true });
    await channel.bindQueue(QUEUES.PLAGIARISM_DLQ, EXCHANGES.DLX, ROUTING_KEYS.PLAGIARISM_DLQ);

    await channel.assertQueue(QUEUES.SUBMISSION, {
        durable: true,
        maxPriority: QUEUE_CONFIG[QUEUES.SUBMISSION].maxPriority,
        arguments: {
            'x-message-ttl': QUEUE_CONFIG[QUEUES.SUBMISSION].messageTtl,
            'x-dead-letter-exchange': QUEUE_CONFIG[QUEUES.SUBMISSION].deadLetterExchange,
            'x-dead-letter-routing-key': QUEUE_CONFIG[QUEUES.SUBMISSION].deadLetterRoutingKey,
        },
    });
    await channel.bindQueue(QUEUES.SUBMISSION, EXCHANGES.SUBMISSION, ROUTING_KEYS.SUBMISSION);

    await channel.assertQueue(QUEUES.VERDICT, {
        durable: true,
        arguments: {
            'x-message-ttl': QUEUE_CONFIG[QUEUES.VERDICT].messageTtl,
            'x-dead-letter-exchange': QUEUE_CONFIG[QUEUES.VERDICT].deadLetterExchange,
            'x-dead-letter-routing-key': QUEUE_CONFIG[QUEUES.VERDICT].deadLetterRoutingKey,
        },
    });
    await channel.bindQueue(QUEUES.VERDICT, EXCHANGES.VERDICT, ROUTING_KEYS.VERDICT);

    await channel.assertQueue(QUEUES.PLAGIARISM, {
        durable: true,
        arguments: {
            'x-message-ttl': QUEUE_CONFIG[QUEUES.PLAGIARISM].messageTtl,
            'x-dead-letter-exchange': QUEUE_CONFIG[QUEUES.PLAGIARISM].deadLetterExchange,
            'x-dead-letter-routing-key': QUEUE_CONFIG[QUEUES.PLAGIARISM].deadLetterRoutingKey,
        },
    });
    await channel.bindQueue(QUEUES.PLAGIARISM, EXCHANGES.PLAGIARISM, ROUTING_KEYS.PLAGIARISM);

    logger.info('RabbitMQ topology setup complete');
}
