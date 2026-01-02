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

const app = express();
const PORT = process.env.PORT || 3000;


const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || "http://localhost:3001";
const LEADERBOARD_SERVICE_URL = process.env.LEADERBOARD_SERVICE_URL || "http://localhost:3002";


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


app.get("/metrics", async (req: Request, res: Response): Promise<void> => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});


app.get("/health", (req: Request, res: Response): void => {
    res.json({ status: "UP", service: "API Gateway" });
});



app.use("/api/v1/leaderboard/live", proxy(LEADERBOARD_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = {
            ...proxyReqOpts.headers,
            ...(srcReq.headers["x-correlation-id"] && { "x-correlation-id": srcReq.headers["x-correlation-id"] }),
            ...(srcReq.headers.cookie && { "Cookie": srcReq.headers.cookie })
        };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        const contestId = req.url.split("/")[1];
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

app.listen(PORT, () => {
    logger.info(`API Gateway is running on http://localhost:${PORT}`);
    logger.info(`Proxying /api/v1/leaderboard -> ${LEADERBOARD_SERVICE_URL}`);
    logger.info(`Proxying /api/v1 (everything else) -> ${CORE_SERVICE_URL}`);
});
