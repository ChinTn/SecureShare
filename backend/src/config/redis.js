import { createClient } from 'redis';

// Create a Redis client using the URL from your .env file
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Cloud Connected Successfully'));

// Connect to the database
await redisClient.connect();

export default redisClient;