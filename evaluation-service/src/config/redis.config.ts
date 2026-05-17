import IoRedis, { Redis } from 'ioredis';
import { serverConfig } from '.';
import logger from './logger.config';

let redisInstance: Redis | null = null;

export const getRedisConnObject = (): Redis => {
    if (!redisInstance) {
        logger.info(`Connecting To Redis ${serverConfig.REDIS_URL}`);
        redisInstance = new IoRedis(serverConfig.REDIS_URL, { maxRetriesPerRequest: null });

        redisInstance.on('connect', () => logger.info('Redis connected'));
        redisInstance.on('error', (err) => logger.error('Redis error', { error: err.message }));
    }
    return redisInstance;
};

export const redis = getRedisConnObject();
