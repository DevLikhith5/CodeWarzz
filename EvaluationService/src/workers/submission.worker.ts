import { startSubmissionConsumer } from "../queues/submission/consumer.queue";
import { monitorQueue } from "../../../Shared/src/service/queueMonitor.service";
import { getRedisConnObject } from "../config/redis.config";

console.log("Submission worker started");
monitorQueue("submission-queue", getRedisConnObject());
startSubmissionConsumer();
