import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from '../../core/src/middlewares/error.middleware';
import morgan from 'morgan';
import logger from './config/logger.config';
import { correlationIdMiddleware } from '../../core/src/middlewares/correlation.middleware';
import { metricsService } from '../../core/src/service/metrics.service';


const app = express();

const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));
app.use(express.json());

import { metricsMiddleware } from '../../core/src/middlewares/metrics.middleware';
app.use(correlationIdMiddleware);
app.use(metricsMiddleware);
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);




app.use(appErrorHandler);
app.use(genericErrorHandler);

import { queueMonitorService } from '../../core/src/service/queueMonitor.service';
import { getRedisConnObject } from './config/redis.config';
// Monitor submission queue locally for Evaluation Service metrics
queueMonitorService.monitorQueue("submission-queue", getRedisConnObject());

import { startSubmissionConsumer } from './queues/submission/consumer.queue';
startSubmissionConsumer();

app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});


app.listen(serverConfig.PORT, async () => {
    logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
    logger.info(`Press Ctrl+C to stop the server.`);
});
