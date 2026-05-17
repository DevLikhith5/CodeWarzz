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

import { setupRabbitMQTopology } from '../../core/src/queues/rabbitmq';
import { metricsService } from '../../core/src/service/metrics.service';

app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});


async function startServer() {
    try {
        await setupRabbitMQTopology();
        logger.info('RabbitMQ topology initialized');
    } catch (err: any) {
        logger.error('Failed to initialize RabbitMQ topology', { error: err.message });
        process.exit(1);
    }

    startVerdictConsumer();

    app.listen(serverConfig.PORT, () => {
        logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
        logger.info(`Press Ctrl+C to stop the server.`);
    });
}

startServer();
