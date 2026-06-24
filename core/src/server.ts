import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import logger from './config/logger.config';
import { initTracing, shutdownTracing } from './tracing';
import { installProcessSafetyNet, gracefulShutdown } from './utils/bootstrap';

installProcessSafetyNet('core');
initTracing();

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

import { correlationIdMiddleware } from './middlewares/correlation.middleware';

app.use(correlationIdMiddleware);
app.use(metricsMiddleware);
app.use(require('./middlewares/csrf.middleware').csrfProtection);
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

app.use(appErrorHandler);
app.use(genericErrorHandler);

import { metricsService } from './service/metrics.service';

app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});

import { getAllCircuitBreakers, shutdownCircuitBreakers } from './utils/circuitBreaker';

app.get("/health/circuit-breakers", (req, res) => {
    const breakers = getAllCircuitBreakers().map(b => b.getMetrics());
    res.json({ success: true, data: breakers });
});

import { getOutboxStats } from './service/outbox.service';

app.get("/health/outbox", async (req, res) => {
    const stats = await getOutboxStats();
    res.json({ success: true, data: stats });
});

import { queueMonitorService } from './service/queueMonitor.service';
import { setupRabbitMQTopology } from './queues/rabbitmq';
import { rabbitMQ } from './queues/rabbitmq/connection';
import { startPlagiarismConsumer } from './queues/plagiarism/consumer.queue';
import { backpressureMonitor } from './service/backpressure.service';
import { hydrateBloomFilters } from './service/bloom.service';
import { redis } from './config/redis.config';

let httpServer: any;
let grpcServer: any;

async function startServer() {
    try {
        await setupRabbitMQTopology();
        logger.info('RabbitMQ topology initialized');
    } catch (err: any) {
        logger.error('Failed to initialize RabbitMQ topology', { error: err.message });
        process.exit(1);
    }

    startPlagiarismConsumer();

    await hydrateBloomFilters();

    const { startGRPCServer } = await import('./grpc/grpc.server');
    const GRPC_PORT = process.env.CORE_GRPC_PORT || 50051;
    grpcServer = startGRPCServer(GRPC_PORT);
    logger.info(`Core gRPC server started on port ${GRPC_PORT}`);

    const { initializeCDC, startCDCListener, startOutboxPoller, stopCDCListener } = await import('./service/outbox.service');
    await initializeCDC();
    await startCDCListener();
    startOutboxPoller();

    backpressureMonitor.startMonitoring(['submission-queue', 'verdict-queue', 'plagiarism-queue']);

    httpServer = app.listen(serverConfig.PORT, () => {
        logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
        queueMonitorService.startMonitoring();
        logger.info(`Press Ctrl+C to stop the server.`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) =>
        gracefulShutdown(
            'core',
            signal,
            [httpServer],
            [
                () => grpcServer?.tryShutdown(() => undefined),
                () => queueMonitorService.stopMonitoring(),
                () => rabbitMQ.close(),
                () => stopCDCListener(),
                () => shutdownCircuitBreakers(),
                () => (redis ? redis.quit() : undefined),
                () => shutdownTracing(),
            ]
        );
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
});
