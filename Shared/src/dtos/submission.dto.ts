import { z } from "zod";

export const createSubmissionSchema = z.object({
    body: z.object({
        code: z.string().min(1),
        language: z.string(),
        problemId: z.string().uuid(),
        contestId: z.string().uuid().optional(),
    })
});

export const runCodeSchema = z.object({
    body: z.object({
        code: z.string().min(1),
        language: z.string(),
        problemId: z.string().uuid(),
        testcases: z.array(z.object({
            input: z.string(),
            output: z.string().optional(),
        })).optional(),
    })
});

export const updateSubmissionSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        verdict: z.enum(["AC", "WA", "TLE", "MLE", "RE", "CE", "PENDING"]),
        score: z.number().optional(),
        timeTakenMs: z.number().optional(),
        memoryUsedMb: z.number().optional(),
        passedTestcases: z.number().optional(),
        totalTestcases: z.number().optional(),
        failedInput: z.string().optional(),
        failedExpected: z.string().optional(),
        failedOutput: z.string().optional(),
        errorMessage: z.string().optional(),
    })
});

export const getSubmissionSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    })
});

export const getSubmissionsSchema = z.object({
    query: z.object({
        problemId: z.string().uuid().optional(),
        contestId: z.string().uuid().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        offset: z.string().regex(/^\d+$/).transform(Number).optional(),
    })
});
