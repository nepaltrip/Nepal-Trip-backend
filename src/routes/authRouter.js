const express = require('express');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/token');
const getCookieOptions = require('../config/cookieConfig');

const authRouter = express.Router();

authRouter.post('/signup', async (req, res) => {
    try {
        const { name, mobile, email, password } = req.body;

        // Keep this basic check to prevent empty requests before hitting the database
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
            password // Mongoose will run validator.isStrongPassword() right here before saving
        });

        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);

        newUser.refreshTokens.push(refreshToken);

        // This is where Mongoose runs the schema validation!
        await newUser.save();

        const NotificationService = require('../services/notificationService');
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
        // ==========================================
        // CATCH MONGOOSE VALIDATION ERRORS (Email/Password format fails)
        // ==========================================
        if (error.name === 'ValidationError') {
            // Extract the specific error message from the Mongoose schema
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
            accessToken: newAccessToken
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

module.exports = authRouter;