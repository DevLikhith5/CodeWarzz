import { redis } from '../config/redis.config';
import logger from '../config/logger.config';

const IDEMPOTENCY_PREFIX = 'idempotency:';
const DEFAULT_TTL = 3600;

export async function isIdempotent(key: string): Promise<boolean> {
    const idempotencyKey = `${IDEMPOTENCY_PREFIX}${key}`;
    const exists = await redis.exists(idempotencyKey);
    return exists === 1;
}

export async function markProcessed(key: string, result: any, ttl: number = DEFAULT_TTL): Promise<void> {
    const idempotencyKey = `${IDEMPOTENCY_PREFIX}${key}`;
    await redis.setex(idempotencyKey, ttl, JSON.stringify(result));
    logger.debug(`Marked as processed: ${key}`);
}

export async function getCachedResult(key: string): Promise<any | null> {
    const idempotencyKey = `${IDEMPOTENCY_PREFIX}${key}`;
    const cached = await redis.get(idempotencyKey);
    if (!cached) return null;
    return JSON.parse(cached);
}

export async function withIdempotency<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const alreadyProcessed = await isIdempotent(key);

    if (alreadyProcessed) {
        const cached = await getCachedResult(key);
        logger.info(`Idempotent hit for key: ${key}`);
        return cached as T;
    }

    const result = await fn();
    await markProcessed(key, result, ttl);
    return result;
}

export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
}
