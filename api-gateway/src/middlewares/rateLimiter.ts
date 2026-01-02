import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.conifg";
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

export const rateLimiter = (config: RateLimitConfig = DEFAULT_CONFIG) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const key = `ratelimit:${ip}`;

        try {
            const now = Math.floor(Date.now() / 1000);


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
