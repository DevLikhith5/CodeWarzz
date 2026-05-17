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

        if (this.failureCount >= this.options.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
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

export function getCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!circuitBreakerRegistry.has(name)) {
        circuitBreakerRegistry.set(name, new CircuitBreaker(name, options));
    }
    return circuitBreakerRegistry.get(name)!;
}

export function getAllCircuitBreakers(): CircuitBreaker[] {
    return Array.from(circuitBreakerRegistry.values());
}
