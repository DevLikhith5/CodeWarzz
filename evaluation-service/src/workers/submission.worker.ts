import { startSubmissionConsumer } from "../queues/submission/consumer.queue";

console.log("RabbitMQ submission worker started");
startSubmissionConsumer();
