import { Queue } from "bullmq";
import { getRedisConnObject } from "./redis.config";

let verdictQueue: Queue | null = null;

export const getVerdictQueue = () => {
  if (!verdictQueue) {
    verdictQueue = new Queue("leaderboard-queue", {
      connection: getRedisConnObject(),
    });
  }
  return verdictQueue;
};