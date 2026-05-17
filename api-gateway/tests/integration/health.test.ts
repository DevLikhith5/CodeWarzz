const BLOOM_FILTER_SIZE = 100000;
const BLOOM_HASHES = 3;

function getBloomOffsets(key: string): number[] {
    const offsets: number[] = [];
    let hash1 = 5381;
    let hash2 = 0;

    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash1 = ((hash1 << 5) + hash1) + char;
        hash2 = ((hash2 << 4) - hash2) ^ char;
    }

    hash1 = Math.abs(hash1);
    hash2 = Math.abs(hash2);

    for (let i = 0; i < BLOOM_HASHES; i++) {
        offsets.push((hash1 + i * hash2) % BLOOM_FILTER_SIZE);
    }

    return offsets;
}

describe("Bloom Filter", () => {
    it("produces a deterministic result for the same key", () => {
        const a = getBloomOffsets("contest-abc-123");
        const b = getBloomOffsets("contest-abc-123");
        expect(a).toEqual(b);
    });

    it("produces exactly BLOOM_HASHES offsets", () => {
        const offsets = getBloomOffsets("some-problem-id");
        expect(offsets).toHaveLength(BLOOM_HASHES);
    });

    it("all offsets are within bounds [0, BLOOM_FILTER_SIZE)", () => {
        const offsets = getBloomOffsets("any-key-value");
        for (const offset of offsets) {
            expect(offset).toBeGreaterThanOrEqual(0);
            expect(offset).toBeLessThan(BLOOM_FILTER_SIZE);
        }
    });

    it("produces different offsets for different keys", () => {
        const a = getBloomOffsets("contest-abc-123");
        const b = getBloomOffsets("contest-xyz-999");
        expect(a).not.toEqual(b);
    });

    it("handles empty string without throwing", () => {
        expect(() => getBloomOffsets("")).not.toThrow();
    });
});

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class TestCircuitBreaker {
    private state: CircuitState = "CLOSED";
    private failureCount = 0;
    private lastFailureTime: number | null = null;

    constructor(private threshold: number, private recoveryMs: number) {}

    getState(): CircuitState {
        if (this.state === "OPEN" && this.lastFailureTime) {
            if (Date.now() - this.lastFailureTime >= this.recoveryMs) {
                this.state = "HALF_OPEN";
            }
        }
        return this.state;
    }

    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.threshold) this.state = "OPEN";
    }

    recordSuccess() {
        this.failureCount = 0;
        if (this.state === "HALF_OPEN") this.state = "CLOSED";
    }
}

describe("Circuit Breaker", () => {
    it("starts in CLOSED state", () => {
        const cb = new TestCircuitBreaker(3, 30000);
        expect(cb.getState()).toBe("CLOSED");
    });

    it("trips to OPEN after hitting failure threshold", () => {
        const cb = new TestCircuitBreaker(3, 30000);
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.getState()).toBe("OPEN");
    });

    it("transitions to HALF_OPEN after recovery timeout", () => {
        const cb = new TestCircuitBreaker(1, 0);
        cb.recordFailure();
        expect(cb.getState()).toBe("HALF_OPEN");
    });

    it("closes again after a successful HALF_OPEN request", () => {
        const cb = new TestCircuitBreaker(1, 0);
        cb.recordFailure();
        cb.getState();
        cb.recordSuccess();
        expect(cb.getState()).toBe("CLOSED");
    });

    it("resets failure count on success", () => {
        const cb = new TestCircuitBreaker(5, 30000);
        cb.recordFailure();
        cb.recordFailure();
        cb.recordSuccess();
        cb.recordFailure();
        expect(cb.getState()).toBe("CLOSED");
    });
});
