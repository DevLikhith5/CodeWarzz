import IoRedis, { Redis } from 'ioredis';
import { serverConfig } from '.';


const connectToRedis = () => {
    console.log(`Inside Connecting To Redis ${serverConfig.REDIS_URL}`)
    try{
        let connection: Redis;

        return () => {  
            if(!connection){
                connection = new IoRedis(serverConfig.REDIS_URL,{maxRetriesPerRequest: null});   

            }
            return connection;
        }
    }catch(err){
        console.log(`Error connecting to redis ${err}`);
        throw err;
    }
}

export const getRedisConnObject = connectToRedis();