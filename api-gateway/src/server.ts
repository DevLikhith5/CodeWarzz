import "dotenv/config";
import express, { Request, Response } from "express";
import proxy from "express-http-proxy";
import cors from "cors";
import helmet from "helmet";
import morgan from 'morgan';
import { rateLimiter } from "./middlewares/rateLimiter";
import { correlationIdMiddleware } from "../../core/src/middlewares/correlation.middleware";

import { metricsService } from "../../core/src/service/metrics.service";
import logger from "./config/logger.config";
import { initTracing } from "./config/tracing";
import { getCircuitBreaker } from "../../core/src/utils/circuitBreaker";
import { distributedRateLimiter } from "../../core/src/middlewares/rateLimiter.middleware";
import { csrfProtection } from "../../core/src/middlewares/csrf.middleware";
import { shutdownCacheMiddleware } from "./middlewares/cache";
import { redis } from "./config/redis.config";
import { installProcessSafetyNet, gracefulShutdown } from "../../core/src/utils/bootstrap";

installProcessSafetyNet('api-gateway');
initTracing();

const app = express();
const PORT = process.env.PORT || 3000;

const coreBreaker = getCircuitBreaker('gateway-core', { failureThreshold: 5, recoveryTimeoutMs: 30000 });
const leaderboardBreaker = getCircuitBreaker('gateway-leaderboard', { failureThreshold: 5, recoveryTimeoutMs: 30000 });


const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || "http://localhost:3001";
const LEADERBOARD_SERVICE_URL = process.env.LEADERBOARD_SERVICE_URL || "http://localhost:3002";


// Configure trust proxy to be conservative. Trusting the entire chain allows
// any client to spoof x-forwarded-for and bypass per-IP rate limits. In dev
// we trust loopback only; in production, set TRUST_PROXY env to a CIDR.
const trustProxy = process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal';
app.set("trust proxy", trustProxy);

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true
}));
const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));

import cookieParser from 'cookie-parser';
app.use(cookieParser());


import { metricsMiddleware } from "../../core/src/middlewares/metrics.middleware";

app.use(correlationIdMiddleware);
app.use(metricsMiddleware);

app.use(rateLimiter({
    maxTokens: 50,
    refillRate: 50 / 60,
}));

app.use(distributedRateLimiter());

// CSRF protection: applied AFTER rate-limiting so that CSRF failures
// count against the rate limit (preventing infinite CSRF probing).
app.use(csrfProtection);

import { bloomFilterMiddleware } from "./middlewares/bloomFilter";
app.use(bloomFilterMiddleware);


app.get("/metrics", async (req: Request, res: Response): Promise<void> => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});


app.get("/health", (req: Request, res: Response): void => {
    res.json({ status: "UP", service: "API Gateway" });
});


import { cacheMiddleware } from "./middlewares/cache";
import { sseRouter, shutdownSse } from "./routes/leaderboard.sse";

app.use("/api/v1/leaderboard/stream", sseRouter);

app.use("/api/v1/leaderboard/live", cacheMiddleware(3), proxy(LEADERBOARD_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = {
            ...proxyReqOpts.headers,
            ...(srcReq.headers["x-correlation-id"] && { "x-correlation-id": srcReq.headers["x-correlation-id"] }),
            ...(srcReq.headers.cookie && { "Cookie": srcReq.headers.cookie })
        };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        // Path is /api/v1/leaderboard/live/:contestId/...
        // Split and pick the first non-empty segment after /live/ as contestId.
        const parts = req.url.split("/").filter(Boolean);
        // parts[0] might be empty (leading slash), e.g. for "live/<id>/..."
        const contestId = parts[1]; // first segment after the leading empty
        if (!contestId || contestId.length === 0) {
            throw new Error("contestId is required for leaderboard live endpoint");
        }
        return `/api/v1/leaderboard/contest/${contestId}/top`;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error: ${err.message}`, { error: err });
        res.status(503).json({
            success: false,
            message: "Leaderboard Service Unavailable",
            error: err.code || "LEADERBOARD_SERVICE_UNAVAILABLE"
        });
    }
}));


app.use("/api/v1/leaderboard/archive", proxy(CORE_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = {
            ...proxyReqOpts.headers,
            ...(srcReq.headers["x-correlation-id"] && { "x-correlation-id": srcReq.headers["x-correlation-id"] }),
            ...(srcReq.headers.cookie && { "Cookie": srcReq.headers.cookie })
        };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        return `/api/v1/leaderboard/archive${req.url}`;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error: ${err.message}`, { error: err });
        res.status(503).json({
            success: false,
            message: "Core Service Unavailable",
            error: err.code || "CORE_SERVICE_UNAVAILABLE"
        });
    }
}));

app.use("/api/v1", proxy(CORE_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = {
            ...proxyReqOpts.headers,
            ...(srcReq.headers["x-correlation-id"] && { "x-correlation-id": srcReq.headers["x-correlation-id"] }),
            ...(srcReq.headers.cookie && { "Cookie": srcReq.headers.cookie })
        };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        return `/api/v1${req.url}`;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error: ${err.message}`, { error: err });
        res.status(503).json({
            success: false,
            message: "Core Service Unavailable",
            error: err.code || "CORE_SERVICE_UNAVAILABLE"
        });
    }
}));

import { appErrorHandler, genericErrorHandler } from "../../core/src/middlewares/error.middleware";

app.use(appErrorHandler);
app.use(genericErrorHandler);

let httpServer: any;

if (require.main === module) {
    httpServer = app.listen(PORT, () => {
        logger.info(`API Gateway is running on http://localhost:${PORT}`);
        logger.info(`Proxying /api/v1/leaderboard -> ${LEADERBOARD_SERVICE_URL}`);
        logger.info(`Proxying /api/v1 (everything else) -> ${CORE_SERVICE_URL}`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) =>
        gracefulShutdown(
            'api-gateway',
            signal,
            [httpServer],
            [
                () => shutdownSse(),
                () => shutdownCacheMiddleware(),
                () => (redis ? redis.quit() : undefined),
            ]
        );
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

export default app;
