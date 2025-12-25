import { Redis } from 'ioredis';
import { serverConfig } from './index';

const connection = new Redis({
    host: serverConfig.REDIS_HOST,
    port: serverConfig.REDIS_PORT,
    maxRetriesPerRequest: null,
});

export default connection;
