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
