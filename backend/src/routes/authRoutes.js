import express from 'express';
import { registerUser, verifyEmail, loginUser, logoutUser, refreshToken, changePassword } from '../controllers/authController.js';
import { registerValidator, loginValidator, validateRequest } from '../middlewares/authValidator.js';
import { protectRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

// The validators fire FIRST. If they fail, validateRequest instantly rejects the API call with a 400 error!
router.post('/register', registerValidator, validateRequest, registerUser);
router.post('/login', loginValidator, validateRequest, loginUser);
router.get('/verify-email', verifyEmail);
// Get a new access token using the HTTP-Only cookie
router.get('/refresh', refreshToken);
// Logout requires the user to be logged in (so we can find their Redis token)
router.post('/logout', protectRoute, logoutUser);
// Zero-Knowledge Password Change
router.post('/change-password', protectRoute, changePassword);

export default router;