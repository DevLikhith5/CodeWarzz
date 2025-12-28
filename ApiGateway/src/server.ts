import "dotenv/config";
import express from "express";
import proxy from "express-http-proxy";
import cors from "cors";
import helmet from "helmet";
import morgan from 'morgan';
import { rateLimiter } from "./middlewares/rateLimiter";
import { requestContextMiddleware } from "../../Shared/src/middlewares/requestContext.middleware";
import { metricsService } from "../../Shared/src/service/metrics.service";
import logger from "./config/logger.config";

const app = express();
const PORT = process.env.PORT || 3000;


const SHARED_SERVICE_URL = process.env.SHARED_SERVICE_URL || "http://localhost:3001";
const LEADERBOARD_SERVICE_URL = process.env.LEADERBOARD_SERVICE_URL || "http://localhost:3002";


app.use(helmet());
app.use(cors());
const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));




import { metricsMiddleware } from "../../Shared/src/middlewares/metrics.middleware";

app.use(requestContextMiddleware as unknown as express.RequestHandler);
app.use(metricsMiddleware as unknown as express.RequestHandler);

app.use(rateLimiter({
    maxTokens: 20,
    refillRate: 20 / 60,
}));


app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});


app.get("/health", (req, res) => {
    res.json({ status: "UP", service: "API Gateway" });
});



app.use("/api/v1/leaderboard/live", proxy(LEADERBOARD_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = { ...proxyReqOpts.headers, "x-correlation-id": srcReq.headers["x-correlation-id"] };
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
            message: "Service Unavailable",
            error: err.code || "SERVICE_UNAVAILABLE"
        });
    }
}));


app.use("/api/v1/leaderboard/archive", proxy(SHARED_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = { ...proxyReqOpts.headers, "x-correlation-id": srcReq.headers["x-correlation-id"] };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        return `/api/v1/leaderboard/archive${req.url}`;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error: ${err.message}`, { error: err });
        res.status(503).json({
            success: false,
            message: "Service Unavailable",
            error: err.code || "SERVICE_UNAVAILABLE"
        });
    }
}));
app.use("/api/v1", proxy(SHARED_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = { ...proxyReqOpts.headers, "x-correlation-id": srcReq.headers["x-correlation-id"] };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        return `/api/v1${req.url}`;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Proxy error: ${err.message}`, { error: err });
        res.status(503).json({
            success: false,
            message: "Service Unavailable",
            error: err.code || "SERVICE_UNAVAILABLE"
        });
    }
}));

import { appErrorHandler, genericErrorHandler } from "../../Shared/src/middlewares/error.middleware";

app.use(appErrorHandler as unknown as express.ErrorRequestHandler);
app.use(genericErrorHandler as unknown as express.ErrorRequestHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway is running on http://localhost:${PORT}`);
    logger.info(`Proxying /api/v1/leaderboard -> ${LEADERBOARD_SERVICE_URL}`);
    logger.info(`Proxying /api/v1 (everything else) -> ${SHARED_SERVICE_URL}`);
});
