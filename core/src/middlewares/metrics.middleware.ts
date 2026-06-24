import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../service/metrics.service';


export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();
    let recorded = false;

    const record = () => {
        if (recorded) return;
        recorded = true;
        const duration = process.hrtime(start);
        const durationInSeconds = duration[0] + duration[1] / 1e9;

        // Normalize the route to a low-cardinality template (e.g. /api/v1/users/:id)
        // to prevent Prometheus from being flooded with per-UUID label values.
        let contextRoute = req.route ? (req.baseUrl + req.route.path) : '';

        if (contextRoute.length > 1 && contextRoute.endsWith('/')) {
            contextRoute = contextRoute.slice(0, -1);
        }

        let route = contextRoute;
        const likelyTruncated = contextRoute && !contextRoute.startsWith('/api') && req.originalUrl.startsWith('/api');

        if (!contextRoute || likelyTruncated) {
            const urlPath = req.originalUrl.split('?')[0];
            route = urlPath
                .replace(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/ig, '/:id')
                .replace(/\/(\d+)(\/|$)/g, '/:id$2');
        }

        if (route.length > 1 && route.endsWith('/')) {
            route = route.slice(0, -1);
        }

        const method = req.method;
        const statusCode = res.statusCode;

        if (route === '/metrics' || req.method === 'OPTIONS') return;

        metricsService.getHttpRequestDuration().observe(
            { method, route, status_code: statusCode },
            durationInSeconds
        );

        metricsService.getHttpRequestsTotal().inc({
            method,
            route,
            status_code: statusCode
        });
    };

    // Record on BOTH 'finish' (response sent) and 'close' (client aborted).
    // The guard `recorded` ensures we only count the request once.
    res.on('finish', record);
    res.on('close', record);

    next();
};
