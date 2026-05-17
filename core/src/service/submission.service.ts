import { submissionRepository, SubmissionInsert } from "../repository/submission.repository";
import { contestRepository } from "../repository/contest.repository";
import { userRepository } from "../repository/user.repository";
import { ForbiddenError } from "../utils/errors/app.error";
import logger from "../config/logger.config";
import { v4 as uuidv4 } from 'uuid';
import { redis } from "../config/redis.config";
import { appendEvent } from "../service/eventStore.service";
import { saveOutboxMessage } from "../service/outbox.service";
import { EXCHANGES, ROUTING_KEYS } from "../queues/rabbitmq/config";
import { Saga } from "../service/saga.service";
import { withDistributedLock } from "../utils/distributedLock";
import { withIdempotency } from "../middlewares/idempotency.middleware";
import { backpressureMonitor } from "../service/backpressure.service";

export type CreateSubmissionDTO = Omit<SubmissionInsert, 'id' | 'createdAt'>;

export class SubmissionService {
    async submitSolution(data: SubmissionInsert) {
        const ongoingContests = await contestRepository.getOngoingContestsForProblem(data.problemId);

        if (ongoingContests.length > 0) {
            let isAuthorized = false;
            for (const contest of ongoingContests) {
                if (data.userId) {
                    const isRegistered = await contestRepository.isUserRegistered(contest.id, data.userId);
                    if (isRegistered) {
                        isAuthorized = true;
                        break;
                    }
                }
            }

            if (!isAuthorized) {
                throw new ForbiddenError("You must be registered for the ongoing contest to submit this problem.");
            }
        }

        const backpressureStatus = await backpressureMonitor.checkQueueDepth('submission-queue');
        if (backpressureStatus.isOverloaded) {
            throw new Error("System is under heavy load. Please retry after a few seconds.");
        }

        const submission = await submissionRepository.createSubmission(data);

        await appendEvent('submission', submission.id, 'SUBMISSION_CREATED', {
            userId: data.userId,
            problemId: data.problemId,
            contestId: data.contestId,
            language: data.language,
        });

        const saga = new Saga(`submission-${submission.id}`);

        const payload = {
            submissionId: submission.id,
            userId: data.userId,
            contestId: data.contestId,
            problemId: data.problemId,
            language: data.language,
            code: data.code,
            submissionCreatedAt: submission.createdAt,
        };

        saga
            .addStep(
                'enqueue-submission',
                async () => {
                    await saveOutboxMessage({
                        aggregateType: 'submission',
                        aggregateId: submission.id,
                        eventType: 'SUBMISSION_QUEUED',
                        payload,
                        exchange: EXCHANGES.SUBMISSION,
                        routingKey: ROUTING_KEYS.SUBMISSION,
                        maxAttempts: 5,
                    });
                },
                async () => {
                    logger.warn(`Compensating: marking submission ${submission.id} as FAILED`);
                    await submissionRepository.updateSubmission(submission.id, { verdict: 'RE' });
                }
            )
            .addStep(
                'update-user-activity',
                async () => {
                    if (data.userId) {
                        await userRepository.incrementUserActivity(data.userId);
                    }
                },
                async () => {
                    if (data.userId) {
                        await userRepository.decrementUserActivity(data.userId);
                    }
                }
            );

        await saga.execute();

        await appendEvent('submission', submission.id, 'SUBMISSION_QUEUED', {
            isContest: !!data.contestId,
        });

        return submission;
    }

    async getSubmission(id: string) {
        return await submissionRepository.getSubmissionById(id);
    }

    async getBestSubmission(userId: string, problemId: string) {
        return await submissionRepository.getBestSubmission(userId, problemId);
    }

    async getSubmissions(filters: { userId?: string, problemId?: string, contestId?: string }, limit?: number, offset?: number) {
        return await submissionRepository.getSubmissions(filters, limit, offset);
    }

    async runSolution(data: { userId?: string; code: string; language: string; problemId: string; testcases?: any[] }) {
        const ongoingContests = await contestRepository.getOngoingContestsForProblem(data.problemId);

        if (ongoingContests.length > 0) {
            let isAuthorized = false;
            for (const contest of ongoingContests) {
                if (data.userId) {
                    const isRegistered = await contestRepository.isUserRegistered(contest.id, data.userId);
                    if (isRegistered) {
                        isAuthorized = true;
                        break;
                    }
                }
            }

            if (!isAuthorized) {
                throw new ForbiddenError("You must be registered for the ongoing contest to run this problem.");
            }
        }

        const jobId = uuidv4();
        const payload = {
            ...data,
            isRunOnly: true,
            submissionCreatedAt: new Date(),
            jobId,
        };

        await saveOutboxMessage({
            aggregateType: 'run',
            aggregateId: jobId,
            eventType: 'RUN_QUEUED',
            payload,
            exchange: EXCHANGES.SUBMISSION,
            routingKey: ROUTING_KEYS.SUBMISSION,
        });

        await redis.setex(`run-result:${jobId}`, 300, JSON.stringify({ status: 'queued' }));

        return { message: "Run request queued", jobId };
    }

    async getRunResult(jobId: string) {
        const resultStr = await redis.get(`run-result:${jobId}`);
        if (!resultStr) {
            return null;
        }

        const result = JSON.parse(resultStr);
        return {
            jobId,
            status: result.status,
            result: result.data || null,
            error: result.error || null,
        };
    }

    async updateSubmission(id: string, data: Partial<SubmissionInsert>) {
        if (data.verdict === 'AC') {
            const submission = await submissionRepository.getSubmissionById(id);
            if (submission && submission.userId) {
                await withDistributedLock(
                    `solved-count:${submission.userId}:${submission.problemId}`,
                    async () => {
                        const existingBest = await submissionRepository.getBestSubmission(submission.userId, submission.problemId);
                        if (!existingBest) {
                            await userRepository.incrementSolvedCount(submission.userId);
                        }
                    },
                    5000
                );
            }
        }

        if (data.verdict) {
            await appendEvent('submission', id, 'SUBMISSION_COMPLETED', {
                verdict: data.verdict,
                score: data.score,
                timeTakenMs: data.timeTakenMs,
                passedTestcases: data.passedTestcases,
                totalTestcases: data.totalTestcases,
            });
        }

        return await submissionRepository.updateSubmission(id, data);
    }

    async submitSolutionWithIdempotency(data: SubmissionInsert) {
        const idempotencyKey = `submit:${data.userId}:${data.problemId}:${Buffer.from(data.code).length}`;

        return withIdempotency(
            idempotencyKey,
            () => this.submitSolution(data),
            300
        );
    }
}

export const submissionService = new SubmissionService();
