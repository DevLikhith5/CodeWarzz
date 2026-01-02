import { Queue } from 'bullmq';
import { redis } from '../config/redis.config'

export const SUBMISSION_QUEUE_NAME = 'submission-queue';

export const submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: {
            age: 300, // Keep for 5 minutes
            count: 100 // Keep last 100 jobs
        },
        removeOnFail: 500
    }
});


