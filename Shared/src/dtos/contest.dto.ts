import { z } from "zod";

export const createContestSchema = {
    body: z.object({
        title: z.string().min(3),
        description: z.string(),
        startTime: z.string().datetime().or(z.date()),
        endTime: z.string().datetime().or(z.date()),
    })
};

export const addProblemToContestSchema = {
    body: z.object({
        contestId: z.string().uuid(),
        problemId: z.string().uuid(),
    })
};

export const contestIdSchema = z.object({
    id: z.string().uuid(),
});

export const registerContestSchema = {
    params: contestIdSchema
};
