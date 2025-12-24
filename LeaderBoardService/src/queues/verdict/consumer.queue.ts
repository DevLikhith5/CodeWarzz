import { Worker } from "bullmq";

import { getRedisConnObject } from "../../config/redis.config";

import { updateLeaderboard } from "../../services/leaderboard.service";


export const startVerdictConsumer = () => {
    const worker = new Worker("leaderboard-queue", async (job) => {

        const { contestId, userId, score, timeTakenInMs } = job.data;
        if(!contestId || !userId || score === undefined || timeTakenInMs === undefined){
            throw new Error("Invalid job data");
        }
        await updateLeaderboard({ contestId, userId, score, timeTakenInMs });
    }, {
        connection: getRedisConnObject(),
        concurrency:5
    });
    worker.on("completed", (job) => {
        console.log(`Job ${job.id} completed`);
    });
    worker.on("failed", (job, err) => {
        console.log(`Job ${job?.id} failed with error: ${err}`);
    });
    worker.on("drained", () => {
        console.log("All jobs completed");
    });
    return worker
};