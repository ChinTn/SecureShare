import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.js';

export const generateTokens = async (userId) => {
    try {
        // 1. Generate Access Token (Expires in 15 minutes)
        // We use a secret key from .env to sign it
        const accessToken = jwt.sign(
            { id: userId }, 
            process.env.JWT_ACCESS_SECRET, 
            { expiresIn: '15m' }
        );

        // 2. Generate Refresh Token (Expires in 7 days)
        const refreshToken = jwt.sign(
            { id: userId }, 
            process.env.JWT_REFRESH_SECRET, 
            { expiresIn: '7d' }
        );

        // 3. Store the Refresh Token in Redis
        // EX 604800 tells Redis to automatically delete this token after 7 days (604,800 seconds)
        await redisClient.set(`refresh:${userId}`, refreshToken, {
            EX: 604800
        });

        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Error generating tokens:", error);
        throw error;
    }
};