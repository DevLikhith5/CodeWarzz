import { Worker } from "bullmq";

import { getRedisConnObject } from "../../config/redis.config";

import { updateLeaderboard } from "../../services/leaderboard.service";


export const startVerdictConsumer = () => {
    const worker = new Worker("leaderboard-queue", async (job) => {

        console.log("Data from the quue: ", job.data)
        const { contestId, userId, score, contestEndTime } = job.data;
        if (!contestId || !userId || score === undefined) {
            throw new Error("Invalid job data");
        }
        const response = await updateLeaderboard({ contestId, userId, score, timeTakenInMs: 0, contestEndTime });
        console.log("Response from the updateLeaderboard: ", response)
    }, {
        connection: getRedisConnObject(),
        concurrency: 5
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