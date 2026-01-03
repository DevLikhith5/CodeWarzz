import { Worker } from "bullmq";
import { getSchedulerQueue } from "../config/queue.config";
import { getRedisConnObject } from "../config/redis.config";

export const setupSnapshotCron = async () => {
    const schedulerQueue = getSchedulerQueue();

    await schedulerQueue.upsertJobScheduler(
        'leaderboard-snapshot',
        {
            every: 120000,
        }
    );
    console.log("Leaderboard snapshot cron scheduled.");

    const worker = new Worker("scheduler-queue", async (job) => {
        if (job.name === 'leaderboard-snapshot') {
            console.log("Triggering Leaderboard Snapshot via API...");
            const coreUrl = process.env.CORE_SERVICE_URL || 'http://localhost:3001';
            try {
                const response = await fetch(`${coreUrl}/api/v1/leaderboard/snapshot`, {
                    method: 'POST',
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`API returned ${response.status}: ${errText}`);
                }

                console.log("Snapshot API call successful.");
            } catch (error) {
                console.error("Failed to trigger snapshot:", error);
                throw error;
            }
        }
    }, {
        connection: getRedisConnObject()
    });

    worker.on("failed", (job, err) => {
        console.error(`Snapshot job ${job?.id} failed:`, err);
    });

    return worker;
};