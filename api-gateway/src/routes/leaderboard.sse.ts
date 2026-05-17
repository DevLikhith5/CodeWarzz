import { Request, Response, Router } from "express";
import { redis } from "../config/redis.conifg";
import logger from "../config/logger.config";
import EventEmitter from "events";

export const sseRouter = Router();

// Global event emitter for SSE updates
const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(5000); // Allow many concurrent SSE connections

// Subscribe to Redis Pub/Sub for leaderboard invalidations
const subscriber = redis.duplicate();
subscriber.subscribe("leaderboard:invalidate", (err) => {
    if (err) logger.error("SSE: Failed to subscribe to invalidation channel", { error: err });
    else logger.info("SSE: Subscribed to leaderboard:invalidate");
});

subscriber.on("message", (channel, message) => {
    if (channel === "leaderboard:invalidate") {
        const contestId = message;
        // Notify all open SSE connections for this contest
        sseEmitter.emit(`update:${contestId}`);
    }
});

/**
 * GET /api/v1/leaderboard/stream/:contestId
 * Establishes a Server-Sent Events (SSE) connection to push real-time leaderboard updates.
 */
sseRouter.get("/:contestId", (req: Request, res: Response) => {
    const { contestId } = req.params;

    // 1. Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering if present

    // 2. Send initial connection heartbeat
    res.write(`data: {"type": "CONNECTED", "contestId": "${contestId}"}\n\n`);

    // 3. Keep-alive heartbeat (every 15s to prevent TCP timeouts)
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 15000);

    // 4. Listener for leaderboard updates
    const updateListener = () => {
        // We send an UPDATE event. The client can then either:
        // A) Consume this event and fetch the latest JSON via standard REST (which hits the L1 cache!)
        // B) We could fetch it here and push the full JSON. 
        // We'll tell the client to refresh, which hits our perfectly optimized Singleflight L1 Cache.
        res.write(`data: {"type": "UPDATE", "timestamp": ${Date.now()}}\n\n`);
    };

    const eventName = `update:${contestId}`;
    sseEmitter.on(eventName, updateListener);

    // 5. Cleanup on client disconnect
    req.on("close", () => {
        clearInterval(heartbeat);
        sseEmitter.off(eventName, updateListener);
    });
});
