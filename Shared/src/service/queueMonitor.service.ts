import { Queue } from 'bullmq';
import { metricsService } from './metrics.service';
import logger from '../config/logger.config';

export const monitorQueue = (queueName: string, connection: any) => {
    logger.info(`Starting metrics monitor for queue: ${queueName}`);

    // We instantiate a Queue object just for monitoring (readonly)
    const queue = new Queue(queueName, { connection });

    const updateMetrics = async () => {
        try {
            const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed');

            metricsService.getQueueDepth().set({ queue_name: queueName, status: 'waiting' }, counts.waiting);
            metricsService.getQueueDepth().set({ queue_name: queueName, status: 'active' }, counts.active);
            metricsService.getQueueDepth().set({ queue_name: queueName, status: 'failed' }, counts.failed);
            metricsService.getQueueDepth().set({ queue_name: queueName, status: 'delayed' }, counts.delayed);
            metricsService.getQueueDepth().set({ queue_name: queueName, status: 'completed' }, counts.completed);

        } catch (error) {
            logger.error(`Failed to update metrics for queue ${queueName}`, { error });
        }
    };

    // Initial update
    updateMetrics();

    // Poll every 5 seconds
    setInterval(updateMetrics, 5000); // 5000 ms = 5 seconds
};
