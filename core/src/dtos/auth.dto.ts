import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    username: z.string().min(3).max(50),
    role: z.enum(["admin", "user"]).default("user"),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string(),
});
