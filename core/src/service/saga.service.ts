import logger from '../config/logger.config';

export type SagaStepStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';

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

    async execute(): Promise<void> {
        logger.info(`Starting saga ${this.transactionId} with ${this.steps.length} steps`);

        try {
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
        } catch (err) {
            throw err;
        }
    }

    private async compensate(fromIndex: number): Promise<void> {
        for (let i = fromIndex; i >= 0; i--) {
            const step = this.steps[i];

            if (step.status === 'COMPLETED') {
                try {
                    logger.info(`Saga ${this.transactionId}: compensating step ${i + 1} - ${step.name}`);
                    await step.compensate();
                    step.status = 'COMPENSATED';
                    logger.info(`Saga ${this.transactionId}: step ${step.name} compensated`);
                } catch (err: any) {
                    step.status = 'FAILED';
                    logger.error(`Saga ${this.transactionId}: compensation failed for step ${step.name}: ${err.message}`);
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
