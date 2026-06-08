import { body, validationResult } from 'express-validator';

export const registerValidator = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters'),
    body('publicKey').notEmpty().withMessage('Public key is required'),
    body('encryptedPrivateKey').notEmpty().withMessage('Encrypted private key is required'),
    body('pbkdf2Salt').notEmpty().withMessage('Salt is required')
];

export const loginValidator = [
    body('email').trim().isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
];

// Middleware to instantly reject requests that fail validation
export const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    next();
};