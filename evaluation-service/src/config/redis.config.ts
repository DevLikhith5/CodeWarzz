import IoRedis, { Redis } from 'ioredis';
import { serverConfig } from '.';
import logger from './logger.config';


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