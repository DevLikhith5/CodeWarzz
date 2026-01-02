import { Worker } from "bullmq";

import { getRedisConnObject } from "../../config/redis.config";

import { updateLeaderboard } from "../../services/leaderboard.service";
import logger from "../../config/logger.config";


import { metricsService } from "../../../../Shared/src/service/metrics.service";

export const startVerdictConsumer = () => {
    const worker = new Worker("leaderboard-queue", async (job) => {
        const end = metricsService.getJobProcessingDuration().startTimer({ queue_name: 'leaderboard-queue', job_name: 'update_leaderboard' });

        try {
            logger.info("Data from the quue: ", { data: job.data });
            const { contestId, userId, score, contestEndTime } = job.data;
            if (!contestId || !userId || score === undefined) {
                throw new Error("Invalid job data");
            }
            const response = await updateLeaderboard({ contestId, userId, score, timeTakenInMs: 0, contestEndTime });
            logger.info("Response from the updateLeaderboard: ", { response });
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }

    }, {
        connection: getRedisConnObject(),
        concurrency: 5
    });
    worker.on("completed", (job) => {
        logger.info(`Job ${job.id} completed`);
    });
    worker.on("failed", (job, err) => {
        logger.error(`Job ${job?.id} failed with error: ${err}`);
    });
    worker.on("drained", () => {
        logger.info("All jobs completed");
    });
    return worker
};