import { startSubmissionConsumer } from "../queues/submission/consumer.queue";

console.log("Submission worker started");
startSubmissionConsumer();
