import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.config";
import logger from "../config/logger.config";

interface RateLimitConfig {
    maxTokens: number;
    refillRate: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
    maxTokens: 50,
    refillRate: 50 / 60,
};


const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local maxTokens = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local currentTokens = maxTokens
local lastRefill = now

local data = redis.call("GET", key)
if data then
    local decoded = cjson.decode(data)
    currentTokens = decoded.tokens
    lastRefill = decoded.lastRefill

    local elapsed = now - lastRefill
    if elapsed > 0 then
        local added = elapsed * refillRate
        currentTokens = math.min(maxTokens, currentTokens + added)
        lastRefill = now
    end
end

if currentTokens >= 1 then
    currentTokens = currentTokens - 1
    local newState = cjson.encode({tokens=currentTokens, lastRefill=lastRefill})
    redis.call("SET", key, newState, "EX", 3600)
    return currentTokens
else
    return -1
end
`;

// Resolve the client IP. Prefer req.ip (which respects trust proxy settings
// on the Express app). Only fall back to x-forwarded-for if no other IP is
// available, and only take the leftmost entry.
function resolveClientIp(req: Request): string {
    if (req.ip) return req.ip;
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
        return xff.split(",")[0].trim();
    }
    if (Array.isArray(xff) && xff.length > 0) {
        return xff[0].split(",")[0].trim();
    }
    return req.socket.remoteAddress || "unknown";
}

export const rateLimiter = (config: RateLimitConfig = DEFAULT_CONFIG) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = resolveClientIp(req);
        const key = `ratelimit:${ip}`;

        try {
            const now = Math.floor(Date.now() / 1000);

            // Skip rate limiting in test environment
            if (process.env.NODE_ENV === 'test') return next();

            const result = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, config.maxTokens, config.refillRate, now);

            if ((result as number) >= 0) {
                res.setHeader("X-RateLimit-Limit", config.maxTokens);
                res.setHeader("X-RateLimit-Remaining", Math.floor(result as number));
                return next();
            } else {
                res.status(429).json({
                    success: false,
                    message: "Too many requests. Please try again later.",
                });
            }
        } catch (error) {
            logger.error("Rate limiter error:", { error });
            next();
        }
    };
};
