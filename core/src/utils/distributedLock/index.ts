import { redis } from '../../config/redis.config';
import logger from '../../config/logger.config';
import { v4 as uuidv4 } from 'uuid';

const LOCK_PREFIX = 'lock:';

export class DistributedLock {
    private lockKey: string;
    private lockValue: string;
    private ttlMs: number;

    constructor(resource: string, ttlMs: number = 10000) {
        this.lockKey = `${LOCK_PREFIX}${resource}`;
        this.lockValue = uuidv4();
        this.ttlMs = ttlMs;
    }

    async acquire(): Promise<boolean> {
        const result = await redis.set(this.lockKey, this.lockValue, 'PX', this.ttlMs, 'NX');
        const acquired = result === 'OK';

        if (acquired) {
            logger.debug(`Lock acquired: ${this.lockKey}`, { value: this.lockValue });
        } else {
            logger.debug(`Lock not available: ${this.lockKey}`);
        }

        return acquired;
    }

    async release(): Promise<boolean> {
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;

        const result = await redis.eval(script, 1, this.lockKey, this.lockValue);
        const released = result === 1;

        if (released) {
            logger.debug(`Lock released: ${this.lockKey}`);
        } else {
            logger.warn(`Lock release failed (may have expired): ${this.lockKey}`);
        }

        return released;
    }

    async extend(additionalMs: number): Promise<boolean> {
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("pexpire", KEYS[1], ARGV[2])
            else
                return 0
            end
        `;

        const result = await redis.eval(script, 1, this.lockKey, this.lockValue, additionalMs.toString());
        return result === 1;
    }

    async isHeld(): Promise<boolean> {
        const value = await redis.get(this.lockKey);
        return value === this.lockValue;
    }

    getKey(): string {
        return this.lockKey;
    }

    getValue(): string {
        return this.lockValue;
    }
}

export async function withDistributedLock<T>(
    resource: string,
    fn: () => Promise<T>,
    ttlMs: number = 10000
): Promise<T> {
    const lock = new DistributedLock(resource, ttlMs);

    const acquired = await lock.acquire();
    if (!acquired) {
        throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
        return await fn();
    } finally {
        await lock.release();
    }
}
