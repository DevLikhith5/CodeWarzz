import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.conifg";
import logger from "../config/logger.config";

export const cacheMiddleware = (ttlSeconds: number) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests
        if (req.method !== "GET") {
            return next();
        }

        const cacheKey = `gateway:cache:${req.originalUrl}`;

        try {
            const cachedResponse = await redis.get(cacheKey);

            if (cachedResponse) {
                res.setHeader("X-Cache", "HIT");
                res.setHeader("Content-Type", "application/json");
                res.send(cachedResponse);
                return;
            }

            res.setHeader("X-Cache", "MISS");

            // Intercept the response to cache it
            const originalSend = res.send;
            res.send = function (body: any): Response {
                // Only cache successful JSON responses
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis.setex(cacheKey, ttlSeconds, body).catch(err => {
                        logger.error("Failed to set cache:", { error: err.message, key: cacheKey });
                    });
                }
                return originalSend.call(this, body);
            };

            next();
        } catch (error) {
            logger.error("Cache middleware error:", { error });
            next();
        }
    };
};
