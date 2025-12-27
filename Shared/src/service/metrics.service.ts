import client from 'prom-client';

export class MetricsService {
    private static instance: MetricsService;
    private registry: client.Registry;
    private httpRequestDuration: client.Histogram;
    private httpRequestsTotal: client.Counter;
    private dbQueryDuration: client.Histogram;
    private redisOperationDuration: client.Histogram;
    private jobProcessingDuration: client.Histogram;
    private sandboxExecutionDuration: client.Histogram;
    private submissionTotal: client.Counter;
    private verdictTotal: client.Counter;
    private submissionE2EDuration: client.Histogram;
    private queueDepth: client.Gauge;
    private appErrorsTotal: client.Counter;
    private authEventsTotal: client.Counter;
    private contestEventsTotal: client.Counter;
    private problemEventsTotal: client.Counter;
    private leaderboardEventsTotal: client.Counter;
    private userEventsTotal: client.Counter;

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

        this.dbQueryDuration = new client.Histogram({
            name: 'db_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['operation', 'table', 'status'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
        });

        this.redisOperationDuration = new client.Histogram({
            name: 'redis_operation_duration_seconds',
            help: 'Duration of Redis operations in seconds',
            labelNames: ['command', 'status'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
        });

        this.jobProcessingDuration = new client.Histogram({
            name: 'job_processing_duration_seconds',
            help: 'Duration of job processing in seconds',
            labelNames: ['queue_name', 'status', 'job_name'],
            buckets: [0.1, 0.5, 1, 5, 10, 30, 60]
        });

        this.sandboxExecutionDuration = new client.Histogram({
            name: 'sandbox_execution_duration_seconds',
            help: 'Duration of sandbox execution in seconds',
            labelNames: ['language', 'status'],
            buckets: [0.1, 0.5, 1, 2, 5, 10]
        });

        this.submissionTotal = new client.Counter({
            name: 'submission_total',
            help: 'Total number of submissions',
            labelNames: ['language', 'type'] // type: 'submission' or 'run'
        });

        this.verdictTotal = new client.Counter({
            name: 'verdict_total',
            help: 'Total number of verdicts generated',
            labelNames: ['verdict', 'contest_id']
        });

        this.submissionE2EDuration = new client.Histogram({
            name: 'submission_e2e_duration_seconds',
            help: 'End-to-end time from submission creation to evaluation completion',
            labelNames: ['status', 'language'], // status: 'processed', 'failed'
            buckets: [1, 5, 10, 30, 60, 120, 300]
        });

        this.queueDepth = new client.Gauge({
            name: 'app_queue_depth',
            help: 'Number of jobs in queue',
            labelNames: ['queue_name', 'status'] // status: 'waiting', 'active', 'failed', 'delayed'
        });

        this.appErrorsTotal = new client.Counter({
            name: 'app_errors_total',
            help: 'Total number of application errors',
            labelNames: ['type', 'code']
        });

        this.authEventsTotal = new client.Counter({
            name: 'auth_events_total',
            help: 'Total number of authentication events',
            labelNames: ['event', 'status'] // event: 'signin', 'signup', 'session_check', 'refresh', status: 'success', 'failure'
        });

        this.contestEventsTotal = new client.Counter({
            name: 'contest_events_total',
            help: 'Total number of contest events',
            labelNames: ['event', 'status']
        });

        this.problemEventsTotal = new client.Counter({
            name: 'problem_events_total',
            help: 'Total number of problem events',
            labelNames: ['event', 'status']
        });

        this.leaderboardEventsTotal = new client.Counter({
            name: 'leaderboard_events_total',
            help: 'Total number of leaderboard events',
            labelNames: ['event', 'status']
        });

        this.userEventsTotal = new client.Counter({
            name: 'user_events_total',
            help: 'Total number of user events',
            labelNames: ['event', 'status']
        });

        this.registry.registerMetric(this.httpRequestDuration);
        this.registry.registerMetric(this.httpRequestsTotal);
        this.registry.registerMetric(this.dbQueryDuration);
        this.registry.registerMetric(this.redisOperationDuration);
        this.registry.registerMetric(this.jobProcessingDuration);
        this.registry.registerMetric(this.sandboxExecutionDuration);
        this.registry.registerMetric(this.submissionTotal);
        this.registry.registerMetric(this.verdictTotal);
        this.registry.registerMetric(this.submissionE2EDuration);
        this.registry.registerMetric(this.queueDepth);
        this.registry.registerMetric(this.appErrorsTotal);
        this.registry.registerMetric(this.authEventsTotal);
        this.registry.registerMetric(this.contestEventsTotal);
        this.registry.registerMetric(this.problemEventsTotal);
        this.registry.registerMetric(this.leaderboardEventsTotal);
        this.registry.registerMetric(this.userEventsTotal);
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

    public getDbQueryDuration(): client.Histogram {
        return this.dbQueryDuration;
    }

    public getRedisOperationDuration(): client.Histogram {
        return this.redisOperationDuration;
    }

    public getJobProcessingDuration(): client.Histogram {
        return this.jobProcessingDuration;
    }

    public getSandboxExecutionDuration(): client.Histogram {
        return this.sandboxExecutionDuration;
    }

    public getSubmissionTotal(): client.Counter {
        return this.submissionTotal;
    }

    public getVerdictTotal(): client.Counter {
        return this.verdictTotal;
    }

    public getSubmissionE2EDuration(): client.Histogram {
        return this.submissionE2EDuration;
    }

    public getQueueDepth(): client.Gauge {
        return this.queueDepth;
    }

    public getAppErrorsTotal(): client.Counter {
        return this.appErrorsTotal;
    }

    public getAuthEventsTotal(): client.Counter {
        return this.authEventsTotal;
    }

    public getContestEventsTotal(): client.Counter {
        return this.contestEventsTotal;
    }

    public getProblemEventsTotal(): client.Counter {
        return this.problemEventsTotal;
    }

    public getLeaderboardEventsTotal(): client.Counter {
        return this.leaderboardEventsTotal;
    }

    public getUserEventsTotal(): client.Counter {
        return this.userEventsTotal;
    }
}

export const metricsService = MetricsService.getInstance();
