import { startSubmissionConsumer } from "../queues/submission/consumer.queue";
import { queueMonitorService } from "../../../Shared/src/service/queueMonitor.service";
import { getRedisConnObject } from "../config/redis.config";

console.log("Submission worker started");
queueMonitorService.monitorQueue("submission-queue", getRedisConnObject());
startSubmissionConsumer();
