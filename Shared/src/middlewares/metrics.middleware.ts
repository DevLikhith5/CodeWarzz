import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../service/metrics.service';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const duration = process.hrtime(start);
        const durationInSeconds = duration[0] + duration[1] / 1e9;

        const route = req.route ? req.route.path : req.path;
        const method = req.method;
        const statusCode = res.statusCode;

        // Skip metrics endpoint to avoid noise
        if (route === '/metrics') return;

        metricsService.getHttpRequestDuration().observe(
            { method, route, status_code: statusCode },
            durationInSeconds
        );

        metricsService.getHttpRequestsTotal().inc({
            method,
            route,
            status_code: statusCode
        });
    });

    next();
};
