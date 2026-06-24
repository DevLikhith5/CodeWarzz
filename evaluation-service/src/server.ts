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
import { initTracing } from '../../core/src/tracing';
import { setupRabbitMQTopology } from '../../core/src/queues/rabbitmq';
import { rabbitMQ } from '../../core/src/queues/rabbitmq/connection';
import { startSubmissionConsumer } from './queues/submission/consumer.queue';
import { setupSnapshotCron, stopSnapshotCron } from './cron/leaderboardSnapshot.cron';
import { getRedisConnObject } from './config/redis.config';
import { installProcessSafetyNet, gracefulShutdown } from '../../core/src/utils/bootstrap';

installProcessSafetyNet('evaluation-service');
initTracing();

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

app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});

let httpServer: any;

async function startServer() {
    try {
        await setupRabbitMQTopology();
        logger.info('RabbitMQ topology initialized');
    } catch (err: any) {
        logger.error('Failed to initialize RabbitMQ topology', { error: err.message });
        process.exit(1);
    }

    await startSubmissionConsumer();
    await setupSnapshotCron();

    httpServer = app.listen(serverConfig.PORT, () => {
        logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
        logger.info(`Press Ctrl+C to stop the server.`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) =>
        gracefulShutdown(
            'evaluation-service',
            signal,
            [httpServer],
            [
                () => stopSnapshotCron(),
                () => rabbitMQ.close(),
                () => {
                    const redis = getRedisConnObject();
                    return redis ? redis.quit() : undefined;
                },
            ]
        );
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
});
