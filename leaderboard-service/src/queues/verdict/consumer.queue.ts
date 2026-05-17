import { consumeVerdictQueue, MessageHandler } from '../../../../core/src/queues/rabbitmq';
import { updateLeaderboard } from "../../services/leaderboard.service";
import logger from "../../config/logger.config";
import { metricsService } from "../../../../core/src/service/metrics.service";
import { withDistributedLock } from '../../../../core/src/utils/distributedLock';
import { isIdempotent, markProcessed } from '../../../../core/src/middlewares/idempotency.middleware';

export const startVerdictConsumer = () => {
    logger.info("Starting RabbitMQ verdict consumer...");

    const handler: MessageHandler = async (data: any, correlationId: string) => {
        const end = metricsService.getJobProcessingDuration().startTimer({ queue_name: 'verdict-queue', job_name: 'update_leaderboard' });

        try {
            const { contestId, userId, score, contestEndTime, submissionId } = data;
            if (!contestId || !userId || score === undefined) {
                throw new Error("Invalid job data");
            }

            const idempotencyKey = `verdict:${submissionId || `${contestId}:${userId}`}`;
            const alreadyProcessed = await isIdempotent(idempotencyKey);
            if (alreadyProcessed) {
                logger.info(`Idempotent hit for verdict: ${idempotencyKey}`);
                end({ status: 'success' });
                return;
            }

            logger.info("Data from the queue: ", { data, correlationId });

            await withDistributedLock(
                `leaderboard:${contestId}:${userId}`,
                async () => {
                    const response = await updateLeaderboard({ contestId, userId, score, timeTakenInMs: 0, contestEndTime });
                    logger.info("Response from the updateLeaderboard: ", { response });
                },
                10000
            );

            await markProcessed(idempotencyKey, { updated: true }, 3600);
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
