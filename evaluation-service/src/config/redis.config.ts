import IoRedis, { Redis } from 'ioredis';
import { serverConfig } from '.';
import logger from './logger.config';

/**
 * Singleton connection for general Redis operations (caching, pub/sub, etc.)
 */
const connectToRedis = () => {
    logger.info(`Inside Connecting To Redis ${serverConfig.REDIS_URL}`)
    try {
        let connection: Redis;

        return () => {
            if (!connection) {
                connection = new IoRedis(serverConfig.REDIS_URL, { maxRetriesPerRequest: null });
            }
            return connection;
        }
    } catch (err) {
        logger.error(`Error connecting to redis`, { error: err });
        throw err;
    }
}

export const getRedisConnObject = connectToRedis();

/**
 * Creates a NEW Redis connection for BullMQ workers.
 * BullMQ requires dedicated connections because:
 * 1. Workers use blocking commands (BRPOPLPUSH) that monopolize the connection
 * 2. Shared connections cause lock conflicts when multiple replicas are running
 * 
 * IMPORTANT: Each call returns a NEW connection instance.
 */
export const createWorkerConnection = (): Redis => {
    logger.info(`Creating new Redis connection for BullMQ worker`);
    return new IoRedis(serverConfig.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
};