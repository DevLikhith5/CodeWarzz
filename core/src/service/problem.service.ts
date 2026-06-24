import { problemRepository, ProblemInsert } from "../repository/problem.repository";
import { BadRequestError } from "../utils/errors/app.error";
import { addProblemToBloomFilter } from "./bloom.service";
import logger from "../config/logger.config";

interface CreateTestcaseInput {
    input: string;
    output: string;
    isSample?: boolean;
}

interface CreateProblemInput {
    title: string;
    slug: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";

    timeLimitMs?: number;
    memoryLimitMb?: number;
    cpuLimit?: number;
    stackLimitMb?: number;

    testcases: CreateTestcaseInput[];
    contestId?: string;
    tags?: string[];
    hints?: string[];
}

export class ProblemService {
    async createProblem(input: CreateProblemInput) {
        if (!input.testcases || input.testcases.length === 0) {
            throw new BadRequestError("At least one testcase is required");
        }

        const problemData: ProblemInsert = {
            title: input.title,
            slug: input.slug,
            description: input.description,
            difficulty: input.difficulty,
            timeLimitMs: input.timeLimitMs ?? 2000,
            memoryLimitMb: input.memoryLimitMb ?? 256,
            cpuLimit: input.cpuLimit ?? 1,
            stackLimitMb: input.stackLimitMb,
            tags: input.tags || [],
            hints: input.hints || []
        };

        const testcasesData = input.testcases.map(tc => ({
            input: tc.input,
            output: tc.output,
            isSample: tc.isSample ?? false
        }));

        const problem = await problemRepository.createProblemWithTestcases(problemData, testcasesData, input.contestId);
        // Add to bloom filter so the gateway doesn't shed traffic to this new
        // problem as "non-existent". Failure is logged but doesn't fail the request.
        addProblemToBloomFilter(problem.id).catch((err: any) =>
            logger.error('Failed to add problem to bloom filter', { problemId: problem.id, error: err.message })
        );
        return problem;
    }


    async getProblem(id: string, userId?: string) {
        return await problemRepository.getProblemById(id, userId);
    }

    async getProblemBySlug(slug: string, userId?: string) {
        return await problemRepository.getProblemBySlug(slug, userId);
    }   

    async getAllProblems(page: number = 1, limit: number = 10, userId?: string) {
        return await problemRepository.getAllProblems(page, limit, userId);
    }
}

export const problemService = new ProblemService();
