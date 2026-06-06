import User from "../models/User.model.js";
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateRSAKeyPair, encryptPrivateKey } from '../services/encryptionService.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { generateTokens } from '../utils/generateTokens.js';

// 1. Register User (sends verification email)
export const registerUser = async (req , res) => {
    try {
        const {name , email , password} = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message : "User already exists "});

        //Hash current password
        const passwordSalt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, passwordSalt);

        // Heavy Crypto Math
        const { publicKey, privateKey } = generateRSAKeyPair();
        const { encryptedPrivateKey, salt: cryptoSalt } = encryptPrivateKey(privateKey, password);

        // Generate a random email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        //Save User
        const user = new User({
            name,
            email,
            password: hashedPassword,
            publicKey: publicKey,
            privateKey: encryptedPrivateKey,
            salt: cryptoSalt,
            verificationToken: verificationToken,
            isVerified: false
        });

        await user.save();

        //Send the email (runs on background)
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
export const loginUser = async (req , res) => {
    try {
        const { email, password } = req.body;

        // 1. Find user by email
        const user = await User.findOne({ email });
        if(!user) {
            return res.status(401).json({ message: "Invalid email or password" });
    
        }

        // 2. Ensure they have verified their email
        if(!user.isVerified){
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }

        // 3. Check password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 4. Generate Access & Refresh Tokens using our utility
        const { accessToken, refreshToken } = await generateTokens(user._id);

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                publicKey: user.publicKey // We send this to the frontend for future file encryption!
            },
            accessToken,
            refreshToken
        });
    }catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login" });
    }
}