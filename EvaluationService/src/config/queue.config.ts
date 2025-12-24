import { Queue } from "bullmq";
import { getRedisConnObject } from "./redis.config";

let submissionQueue: Queue | null = null;

export const getSubmissionQueue = () => {
  if (!submissionQueue) {
    submissionQueue = new Queue("submission-queue", {
      connection: getRedisConnObject(),
    });
  }
  return submissionQueue;
};