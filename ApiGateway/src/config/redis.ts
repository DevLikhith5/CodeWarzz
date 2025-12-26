import Redis from "ioredis";

const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
};

const redis = new Redis(redisConfig);

redis.on("error", (err) => {
    console.error("Redis error:", err);
});

export default redis;
