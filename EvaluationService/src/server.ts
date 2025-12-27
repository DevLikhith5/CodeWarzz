import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import morgan from 'morgan';
import logger from './config/logger.config';
import { requestContextMiddleware } from '../../Shared/src/middlewares/requestContext.middleware';
import { metricsService } from '../../Shared/src/service/metrics.service';


const app = express();

const morganStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

app.use(morgan("combined", { stream: morganStream }));
app.use(express.json());

import { metricsMiddleware } from '../../Shared/src/middlewares/metrics.middleware';
app.use(requestContextMiddleware);
app.use(metricsMiddleware);
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);




app.use(appErrorHandler);
app.use(appErrorHandler);
app.use(genericErrorHandler);

app.get("/metrics", async (req, res) => {
    res.set('Content-Type', metricsService.getRegistry().contentType);
    res.end(await metricsService.getRegistry().metrics());
});


app.listen(serverConfig.PORT, async () => {
    logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
    logger.info(`Press Ctrl+C to stop the server.`);
});
