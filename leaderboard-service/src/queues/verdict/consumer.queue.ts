import { consumeVerdictQueue, MessageHandler } from '../../../../core/src/queues/rabbitmq';
import { updateLeaderboard } from "../../services/leaderboard.service";
import logger from "../../config/logger.config";
import { metricsService } from "../../../../core/src/service/metrics.service";

export const startVerdictConsumer = () => {
    logger.info("Starting RabbitMQ verdict consumer...");

    const handler: MessageHandler = async (data: any, correlationId: string) => {
        const end = metricsService.getJobProcessingDuration().startTimer({ queue_name: 'verdict-queue', job_name: 'update_leaderboard' });

        try {
            logger.info("Data from the queue: ", { data, correlationId });
            const { contestId, userId, score, contestEndTime } = data;
            if (!contestId || !userId || score === undefined) {
                throw new Error("Invalid job data");
            }
            const response = await updateLeaderboard({ contestId, userId, score, timeTakenInMs: 0, contestEndTime });
            logger.info("Response from the updateLeaderboard: ", { response });
            end({ status: 'success' });
        } catch (err: any) {
            logger.error(`Verdict processing failed: ${err.message}`);
            end({ status: 'error' });
            throw err;
        }
    };

    consumeVerdictQueue(handler, {
        prefetch: 10,
        maxRetries: 3,
        retryDelayMs: 1000,
    });

    logger.info("RabbitMQ verdict consumer started successfully.");
};
