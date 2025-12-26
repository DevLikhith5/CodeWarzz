import client from 'prom-client';

export class MetricsService {
    private static instance: MetricsService;
    private registry: client.Registry;
    private httpRequestDuration: client.Histogram;
    private httpRequestsTotal: client.Counter;

    private constructor() {
        this.registry = new client.Registry();
        this.registry.setDefaultLabels({ service: process.env.SERVICE_NAME || 'unknown-service' });
        client.collectDefaultMetrics({ register: this.registry });

        this.httpRequestDuration = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.5, 1, 2, 5]
        });

        this.httpRequestsTotal = new client.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code']
        });

        this.registry.registerMetric(this.httpRequestDuration);
        this.registry.registerMetric(this.httpRequestsTotal);
    }

    public static getInstance(): MetricsService {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService();
        }
        return MetricsService.instance;
    }

    public getRegistry(): client.Registry {
        return this.registry;
    }

    public getHttpRequestDuration(): client.Histogram {
        return this.httpRequestDuration;
    }

    public getHttpRequestsTotal(): client.Counter {
        return this.httpRequestsTotal;
    }
}

export const metricsService = MetricsService.getInstance();
