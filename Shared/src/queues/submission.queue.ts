import { Queue } from 'bullmq';
import connection from '../config/redis'

export const SUBMISSION_QUEUE_NAME = 'submission-queue';

export const submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 500
    }
});
