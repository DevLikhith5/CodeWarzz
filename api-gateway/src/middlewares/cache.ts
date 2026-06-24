import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.config";
import logger from "../config/logger.config";
import { EventEmitter } from "events";
import LRUCache from "lru-cache";

// Singleflight tracker for cache stampede protection
const inFlightRequests = new Map<string, EventEmitter>();

// Bounded L1 in-memory cache. Capped at 5000 entries; entries older than
// 5 minutes are evicted on read. This prevents the previous unbounded
// Map that could OOM the process under diverse URL load.
const L1_MAX_ENTRIES = 5000;
const L1_TTL_MS = 5 * 60 * 1000;
const l1Cache = new LRUCache<string, { data: any, expiresAt: number }>({
    max: L1_MAX_ENTRIES,
    ttl: L1_TTL_MS,
    ttlAutopurge: true,
});

// Subscribe to invalidation events from the Leaderboard service
const subscriber = redis.duplicate();
subscriber.subscribe("leaderboard:invalidate", (err) => {
    if (err) logger.error("Failed to subscribe to L1 invalidation channel", { error: err });
    else logger.info("API Gateway subscribed to L1 cache invalidation events");
});

subscriber.on("message", (channel, message) => {
    if (channel === "leaderboard:invalidate") {
        const contestId = message;
        let purged = 0;
        for (const key of l1Cache.keys()) {
            if (key.includes(contestId)) {
                l1Cache.delete(key);
                purged++;
            }
        }
        if (purged > 0) {
            logger.info("L1 Cache Invalidated via Pub/Sub", { contestId, purgedKeys: purged });
        }
    }
});

export const cacheMiddleware = (ttlSeconds: number) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== "GET") {
            return next();
        }

        const cacheKey = `gateway:cache:${req.originalUrl}`;
        const now = Date.now();

        try {
            // ─── L1 Cache Check (Zero Network I/O) ────────────────────────────────
            const l1Hit = l1Cache.get(cacheKey);
            if (l1Hit && l1Hit.expiresAt > now) {
                res.setHeader("X-Cache", "L1-HIT");
                res.setHeader("Content-Type", "application/json");
                return res.send(l1Hit.data);
            }

            // ─── L2 Cache Check (Redis) ───────────────────────────────────────────
            const cachedResponse = await redis.get(cacheKey);

            if (cachedResponse) {
                // Populate L1 cache on L2 hit
                l1Cache.set(cacheKey, { data: cachedResponse, expiresAt: now + ttlSeconds * 1000 });

                res.setHeader("X-Cache", "L2-HIT");
                res.setHeader("Content-Type", "application/json");
                return res.send(cachedResponse);
            }

            // ─── Singleflight / Request Coalescing ────────────────────────────────
            if (inFlightRequests.has(cacheKey)) {
                res.setHeader("X-Cache", "COALESCED");
                res.setHeader("Content-Type", "application/json");

                const emitter = inFlightRequests.get(cacheKey)!;
                return await new Promise<void>((resolve) => {
                    emitter.once("done", (body: any) => {
                        res.send(body);
                        resolve();
                    });

                    emitter.once("error", () => {
                        res.status(503).json({ success: false, message: "Service Unavailable" });
                        resolve();
                    });
                });
            }

            const emitter = new EventEmitter();
            emitter.setMaxListeners(1000);
            inFlightRequests.set(cacheKey, emitter);

            res.setHeader("X-Cache", "MISS");

            const originalSend = res.send;
            res.send = function (body: any): Response {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Populate L2
                    redis.setex(cacheKey, ttlSeconds, body).catch(err => {
                        logger.error("Failed to set L2 cache:", { error: err.message, key: cacheKey });
                    });

                    // Populate L1
                    l1Cache.set(cacheKey, { data: body, expiresAt: Date.now() + ttlSeconds * 1000 });

                    emitter.emit("done", body);
                } else {
                    emitter.emit("error");
                }

                inFlightRequests.delete(cacheKey);
                return originalSend.call(this, body);
            };

            next();
        } catch (error) {
            logger.error("Cache middleware error:", { error });
            next();
        }
    };
};

export function shutdownCacheMiddleware() {
    if (subscriber && subscriber.status === 'ready') {
        subscriber.quit().catch(() => undefined);
    }
}
