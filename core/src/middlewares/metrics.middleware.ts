import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../service/metrics.service';


export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const duration = process.hrtime(start);
        const durationInSeconds = duration[0] + duration[1] / 1e9;

        // console.log("req.route: ",req.route)
        // console.log("req.baseUrl: ",req.baseUrl)
        // console.log("req.originalUrl: ",req.originalUrl)

        //Doing Noramlization for promethous otherwise there will be somany and our prom will be bloated

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
    });

    next();
};
