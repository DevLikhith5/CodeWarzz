import { submissionRepository, SubmissionInsert } from "../repository/submission.repository";
import { problemRepository } from "../repository/problem.repository";
import { submissionQueue } from "../queues/submission.queue";
import { BadRequestError } from "../utils/errors/app.error";

// Submission Data without ID and timestamps which are generated
export type CreateSubmissionDTO = Omit<SubmissionInsert, 'id' | 'createdAt'>;

export class SubmissionService {
    async submitSolution(data: CreateSubmissionDTO) {
        // 1. Save submission to DB
        const submission = await submissionRepository.createSubmission(data);
        const { problemId, userId, contestId, language, code, id: submissionId } = submission;

        // 2. Fetch Problem Details (Testcases + Constraints)
        const problem = await problemRepository.getProblemById(problemId);
        if (!problem) {
            throw new BadRequestError("Problem not found");
        }

        const testcases = await problemRepository.getTestcasesByProblemId(problemId);

        // 3. Construct Payload for Worker
        // Structure matches EvaluationService consumer.queue.ts expectations
        const payload = {
            submissionId,
            userId,
            contestId,
            language,
            code,
            testcases: testcases.map(tc => ({
                input: tc.input,
                output: tc.output
            })),
            constraints: {
                timeLimitMs: problem.timeLimitMs,
                memoryLimitMb: problem.memoryLimitMb,
                cpuLimit: problem.cpuLimit
            }
        };

        // 4. Add to Queue
        await submissionQueue.add('evaluate-submission', payload);
        console.log(`Submission ${submissionId} added to queue`);

        return submission;
    }
}

export const submissionService = new SubmissionService();
