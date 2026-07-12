const express = require('express');
const axios = require('axios'); // ✨ FIXED: Standard Node.js CommonJS import
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/token');
const getCookieOptions = require('../config/cookieConfig');
const NotificationService = require('../services/NotificationService');

const authRouter = express.Router();

authRouter.post('/signup', async (req, res) => {
    try {
        const { name, mobile, email, password } = req.body;

        if (!name || !mobile || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { mobile }]
        });

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User with this email or mobile number already exists' });
        }

        const newUser = new User({
            name,
            mobile,
            email: email.toLowerCase(),
            password
        });

        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);

        newUser.refreshTokens.push(refreshToken);

        await newUser.save();

        NotificationService.sendWelcomeEmail(newUser.email, newUser.name).catch((err) => {
            console.error('Background Email Error:', err.message);
        });

        res.cookie('refreshToken', refreshToken, getCookieOptions());

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            accessToken,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages[0] });
        }

        console.error('Signup Controller Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid User credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid User credentials' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.cookie('refreshToken', refreshToken, getCookieOptions());

        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login Controller Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

authRouter.post('/refresh-token', async (req, res) => {
    try {
        const cookies = req.cookies;
        if (!cookies || !cookies.refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token missing' });
        }

        const incomingRefreshToken = cookies.refreshToken;

        const decoded = verifyToken(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.refreshTokens.includes(incomingRefreshToken)) {
            return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        user.refreshTokens = user.refreshTokens.filter(t => t !== incomingRefreshToken);
        user.refreshTokens.push(newRefreshToken);
        await user.save();

        res.cookie('refreshToken', newRefreshToken, getCookieOptions());

        res.status(200).json({
            success: true,
            accessToken: newAccessToken,
            user: { // ✨ Restores user state on page refresh
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePic: user.profilePic || null
            }
        });
    } catch (error) {
        console.error('Refresh Token Controller Error:', error.message);
        return res.status(403).json({ success: false, message: 'Session expired, please login again' });
    }
});

authRouter.post('/logout', async (req, res) => {
    try {
        const cookies = req.cookies;
        if (!cookies || !cookies.refreshToken) {
            return res.status(204).send();
        }

        const currentRefreshToken = cookies.refreshToken;

        await User.updateOne(
            { refreshTokens: currentRefreshToken },
            { $pull: { refreshTokens: currentRefreshToken } }
        );

        res.clearCookie('refreshToken', getCookieOptions());
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout Controller Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

authRouter.post('/google', async (req, res) => {
    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({ success: false, message: 'No access token provided' });
        }

        // 1. Fetch user profile securely from Google
        const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const { email, name, picture, sub: uid } = googleResponse.data;

        // 2. Check if user already exists
        let user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            // Link Google profile to existing user if not already linked
            if (!user.googleId) {
                user.googleId = uid;
                user.authProvider = 'google';
                if (!user.profilePic) user.profilePic = picture;
                await user.save();
            }
        } else {
            // 3. Register New Google User
            user = new User({
                name: name,
                email: email.toLowerCase(),
                authProvider: 'google',
                googleId: uid,
                profilePic: picture
            });
            await user.save();
        }

        // 4. Generate custom standard JWTs
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.cookie('refreshToken', refreshToken, getCookieOptions());

        res.status(200).json({
            success: true,
            message: 'Logged in with Google successfully',
            accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePic: user.profilePic
            }
        });
    } catch (error) {
        // ✨ FIXED: Improved Error Logging to catch DB/Schema issues
        console.error('--- GOOGLE AUTH ROUTE ERROR ---');
        console.error(error);

        if (error.response) {
            return res.status(401).json({
                success: false,
                message: 'Google API Error: ' + (error.response.data.error_description || error.response.data.error || 'Unauthorized')
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: 'DB Validation: ' + messages.join(', ') });
        }

        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'DB Duplicate Key Error on field: ' + Object.keys(error.keyValue)[0] });
        }

        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

module.exports = authRouter;