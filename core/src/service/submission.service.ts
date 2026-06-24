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
import { withIdempotency } from "../middlewares/idempotency.middleware";
import { backpressureMonitor } from "../service/backpressure.service";
import db from "../config/db";

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

        // ── Transactional outbox: submission row + outbox row must commit
        //    together. If either fails, both roll back; a stuck PENDING
        //    submission is no longer possible.
        const { submission } = await db.transaction(async (tx) => {
            const submission = await submissionRepository.createSubmissionWithTx(tx, data);
            const payload = {
                submissionId: submission.id,
                userId: data.userId,
                contestId: data.contestId,
                problemId: data.problemId,
                language: data.language,
                code: data.code,
                submissionCreatedAt: submission.createdAt,
            };
            const outboxId = await saveOutboxMessage({
                aggregateType: 'submission',
                aggregateId: submission.id,
                eventType: 'SUBMISSION_QUEUED',
                payload,
                exchange: EXCHANGES.SUBMISSION,
                routingKey: ROUTING_KEYS.SUBMISSION,
                maxAttempts: 5,
            }, tx);
            return { submission, outboxId };
        });

        // Best-effort post-commit side effects. These run outside the
        // transaction so that a transient failure here doesn't roll back
        // the submission. Failures are logged.
        try {
            if (data.userId) {
                await userRepository.incrementUserActivity(data.userId);
            }
        } catch (err: any) {
            logger.error('Failed to increment user activity', { userId: data.userId, error: err.message });
        }

        try {
            await appendEvent('submission', submission.id, 'SUBMISSION_CREATED', {
                userId: data.userId,
                problemId: data.problemId,
                contestId: data.contestId,
                language: data.language,
            });
        } catch (err: any) {
            logger.error('Failed to append SUBMISSION_CREATED event', { submissionId: submission.id, error: err.message });
        }

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

        // Run jobs are fire-and-forget so they don't need a full transaction.
        // We just need the outbox row to exist for the queue processor to pick up.
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
        // ── Transactional: persist DB row + solved-count increment + event
        //    append must commit atomically. The lock outside the transaction
        //    (withDistributedLock) prevents two concurrent updates from
        //    both incrementing solvedCount, but the DB writes themselves
        //    are still atomic.
        return await db.transaction(async (tx) => {
            const updated = await submissionRepository.updateSubmissionWithTx(tx, id, data);

            if (data.verdict === 'AC') {
                const submission = await submissionRepository.getSubmissionByIdWithTx(tx, id);
                if (submission && submission.userId) {
                    // The distributed lock outside this method ensures only
                    // one concurrent update per (userId, problemId) pair.
                    const best = await submissionRepository.getBestSubmissionWithTx(
                        tx,
                        submission.userId,
                        submission.problemId,
                    );
                    if (!best) {
                        await userRepository.incrementSolvedCountWithTx(tx, submission.userId);
                    }
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

            return updated;
        });
    }

    async submitSolutionWithIdempotency(data: SubmissionInsert) {
        // Include contestId in the key so submissions in different contests
        // for the same problem are not incorrectly treated as duplicates.
        // We also hash the code so different submissions with the same
        // length are not conflated.
        const crypto = await import('crypto');
        const codeHash = crypto.createHash('sha256').update(data.code).digest('hex').slice(0, 16);
        const idempotencyKey = `submit:${data.userId}:${data.problemId}:${data.contestId ?? 'practice'}:${codeHash}`;

        return withIdempotency(
            idempotencyKey,
            () => this.submitSolution(data),
            300
        );
    }
}

export const submissionService = new SubmissionService();
