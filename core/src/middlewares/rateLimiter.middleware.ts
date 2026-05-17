import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.config';
import logger from '../config/logger.config';

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local maxTokens = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
    tokens = maxTokens
    lastRefill = now
end

local elapsed = now - lastRefill
local newTokens = elapsed * refillRate
tokens = math.min(maxTokens, tokens + newTokens)

if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
    redis.call('EXPIRE', key, math.ceil(maxTokens / refillRate) + 10)
    return 1
else
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
    redis.call('EXPIRE', key, math.ceil(maxTokens / refillRate) + 10)
    return 0
end
`;

export interface RateLimitRule {
    key: string;
    maxTokens: number;
    refillRate: number;
    requested?: number;
}

const DEFAULT_RULES: Record<string, RateLimitRule> = {
    'POST:/api/v1/submissions': {
        key: 'rl:submission',
        maxTokens: 10,
        refillRate: 10 / 60,
    },
    'POST:/api/v1/submissions/run': {
        key: 'rl:run',
        maxTokens: 30,
        refillRate: 30 / 60,
    },
    'GET:/api/v1/problems': {
        key: 'rl:problems',
        maxTokens: 60,
        refillRate: 60 / 60,
    },
    'POST:/api/v1/auth/login': {
        key: 'rl:login',
        maxTokens: 5,
        refillRate: 5 / 60,
    },
    'GET:/api/v1/leaderboard': {
        key: 'rl:leaderboard',
        maxTokens: 120,
        refillRate: 120 / 60,
    },
};

async function checkRateLimit(identifier: string, rule: RateLimitRule): Promise<boolean> {
    const key = `${rule.key}:${identifier}`;
    const now = Date.now() / 1000;
    const requested = rule.requested || 1;

    const result = await redis.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        key,
        rule.maxTokens.toString(),
        rule.refillRate.toString(),
        now.toString(),
        requested.toString()
    );

    return result === 1;
}

function findRule(method: string, path: string): RateLimitRule | undefined {
    const lookup = `${method}:${path}`;

    if (DEFAULT_RULES[lookup]) {
        return DEFAULT_RULES[lookup];
    }

    for (const [pattern, rule] of Object.entries(DEFAULT_RULES)) {
        if (lookup.startsWith(pattern.split(':')[0] + ':' + path.split('/').slice(0, 3).join('/'))) {
            return rule;
        }
    }

    return undefined;
}

export function distributedRateLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
        const identifier = (req as any).user?.id || req.ip || 'anonymous';
        const rule = findRule(req.method, req.path);

        if (!rule) {
            return next();
        }

        try {
            const allowed = await checkRateLimit(identifier, rule);

            if (!allowed) {
                logger.warn(`Rate limit exceeded for ${identifier} on ${req.method} ${req.path}`);
                res.status(429).json({
                    success: false,
                    message: 'Rate limit exceeded. Please try again later.',
                    error: 'RATE_LIMIT_EXCEEDED',
                });
                return;
            }

            next();
        } catch (err: any) {
            logger.error(`Rate limiter error: ${err.message}`);
            next();
        }
    };
}
