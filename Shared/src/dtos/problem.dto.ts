import { z } from "zod";

export const createProblemSchema = z.object({
    title: z.string().min(3),
    description: z.string(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    slug: z.string().optional(),
    testcases: z.array(z.object({
        input: z.string(),
        output: z.string(),
        isSample: z.boolean().optional(),
    })).optional(),
    contestId: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
    hints: z.array(z.string()).optional(),
});

export type CreateProblem = z.infer<typeof createProblemSchema>;

export interface ProblemDto {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    slug?: string;
    testcases?: Array<{
        input: string;
        output: string;
        isSample?: boolean;
    }>;
    contestId?: string;
    tags?: string[];
    hints?: string[];
    stats?: {
        totalSubmissions: number;
        acceptedSubmissions: number;
    };
}

export interface PaginatedProblemsDto {
    data: ProblemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
