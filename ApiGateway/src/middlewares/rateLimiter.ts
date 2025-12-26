import { Request, Response, NextFunction } from "express";
import redis from "../config/redis";

interface RateLimitConfig {
    maxTokens: number;
    refillRate: number; 
}

const DEFAULT_CONFIG: RateLimitConfig = {
    maxTokens: 10,
    refillRate: 10 / 60, 
};

export const rateLimiter = (config: RateLimitConfig = DEFAULT_CONFIG) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const key = `ratelimit:${ip}`;

        try {
            const now = Math.floor(Date.now() / 1000);
            const data = await redis.get(key);

            let bucket;
            if (data) {
                bucket = JSON.parse(data);
                const elapsed = now - bucket.lastRefill;
                const addedTokens = elapsed * config.refillRate;
                bucket.tokens = Math.min(config.maxTokens, bucket.tokens + addedTokens);
                bucket.lastRefill = now;
            } else {
                bucket = {
                    tokens: config.maxTokens,
                    lastRefill: now,
                };
            }

            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                await redis.set(key, JSON.stringify(bucket), "EX", 3600); // 1 hour expiry
                res.setHeader("X-RateLimit-Limit", config.maxTokens);
                res.setHeader("X-RateLimit-Remaining", Math.floor(bucket.tokens));
                return next();
            } else {
                res.status(429).json({
                    success: false,
                    message: "Too many requests. Please try again later.",
                });
            }
        } catch (error) {
            console.error("Rate limiter error:", error);
            next();
        }
    };
};
