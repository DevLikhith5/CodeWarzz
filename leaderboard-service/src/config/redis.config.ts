import IoRedis, { Redis } from 'ioredis';
import { serverConfig } from '.';
import logger from './logger.config';


const connectToRedis = () => {
    try {
        let connection: Redis;

        return () => {
            if (!connection) {
                connection = new IoRedis(serverConfig.REDIS_URL, { maxRetriesPerRequest: null });

            }
            return connection;
        }
    } catch (err) {
        logger.error(`Error connecting to redis ${err}`);
        throw err;
    }
}

export const getRedisConnObject = connectToRedis();