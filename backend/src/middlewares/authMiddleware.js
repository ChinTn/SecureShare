import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

export const protectRoute = async (req, res, next) => {
    let token;

    // Check if the Authorization header exists and starts with "Bearer"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (Format: "Bearer eyJhbGciOi...")
            token = req.headers.authorization.split(' ')[1];

            // Verify the token using our secret
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

            // Fetch the user from the database and attach it to the request object
            // We use .select('-password -privateKey') so we don't accidentally expose secret data
            req.user = await User.findById(decoded.id).select('-password -privateKey');

            if (!req.user) {
                return res.status(401).json({ message: 'User no longer exists' });
            }

            next(); // Token is valid, move on to the controller!
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};