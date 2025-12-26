import { problemRepository, ProblemInsert } from "../repository/problem.repository";
import { BadRequestError } from "../utils/errors/app.error";

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

        return await problemRepository.createProblemWithTestcases(problemData, testcasesData, input.contestId);
    }

    async getProblem(id: string) {
        return await problemRepository.getProblemById(id);
    }

    async getAllProblems() {
        return await problemRepository.getAllProblems();
    }
}

export const problemService = new ProblemService();
