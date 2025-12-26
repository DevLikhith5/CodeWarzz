import { getRedisConnObject } from "../config/redis.config";

class CacheService {
    private redis = getRedisConnObject();

    async get<T>(key: string): Promise<T | null> {
        const data = await this.redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as T;
    }

    async set(key: string, value: any, ttlSeconds: number): Promise<void> {
        await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async flush(): Promise<void> {
        await this.redis.flushall();
    }
}

export const cacheService = new CacheService();
