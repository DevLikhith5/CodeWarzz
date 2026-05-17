
import dotenv from 'dotenv';


type ServerConfig = {
    PORT: number,
    REDIS_URL: string,
    RABBITMQ_URL: string,
    JAEGER_URL: string,
}

function loadEnv() {
    dotenv.config();
    console.log(`Environment variables loaded`);
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3003,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://codewarz:codewarz@localhost:5672',
    JAEGER_URL: process.env.JAEGER_URL || 'http://localhost:14268',
};