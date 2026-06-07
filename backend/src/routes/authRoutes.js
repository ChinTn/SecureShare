import express from 'express';
import { registerUser, verifyEmail, loginUser } from '../controllers/authController.js';

const router = express.Router();

// Route: POST /api/auth/register
router.post('/register', registerUser);
// Route: POST /api/auth/login
router.post('/login', loginUser);
// Route: GET /api/auth/verify-email
router.get('/verify-email', verifyEmail);

export default router;