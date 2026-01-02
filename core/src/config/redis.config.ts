import IoRedis, { Redis } from "ioredis";
import { serverConfig } from ".";
import logger from "./logger.config";

class RedisClient {
    private static instance: Redis | null = null;

    private constructor() {} 

    static getInstance(): Redis {
        if (!RedisClient.instance) {
            logger.info(`Connecting to Redis → ${serverConfig.REDIS_URL}`);

            RedisClient.instance = new IoRedis(serverConfig.REDIS_URL, {
                maxRetriesPerRequest: null,
            });

            RedisClient.instance.on("connect", () =>
                logger.info("Redis connected")
            );

            RedisClient.instance.on("error", (err) =>
                logger.error("Redis error", { error: err })
            );
        }

        return RedisClient.instance;
    }
}

export const redis = RedisClient.getInstance();
