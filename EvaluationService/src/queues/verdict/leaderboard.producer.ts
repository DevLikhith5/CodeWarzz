import { Queue } from "bullmq";
import { getRedisConnObject } from "../../config/redis.config";

export interface LeaderboardJobPayload {
  submissionId: string;
  contestId: string;
  userId: string;
  score: number;
  timeTakenInMs: number;
}

const leaderboardQueue = new Queue("leaderboard-queue", {
  connection: getRedisConnObject(),
});

export async function pushToLeaderboardQueue(
  payload: LeaderboardJobPayload
) {
  await leaderboardQueue.add(
    "update-leaderboard",
    payload,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}
