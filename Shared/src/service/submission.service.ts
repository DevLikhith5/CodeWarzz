import { submissionRepository, SubmissionInsert } from "../repository/submission.repository";
import { contestRepository } from "../repository/contest.repository";
import { submissionQueue } from "../queues/submission.queue";
import { ForbiddenError } from "../utils/errors/app.error";

export type CreateSubmissionDTO = Omit<SubmissionInsert, 'id' | 'createdAt'>;

export class SubmissionService {
    async submitSolution(data: SubmissionInsert) {
        // Access Control: Check if problem belongs to an ongoing contest
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

        // Check if submission already exists for this user and problem
        const existingSubmission = await submissionRepository.getSubmissionByProblemId(data.userId || "", data.problemId);
        if (existingSubmission && existingSubmission.verdict === "AC") {
            // return existingSubmission; // Allow resubmission
        }

        const submission = await submissionRepository.createSubmission(data);

        const payload = {
            submissionId: submission.id,
            userId: data.userId,
            contestId: data.contestId,
            problemId: data.problemId,
            language: data.language,
            code: data.code,
            submissionCreatedAt: submission.createdAt,
        };

        await submissionQueue.add('evaluate-submission', payload);

        return submission;
    }

    async getSubmission(id: string) {
        return await submissionRepository.getSubmissionById(id);
    }

    async getSubmissions(filters: { userId?: string, problemId?: string, contestId?: string }, limit?: number, offset?: number) {
        return await submissionRepository.getSubmissions(filters, limit, offset);
    }

    async runSolution(data: { userId?: string; code: string; language: string; problemId: string; testcases?: any[] }) {
        // Access Control: Check if problem belongs to an ongoing contest
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

        const payload = {
            ...data,
            isRunOnly: true,
            submissionCreatedAt: new Date(),
        };

        const job = await submissionQueue.add('evaluate-submission', payload);
        // Note: For 'run', usually we wait for result or return job info. 
        // Assuming async execution for now as per queue pattern.
        return { message: "Run request queued", jobId: job.id };
    }

    async getRunResult(jobId: string) {
        const job = await submissionQueue.getJob(jobId);
        if (!job) {
            return null;
        }

        const state = await job.getState();
        const result = job.returnvalue;
        const error = job.failedReason;

        return {
            jobId: job.id,
            status: state,
            result,
            error
        };
    }

    async updateSubmission(id: string, data: Partial<SubmissionInsert>) {
        return await submissionRepository.updateSubmission(id, data);
    }
}

export const submissionService = new SubmissionService();
