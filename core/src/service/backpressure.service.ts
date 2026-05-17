import { redis } from '../config/redis.config';
import logger from '../config/logger.config';

const BACKPRESSURE_PREFIX = 'backpressure:';

export interface BackpressureConfig {
    maxQueueDepth: number;
    warningThreshold: number;
    checkIntervalMs: number;
}

const DEFAULT_CONFIG: BackpressureConfig = {
    maxQueueDepth: 1000,
    warningThreshold: 700,
    checkIntervalMs: 5000,
};

export class BackpressureMonitor {
    private config: BackpressureConfig;
    private isOverloaded = false;

    constructor(config: Partial<BackpressureConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    async checkQueueDepth(queueName: string): Promise<{ depth: number; isOverloaded: boolean; level: 'OK' | 'WARNING' | 'CRITICAL' }> {
        const depth = await redis.llen(`${BACKPRESSURE_PREFIX}${queueName}`);

        let level: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';

        if (depth >= this.config.maxQueueDepth) {
            level = 'CRITICAL';
            this.isOverloaded = true;
        } else if (depth >= this.config.warningThreshold) {
            level = 'WARNING';
            this.isOverloaded = false;
        } else {
            this.isOverloaded = false;
        }

        return { depth, isOverloaded: this.isOverloaded, level };
    }

    isSystemOverloaded(): boolean {
        return this.isOverloaded;
    }

    getBackpressureResponse() {
        return {
            success: false,
            message: 'System is under heavy load. Please retry after a few seconds.',
            error: 'BACKPRESSURE_REJECTED',
            retryAfterMs: this.config.checkIntervalMs * 2,
        };
    }

    startMonitoring(queueNames: string[]) {
        setInterval(async () => {
            for (const queueName of queueNames) {
                const status = await this.checkQueueDepth(queueName);
                if (status.level === 'CRITICAL') {
                    logger.error(`BACKPRESSURE: ${queueName} depth ${status.depth} exceeds max ${this.config.maxQueueDepth}`);
                } else if (status.level === 'WARNING') {
                    logger.warn(`BACKPRESSURE WARNING: ${queueName} depth ${status.depth} approaching limit`);
                }
            }
        }, this.config.checkIntervalMs);

        logger.info(`Backpressure monitor started`, { config: this.config });
    }
}

export const backpressureMonitor = new BackpressureMonitor();
