import { metricsService } from "../service/metrics.service";

export const observeDbQuery = async <T>(
    operation: string,
    table: string,
    fn: () => Promise<T>
): Promise<T> => {
    const end = metricsService.getDbQueryDuration().startTimer({ operation, table });
    try {
        const result = await fn();
        end({ status: 'success' });
        return result;
    } catch (error) {
        end({ status: 'failure' });
        throw error;
    }
};
