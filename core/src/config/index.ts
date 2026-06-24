import dotenv from 'dotenv';
import logger from './logger.config';

type ServerConfig = {
    PORT: number,
    DB_URL: string,
    REDIS_URL: string,
    RABBITMQ_URL: string,
    RABBITMQ_USER: string,
    RABBITMQ_PASS: string,
    JAEGER_URL: string,
    PLAGIARISM_THRESHOLD: number,
    SERVICE_NAME: string,
}

function loadEnv() {
    dotenv.config();
}

loadEnv();


const isProduction = process.env.NODE_ENV === 'production';
function requiredEnv(name: string, fallback?: string): string {
    const value = process.env[name] || fallback;
    if (!value) {
        if (isProduction) {
            throw new Error(`CRITICAL: ${name} must be set in production`);
        }
        logger.warn(`${name} not set, using fallback`);
    }
    return value || '';
}

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3001,
    DB_URL: process.env.DATABASE_URL || process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/codewarz',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://codewarz:codewarz@localhost:5672',
    RABBITMQ_USER: requiredEnv('RABBITMQ_USER', 'codewarz'),
    RABBITMQ_PASS: requiredEnv('RABBITMQ_PASS', 'codewarz'),
    JAEGER_URL: process.env.JAEGER_URL || 'http://localhost:14268',
    PLAGIARISM_THRESHOLD: parseFloat(process.env.PLAGIARISM_THRESHOLD || '0.80'),
    SERVICE_NAME: process.env.SERVICE_NAME || 'core-service',
};
