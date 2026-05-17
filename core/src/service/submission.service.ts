import { submissionRepository, SubmissionInsert } from "../repository/submission.repository";
import { contestRepository } from "../repository/contest.repository";
import { enqueueSubmission, enqueueRun } from "../queues/submission.queue";
import { userRepository } from "../repository/user.repository";
import { ForbiddenError } from "../utils/errors/app.error";
import logger from "../config/logger.config";
import { v4 as uuidv4 } from 'uuid';
import { redis } from "../config/redis.config";
import { appendEvent } from "../service/eventStore.service";

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
        const submission = await submissionRepository.createSubmission(data);

        await appendEvent('submission', submission.id, 'SUBMISSION_CREATED', {
            userId: data.userId,
            problemId: data.problemId,
            contestId: data.contestId,
            language: data.language,
        });

        const payload = {
            submissionId: submission.id,
            userId: data.userId,
            contestId: data.contestId,
            problemId: data.problemId,
            language: data.language,
            code: data.code,
            submissionCreatedAt: submission.createdAt,
        };
        const isContest = !!data.contestId;
        await enqueueSubmission(payload, isContest);

        await appendEvent('submission', submission.id, 'SUBMISSION_QUEUED', {
            isContest,
        });

        if (data.userId) {
            userRepository.incrementUserActivity(data.userId).catch(err => {
                logger.error(`Failed to update user activity for ${data.userId}`, err);
            });
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

        await enqueueRun(payload);

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
                const existingBest = await submissionRepository.getBestSubmission(submission.userId, submission.problemId);
                if (!existingBest) {
                    await userRepository.incrementSolvedCount(submission.userId);
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

        return await submissionRepository.updateSubmission(id, data);
    }
}

export const submissionService = new SubmissionService();
