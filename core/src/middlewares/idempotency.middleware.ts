import { redis } from '../config/redis.config';
import logger from '../config/logger.config';
import { metricsService } from '../service/metrics.service';

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
    try {
        return JSON.parse(cached);
    } catch {
        return null;
    }
}

/**
 * Atomically claim and execute with idempotency.
 *
 * Uses Redis SET NX EX to claim the slot. The first caller to set the
 * key executes fn(); concurrent callers see the existing key and either
 * get the cached result or wait briefly for it to appear.
 */
export async function withIdempotency<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const idempotencyKey = `${IDEMPOTENCY_PREFIX}${key}`;

    // Try to claim the slot atomically. Value starts as "PENDING".
    const claim = await redis.set(idempotencyKey, '"PENDING"', 'EX', ttl, 'NX');
    if (claim !== 'OK') {
        // Already claimed by another caller; wait for the result.
        const cached = await waitForResult(idempotencyKey, ttl);
        if (cached === null) {
            // Expired before the other caller finished; re-execute
            logger.warn('Idempotency claim expired, re-executing', { key });
            return withIdempotency(key, fn, ttl);
        }
        if (cached === 'PENDING') {
            // Another caller is still working; throw so the queue retries
            throw new Error(`Concurrent execution in progress for ${key}`);
        }
        return cached as T;
    }

    // We won the race; execute the work and store the result.
    try {
        const result = await fn();
        await redis.setex(idempotencyKey, ttl, JSON.stringify(result));
        return result;
    } catch (err) {
        // Free the claim so the next caller can retry. If the del itself
        // fails (e.g. Redis is down) we MUST surface that — a stale claim
        // would cause every retry to be falsely rejected as a duplicate
        // and a real user's request would be dropped on the floor.
        await redis.del(idempotencyKey).catch((delErr) => {
            const message = delErr instanceof Error ? delErr.message : String(delErr);
            logger.error('Failed to release idempotency claim — next retries may be falsely rejected', {
                key,
                error: message,
            });
            try {
                metricsService.getInfraFailuresTotal().inc({
                    operation: 'idempotency_release',
                    target: key,
                });
            } catch {
                // metrics unavailable
            }
        });
        throw err;
    }
}

async function waitForResult(key: string, ttlSeconds: number, maxWaitMs: number = 5000): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const val = await redis.get(key);
        if (val === null) return null;
        if (val !== '"PENDING"') {
            try { return JSON.parse(val); } catch { return val; }
        }
        await new Promise((r) => setTimeout(r, 50));
    }
    return null;
}

export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
}
