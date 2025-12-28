import { z } from "zod";

export const createContestSchema = {
    body: z.object({
        title: z.string().min(3),
        description: z.string(),
        startTime: z.string().datetime().or(z.date()),
        endTime: z.string().datetime().or(z.date()),
    }).refine((data) => data.startTime < data.endTime, {
        message: "Start time must be before end time",
        path: ["endTime"],
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

export const getContestsSchema = {
    query: z.object({
        status: z.enum(['upcoming', 'ongoing', 'ended']).optional(),
        registered: z.enum(['true', 'false']).optional(),
        participated: z.enum(['true', 'false']).optional(),
    })
};
