import { getRedisConnObject } from "../config/redis.config";

import { metricsService } from "./metrics.service";

class CacheService {
    private redis = getRedisConnObject();

    async get<T>(key: string): Promise<T | null> {
        const end = metricsService.getRedisOperationDuration().startTimer({ command: 'get' });
        try {
            const data = await this.redis.get(key);
            if (!data) {
                end({ status: 'miss' });
                return null;
            }
            end({ status: 'hit' });
            return JSON.parse(data) as T;
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async set(key: string, value: any, ttlSeconds: number): Promise<void> {
        const end = metricsService.getRedisOperationDuration().startTimer({ command: 'set' });
        try {
            await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async del(key: string): Promise<void> {
        const end = metricsService.getRedisOperationDuration().startTimer({ command: 'del' });
        try {
            await this.redis.del(key);
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }

    async flush(): Promise<void> {
        const end = metricsService.getRedisOperationDuration().startTimer({ command: 'flush' });
        try {
            await this.redis.flushall();
            end({ status: 'success' });
        } catch (err) {
            end({ status: 'error' });
            throw err;
        }
    }
}

export const cacheService = new CacheService();
