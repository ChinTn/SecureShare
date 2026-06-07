import User from "../models/User.model.js";
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateRSAKeyPair, encryptPrivateKey } from '../services/encryptionService.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { generateTokens } from '../utils/generateTokens.js';
import AuditLog from '../models/AuditLog.model.js';

// 1. True Zero-Knowledge Registration
export const registerUser = async (req, res) => {
    try {
        // The React Browser did all the math! It sends the password for bcrypting, 
        // and the keys/salt for storage.
        const { name, email, password, publicKey, encryptedPrivateKey, pbkdf2Salt } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });
        // Hash the password so we don't store it in plaintext
        const passwordSalt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, passwordSalt);
        // Generate a random email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        // Save everything to MongoDB. We NEVER see the plaintext private key!
        const user = new User({
            name,
            email,
            password: passwordHash,
            publicKey,
            encryptedPrivateKey,
            pbkdf2Salt,
            verificationToken: verificationToken,
            isVerified: false
        });
        await user.save();
        // Send the verification email
        sendVerificationEmail(user.email, verificationToken);
        res.status(201).json({
            message: "User registered successfully. Please check your email to verify your account.",
            userId: user._id
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
};


// 2. Verify Email Token
export const verifyEmail = async (req , res) => {
    try {
        const { token } = req.query; // The token comes from the URL: /verify-email?token=123
        if (!token) return res.status(400).json({ message: "Invalid verification link" });

        const user = await User.findOne({ verificationToken: token });
        if (!user) return res.status(400).json({ message: "Token is invalid or has expired" });

        // Mark user as verified and clear the token
        user.isVerified = true;
        user.verificationToken = undefined; // Deletes the token from the database
        await user.save();

        res.status(200).json({ message: "Email successfully verified. You can now log in!" });
    } 
    catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ message: "Server error during verification" });
    }
};

// 3. Login User
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 2. Ensure they have verified their email (Our Custom Feature!)
        if (!user.isVerified) {
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }

        // 3. Check password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 4. Generate Tokens (Utility handles Redis storage)
        const { accessToken, refreshToken } = await generateTokens(user._id);

        // 5. Set Refresh Token as an XSS-proof HttpOnly Cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'strict', 
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        // 6. Log the action for Enterprise Compliance
        await AuditLog.create({
            user: user._id,
            action: 'LOGIN',
            details: 'User successfully logged in'
        });

        // 7. Return the data the Browser needs for E2EE Math!
        res.status(200).json({
            message: "Login successful",
            accessToken, 
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                publicKey: user.publicKey,
                
                // CRITICAL FOR E2EE: We send these so React can unlock the keys!
                encryptedPrivateKey: user.encryptedPrivateKey,
                pbkdf2Salt: user.pbkdf2Salt 
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login" });
    }
};