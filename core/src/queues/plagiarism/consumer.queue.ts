import { consumePlagiarismQueue, MessageHandler } from '../rabbitmq';
import { checkPlagiarism } from '../../service/plagiarism';
import logger from '../../config/logger.config';
import { metricsService } from '../../service/metrics.service';

export const startPlagiarismConsumer = () => {
    logger.info("Starting RabbitMQ plagiarism consumer...");

    const handler: MessageHandler = async (data: any, correlationId: string) => {
        const end = metricsService.getJobProcessingDuration().startTimer({ queue_name: 'plagiarism-queue', job_name: 'check_plagiarism' });

        try {
            const { submissionId, problemId, contestId, code, language } = data;

            if (!submissionId || !problemId || !code || !language) {
                throw new Error("Invalid plagiarism job data");
            }

            logger.info(`Checking plagiarism for submission ${submissionId}`, { problemId, correlationId });

            const result = await checkPlagiarism({
                submissionId,
                problemId,
                contestId,
                code,
                language,
            });

            if (result.isFlagged) {
                logger.warn(`Plagiarism flagged for ${submissionId}`, {
                    similarCount: result.similarSubmissions.length,
                    highestSimilarity: result.similarSubmissions[0]?.similarity,
                });
            } else {
                logger.info(`No plagiarism detected for ${submissionId}`);
            }

            end({ status: 'success' });
        } catch (err: any) {
            logger.error(`Plagiarism check failed: ${err.message}`, { correlationId });
            end({ status: 'error' });
            throw err;
        }
    };

    consumePlagiarismQueue(handler, {
        prefetch: 5,
        maxRetries: 2,
        retryDelayMs: 2000,
    });

    logger.info("RabbitMQ plagiarism consumer started successfully.");
};
