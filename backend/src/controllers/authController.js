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
        /*
            1. httpOnly: true (The XSS-Proof Shield)
            If a hacker manages to inject malicious JavaScript into your React app (this is called an XSS attack), their script will try to steal the user's cookies to hijack their session. By setting httpOnly: true, we are telling Google Chrome/Safari: "NEVER let JavaScript read this cookie." Because of this one line, even if a hacker runs code on your page, they cannot steal the refresh token. Only the browser itself is allowed to hold it and send it to the server.

            2. sameSite: 'strict' (The CSRF Shield)
            Imagine a user logs into SecureShare. Then, they open a new tab and go to evil-hacker.com. The hacker's website might try to secretly ping api.secureshare.com/delete-account in the background. If sameSite wasn't strict, the browser would automatically attach the user's cookie to that malicious request, and the server would delete the account! By setting sameSite: 'strict', we tell the browser: "Only send this cookie if the user is physically looking at the SecureShare.com domain." It completely kills Cross-Site Request Forgery (CSRF) attacks.

            3. secure: process.env.NODE_ENV === 'production' (The HTTPS Enforcer)
            This tells the browser to only send the cookie if the connection is perfectly encrypted with HTTPS. If the connection drops to unencrypted HTTP, the browser will refuse to send the cookie, preventing hackers on a coffee shop WiFi from intercepting it. (We use the process.env variable so that it only enforces HTTPS when the app is actually deployed to production, allowing you to still test it locally on http://localhost).

            4. maxAge: 7 * 24 * 60 * 60 * 1000 (The Self-Destruct Timer)
            This tells the browser to automatically destroy the cookie after exactly 7 days (the math is 7 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds). After 7 days, the user will be forced to log in again.

            Because of those 4 lines of code, your authentication system is practically bulletproof against the two most common web attacks (XSS and CSRF)! 
        */

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
            //Cookies are immune to XSS (hackers stealing the token using malicious scripts). BUT, cookies are highly vulnerable to CSRF (Cross-Site Request Forgery). If your Access Token is in a cookie, a malicious website (evil.com) can trick your browser into making a background request to api.secureshare.com/delete-account. Because cookies are attached automatically by the browser, the browser will blindly attach your Access Token cookie, and the server will delete your account!

            // /Because it is sent in JSON, React stores it in RAM. To use it, React has to manually attach it to the Authorization: Bearer header.
            //Safe from CSRF? YES! A malicious website cannot manually attach Headers. It can only force the browser to send cookies. Because the Access Token requires a manual Header, the CSRF hacker is completely blocked!
            
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