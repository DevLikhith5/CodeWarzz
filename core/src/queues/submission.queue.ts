import { publishSubmission, PRIORITY } from './rabbitmq';
import { asyncLocalStorage } from '../utils/helpers/request.helpers';
import logger from '../config/logger.config';

export const SUBMISSION_QUEUE_NAME = 'submission-queue';

export async function enqueueSubmission(payload: Record<string, any>, isContest: boolean = false): Promise<string> {
    const correlationId = asyncLocalStorage.getStore()?.correlationId || 'unknown';
    const priority = isContest ? PRIORITY.CONTEST : PRIORITY.PRACTICE;

    await publishSubmission(payload, {
        priority,
        correlationId,
    });

    logger.info(`Submission enqueued to RabbitMQ`, {
        submissionId: payload.submissionId,
        priority,
        correlationId,
    });

    return payload.submissionId;
}

export async function enqueueRun(payload: Record<string, any>): Promise<string> {
    const correlationId = asyncLocalStorage.getStore()?.correlationId || 'unknown';

    await publishSubmission(payload, {
        priority: PRIORITY.PRACTICE,
        correlationId,
    });

    logger.info(`Run request enqueued to RabbitMQ`, {
        jobId: payload.jobId,
        correlationId,
    });

    return payload.jobId;
}
