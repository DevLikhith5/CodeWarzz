import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
    role: z.enum(["admin", "user"]).default("user"),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
