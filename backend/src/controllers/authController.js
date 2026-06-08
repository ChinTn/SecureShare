import User from "../models/User.model.js";
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail } from '../services/emailService.js';
import { generateTokens } from '../utils/generateTokens.js';
import AuditLog from '../models/AuditLog.model.js';
import redisClient from '../config/redis.js'; 

export const registerUser = async (req, res) => {
    try {
        const { name, email, password, publicKey, encryptedPrivateKey, pbkdf2Salt } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        const passwordSalt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, passwordSalt);
        
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const user = new User({
            name,
            email,
            password: passwordHash,
            publicKey,
            encryptedPrivateKey,
            pbkdf2Salt,
            verificationToken,
            verificationTokenExpiry,
            isVerified: true // BYPASS EMAIL VERIFICATION
        });

        await user.save();

        // Check if email sends successfully. If it fails, rollback and tell user!
        /* 
        const emailSent = await sendVerificationEmail(user.email, verificationToken);
        if (!emailSent) {
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({ message: "Failed to send verification email. The email provider may have blocked it." });
        }
        */

        // Do not expose MongoDB userId in response!
        res.status(201).json({
            message: "User registered successfully. Please check your email to verify your account."
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
};

export const verifyEmail = async (req , res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ message: "Invalid verification link" });

        const user = await User.findOne({ verificationToken: token });
        if (!user) return res.status(400).json({ message: "Token is invalid" });

        // Check if 24 hours have passed!
        if (user.verificationTokenExpiry < new Date()) {
            await User.findByIdAndDelete(user._id);
            return res.status(400).json({ message: "Verification link expired. Please register again." });
        }

        user.isVerified = true;
        user.verificationToken = undefined; 
        user.verificationTokenExpiry = undefined;
        await user.save();

        res.status(200).json({ message: "Email successfully verified. You can now log in!" });
    } 
    catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ message: "Server error during verification" });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "User does not exist" });
        }

        /*
        if (!user.isVerified) {
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }
        */

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            //update the log
            await AuditLog.create({
                user: user._id,
                action: 'FAILED_LOGIN',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const { accessToken, refreshToken } = await generateTokens(user._id);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'strict', 
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Enhanced Audit Logging
        await AuditLog.create({
            user: user._id,
            action: 'LOGIN',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { email: user.email }
        });

        res.status(200).json({
            message: "Login successful",
            accessToken, 
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                publicKey: user.publicKey,
                encryptedPrivateKey: user.encryptedPrivateKey,
                pbkdf2Salt: user.pbkdf2Salt 
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login" });
    }
};

export const logoutUser = async (req, res) => {
    try {
        // Delete the refresh token from Redis to perfectly kill the session
        await redisClient.del(`refresh:${req.user._id}`);

        // Destroy the HttpOnly cookie on the browser
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'LOGOUT',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Server error during logout" });
    }
};

// Refresh Access Token
export const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.status(401).json({ message: "No refresh token provided" });

        // 1. Verify the cryptographic signature of the cookie
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

        // 2. Check if the token was revoked in Redis (e.g., they clicked Logout on another device)
        const storedToken = await redisClient.get(`refresh:${decoded.id}`);
        if (storedToken !== token) {
            return res.status(403).json({ message: "Invalid or revoked refresh token" });
        }

        // 3. Issue a brand new 15-minute Access Token!
        const accessToken = jwt.sign(
            { id: decoded.id },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({ accessToken });
    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(403).json({ message: "Invalid or expired refresh token" });
    }
};

// 6. Zero-Knowledge Password Change
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, newSalt, newEncryptedPrivateKey } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Verify the old password first!
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            await AuditLog.create({
                user: user._id,
                action: 'FAILED_LOGIN',
                details: 'Failed password change attempt (wrong current password)',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(401).json({ message: "Incorrect current password" });
        }

        // Hash the NEW password
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        // Update the database with all the new Zero-Knowledge crypto data
        user.password = hashedNewPassword;
        user.pbkdf2Salt = newSalt;
        user.encryptedPrivateKey = newEncryptedPrivateKey;

        await user.save();

        await AuditLog.create({
            user: user._id,
            action: 'LOGOUT',
            details: 'Master Password changed successfully. User forced to re-login.',
            ipAddress: req.ip
        });

        // Clear the JWT Session to force a fresh login
        res.cookie('jwt_refresh', '', { httpOnly: true, expires: new Date(0) });
        
        
        res.status(200).json({ message: "Password changed successfully. Please log in again." });
    } catch (error) {
        console.error("Change Password error:", error);
        res.status(500).json({ message: "Server error changing password" });
    }
};