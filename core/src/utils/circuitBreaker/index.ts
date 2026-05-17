export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
    failureThreshold: number;
    recoveryTimeoutMs: number;
    halfOpenMaxAttempts: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    halfOpenMaxAttempts: 3,
};

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime: number | null = null;
    private readonly options: CircuitBreakerOptions;
    public readonly name: string;

    constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
        this.name = name;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    getState(): CircuitState {
        if (this.state === 'OPEN' && this.lastFailureTime) {
            const elapsed = Date.now() - this.lastFailureTime;
            if (elapsed >= this.options.recoveryTimeoutMs) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            }
        }
        return this.state;
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        const state = this.getState();

        if (state === 'OPEN') {
            throw new Error(`Circuit breaker '${this.name}' is OPEN. Service unavailable.`);
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.options.halfOpenMaxAttempts) {
                this.state = 'CLOSED';
            }
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.options.failureThreshold && this.state !== 'OPEN') {
            this.state = 'OPEN';
            // Broadcast state change to the cluster
            if (redis) {
                redis.publish('circuit-breaker:sync', JSON.stringify({ name: this.name, state: 'OPEN' })).catch(() => {});
            }
        }
    }

    forceState(newState: CircuitState): void {
        if (this.state !== newState) {
            this.state = newState;
            if (newState === 'OPEN') {
                this.lastFailureTime = Date.now();
                this.failureCount = this.options.failureThreshold;
            } else if (newState === 'CLOSED') {
                this.failureCount = 0;
                this.successCount = 0;
            }
        }
    }

    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        if (redis) {
            redis.publish('circuit-breaker:sync', JSON.stringify({ name: this.name, state: 'CLOSED' })).catch(() => {});
        }
    }

    getMetrics() {
        return {
            name: this.name,
            state: this.getState(),
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
        };
    }
}

export const circuitBreakerRegistry = new Map<string, CircuitBreaker>();

import { redis } from '../../config/redis.config';
import logger from '../../config/logger.config';

// ── Distributed State Synchronization ──
let subscriberInitialized = false;

function initDistributedSync() {
    if (subscriberInitialized || !redis) return;
    subscriberInitialized = true;
    
    const subscriber = redis.duplicate();
    subscriber.subscribe('circuit-breaker:sync', (err) => {
        if (err) logger.error("Failed to subscribe to distributed circuit breaker sync");
    });

    subscriber.on('message', (channel, message) => {
        if (channel === 'circuit-breaker:sync') {
            try {
                const { name, state } = JSON.parse(message);
                const breaker = circuitBreakerRegistry.get(name);
                if (breaker && breaker.getState() !== state) {
                    breaker.forceState(state);
                    logger.warn(`[Distributed Circuit Breaker] Remote state sync applied`, { name, state });
                }
            } catch (err) {
                logger.error("Failed to parse circuit breaker sync message");
            }
        }
    });
}

export function getCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    initDistributedSync();
    if (!circuitBreakerRegistry.has(name)) {
        circuitBreakerRegistry.set(name, new CircuitBreaker(name, options));
    }
    return circuitBreakerRegistry.get(name)!;
}

export function getAllCircuitBreakers(): CircuitBreaker[] {
    return Array.from(circuitBreakerRegistry.values());
}
