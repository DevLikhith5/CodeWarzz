import express from "express";
import proxy from "express-http-proxy";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { rateLimiter } from "./middlewares/rateLimiter";
import { requestContextMiddleware } from "../../Shared/src/middlewares/requestContext.middleware";
import { metricsService } from "../../Shared/src/service/metrics.service";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


const SHARED_SERVICE_URL = process.env.SHARED_SERVICE_URL || "http://localhost:3001";
const LEADERBOARD_SERVICE_URL = process.env.LEADERBOARD_SERVICE_URL || "http://localhost:3002";


app.use(helmet());
app.use(cors());
app.use(morgan("dev"));


app.use(rateLimiter({
    maxTokens: 100, 
    refillRate: 100 / 60, 
}));


app.use(requestContextMiddleware as unknown as express.RequestHandler);


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
    }
}));


app.use("/api/v1/leaderboard/archive", proxy(SHARED_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = { ...proxyReqOpts.headers, "x-correlation-id": srcReq.headers["x-correlation-id"] };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        return `/api/v1/leaderboard/archive${req.url}`;
    }
}));
app.use("/api/v1", proxy(SHARED_SERVICE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers = { ...proxyReqOpts.headers, "x-correlation-id": srcReq.headers["x-correlation-id"] };
        return proxyReqOpts;
    },
    proxyReqPathResolver: (req) => {
        return `/api/v1${req.url}`;
    }
}));

app.listen(PORT, () => {
    console.log(`API Gateway is running on http://localhost:${PORT}`);
    console.log(`Proxying /api/v1/leaderboard -> ${LEADERBOARD_SERVICE_URL}`);
    console.log(`Proxying /api/v1 (everything else) -> ${SHARED_SERVICE_URL}`);
});
