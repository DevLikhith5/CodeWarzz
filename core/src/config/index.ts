// This file contains all the basic configuration logic for the app server to work
import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number,
    DB_URL: string,
    REDIS_URL: string,
    RABBITMQ_URL: string,
    JAEGER_URL: string,
    PLAGIARISM_THRESHOLD: number,
    SERVICE_NAME: string,
}

function loadEnv() {
    dotenv.config();
    console.log(`Environment variables loaded`);
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3001,
    DB_URL: process.env.DATABASE_URL || process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/codewarz',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://codewarz:codewarz@localhost:5672',
    JAEGER_URL: process.env.JAEGER_URL || 'http://localhost:14268',
    PLAGIARISM_THRESHOLD: parseFloat(process.env.PLAGIARISM_THRESHOLD || '0.80'),
    SERVICE_NAME: process.env.SERVICE_NAME || 'core-service',
};