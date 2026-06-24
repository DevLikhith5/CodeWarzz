import logger from '../config/logger.config';

export type SagaStepStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED' | 'COMPENSATION_FAILED';

export interface SagaStep {
    name: string;
    execute: () => Promise<void>;
    compensate: () => Promise<void>;
    status: SagaStepStatus;
}

export class Saga {
    private steps: SagaStep[] = [];
    public readonly transactionId: string;

    constructor(transactionId: string) {
        this.transactionId = transactionId;
    }

    addStep(name: string, execute: () => Promise<void>, compensate: () => Promise<void>): Saga {
        this.steps.push({ name, execute, compensate, status: 'PENDING' });
        return this;
    }

    /**
     * execute() can be called more than once on the same Saga instance
     * (e.g. a caller retries after a network failure). Reset every step
     * to PENDING first so the second run actually re-executes the steps
     * that previously succeeded and re-runs compensation if they fail again.
     */
    async execute(): Promise<void> {
        for (const step of this.steps) {
            step.status = 'PENDING';
        }

        logger.info(`Starting saga ${this.transactionId} with ${this.steps.length} steps`);

        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];

            logger.info(`Saga ${this.transactionId}: executing step ${i + 1}/${this.steps.length} - ${step.name}`);

            try {
                await step.execute();
                step.status = 'COMPLETED';
                logger.info(`Saga ${this.transactionId}: step ${step.name} completed`);
            } catch (err: any) {
                step.status = 'FAILED';
                logger.error(`Saga ${this.transactionId}: step ${step.name} failed: ${err.message}`);

                logger.warn(`Saga ${this.transactionId}: starting compensation from step ${i} backwards`);
                await this.compensate(i);
                throw new Error(`Saga failed at step '${step.name}': ${err.message}`);
            }
        }

        logger.info(`Saga ${this.transactionId}: all steps completed successfully`);
    }

    private async compensate(fromIndex: number): Promise<void> {
        for (let i = fromIndex; i >= 0; i--) {
            const step = this.steps[i];

            // Re-run compensation if the previous attempt failed — this
            // gives idempotent retries for transient compensation errors.
            if (step.status === 'COMPLETED' || step.status === 'COMPENSATION_FAILED') {
                try {
                    logger.info(`Saga ${this.transactionId}: compensating step ${i + 1} - ${step.name}`);
                    await step.compensate();
                    step.status = 'COMPENSATED';
                    logger.info(`Saga ${this.transactionId}: step ${step.name} compensated`);
                } catch (err: any) {
                    step.status = 'COMPENSATION_FAILED';
                    logger.error(`Saga ${this.transactionId}: compensation failed for step ${step.name}: ${err.message}`);
                    // Continue with the next compensation; don't let one
                    // failed compensation block the others.
                }
            }
        }
    }

    getStatus(): { transactionId: string; steps: Array<{ name: string; status: SagaStepStatus }> } {
        return {
            transactionId: this.transactionId,
            steps: this.steps.map((s) => ({ name: s.name, status: s.status })),
        };
    }
}
