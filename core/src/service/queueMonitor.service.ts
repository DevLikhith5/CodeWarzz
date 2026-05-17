import { metricsService } from './metrics.service';
import logger from '../config/logger.config';
import { QUEUES } from '../queues/rabbitmq/config';

const RABBITMQ_MANAGEMENT_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://rabbitmq:15672';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'codewarz';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'codewarz';

const MONITORED_QUEUES = [
    QUEUES.SUBMISSION,
    QUEUES.VERDICT,
    QUEUES.PLAGIARISM,
    QUEUES.SUBMISSION_DLQ,
    QUEUES.VERDICT_DLQ,
    QUEUES.PLAGIARISM_DLQ,
];

class QueueMonitorService {
    private isMonitoring = false;

    public startMonitoring() {
        if (this.isMonitoring) {
            logger.warn("Queue monitoring already started.");
            return;
        }

        logger.info("Starting RabbitMQ Queue Monitor Service...");

        const updateMetrics = async () => {
            try {
                const auth = Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString('base64');

                for (const queueName of MONITORED_QUEUES) {
                    const response = await fetch(`${RABBITMQ_MANAGEMENT_URL}/api/queues/%2F/${queueName}`, {
                        headers: {
                            'Authorization': `Basic ${auth}`,
                        },
                    });

                    if (!response.ok) {
                        if (response.status === 404) {
                            continue;
                        }
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const data = await response.json() as any;

                    const messagesReady = data.messages_ready || 0;
                    const messagesUnacknowledged = data.messages_unacknowledged || 0;
                    const messagesTotal = data.messages || 0;

                    metricsService.getQueueDepth().set({ queue_name: queueName, status: 'waiting' }, messagesReady);
                    metricsService.getQueueDepth().set({ queue_name: queueName, status: 'active' }, messagesUnacknowledged);
                    metricsService.getQueueDepth().set({ queue_name: queueName, status: 'total' }, messagesTotal);
                }
            } catch (error: any) {
                logger.error(`Failed to update RabbitMQ queue metrics: ${error.message}`);
            }
        };

        updateMetrics();
        setInterval(updateMetrics, 5000);

        this.isMonitoring = true;
    }
}

export const queueMonitorService = new QueueMonitorService();
