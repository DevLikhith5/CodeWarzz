import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import logger from './config/logger.config';
const app = express();




import morgan from 'morgan';

const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));
app.use(express.json());

import cookieParser from 'cookie-parser';
app.use(cookieParser());

import { metricsMiddleware } from './middlewares/metrics.middleware';

/**
 * Registering all the routers and their corresponding routes with out app server object.
 */

import { correlationIdMiddleware } from './middlewares/correlation.middleware';

app.use(correlationIdMiddleware);
app.use(metricsMiddleware);
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);


/**
 * Add the error handler middleware
 */

app.use(appErrorHandler);
app.use(genericErrorHandler);


import { metricsService } from './service/metrics.service';

app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});

import { queueMonitorService } from './service/queueMonitor.service';

app.listen(serverConfig.PORT, () => {
    logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
    queueMonitorService.startMonitoring();
    logger.info("SERVER RESTARTED - LOGGING VERIFIED");
    logger.info(`Press Ctrl+C to stop the server.`);
});
