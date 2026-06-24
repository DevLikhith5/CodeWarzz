import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import morgan from 'morgan';
import logger from './config/logger.config';
import { metricsMiddleware } from '../../core/src/middlewares/metrics.middleware';

import { correlationIdMiddleware } from '../../core/src/middlewares/correlation.middleware';
import { startVerdictConsumer } from './queues/verdict/consumer.queue';
import { initTracing } from '../../core/src/tracing';
import { setupRabbitMQTopology } from '../../core/src/queues/rabbitmq';
import { rabbitMQ } from '../../core/src/queues/rabbitmq/connection';
import { metricsService } from '../../core/src/service/metrics.service';
import { getRedisConnObject } from './config/redis.config';
import { installProcessSafetyNet, gracefulShutdown } from '../../core/src/utils/bootstrap';

installProcessSafetyNet('leaderboard');
initTracing();

const app = express();

const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));
app.use(express.json());

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

    // Awaited to surface setup failures (previously was fire-and-forget)
    await startVerdictConsumer();

    // ── gRPC server — leaderboard service (CQRS write + read endpoints) ──
    const { startLeaderboardGRPCServer } = await import('./grpc/grpc.server');
    const GRPC_PORT = process.env.LEADERBOARD_GRPC_PORT || 50052;
    startLeaderboardGRPCServer(GRPC_PORT);
    logger.info(`Leaderboard gRPC server started on port ${GRPC_PORT}`);

    httpServer = app.listen(serverConfig.PORT, () => {
        logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
        logger.info(`Press Ctrl+C to stop the server.`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) =>
        gracefulShutdown(
            'leaderboard',
            signal,
            [httpServer],
            [
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
