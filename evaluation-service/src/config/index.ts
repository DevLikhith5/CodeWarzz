
import dotenv from 'dotenv';


type ServerConfig = {
    PORT: number,
    REDIS_URL: string,
}

function loadEnv() {
    dotenv.config();
    console.log(`Environment variables loaded`);
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3003,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};