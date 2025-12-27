import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import logger from './config/logger.config';
import { attachCorrelationIdMiddleware } from './middlewares/correlation.middleware';
const app = express();
import 'dotenv/config';
import 'dotenv/config';





import morgan from 'morgan';

const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));
app.use(express.json());

import { metricsMiddleware } from './middlewares/metrics.middleware';

/**
 * Registering all the routers and their corresponding routes with out app server object.
 */

app.use(attachCorrelationIdMiddleware);
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

app.listen(serverConfig.PORT, () => {
    logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
    logger.info("SERVER RESTARTED - LOGGING VERIFIED");
    logger.info(`Press Ctrl+C to stop the server.`);
});
