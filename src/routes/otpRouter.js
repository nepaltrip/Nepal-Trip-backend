const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { generateAndSendOTP } = require('../utils/otpUtils');

const otpRouter = express.Router();

// 1. Send OTP
otpRouter.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Email Id not registered.' });
        }

        if (user.authProvider === 'google') {
            return res.status(400).json({ success: false, message: 'This email is linked to Google Login. Please use Google to sign in.' });
        }

        // ✨ SECURITY 1: Strict 60-Second Cooldown on API level
        const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
        const recentlySentOtp = await Otp.findOne({
            email: email.toLowerCase(),
            createdAt: { $gte: sixtySecondsAgo }
        });

        if (recentlySentOtp) {
            return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another OTP.' });
        }

        // ✨ SECURITY 2: Rate Limiting (Max 5 OTPs per 30 minutes)
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recentOtpsCount = await Otp.countDocuments({
            email: email.toLowerCase(),
            createdAt: { $gte: thirtyMinsAgo }
        });

        if (recentOtpsCount >= 5) {
            return res.status(429).json({ success: false, message: 'Too many requests. Please try again after 30 minutes.' });
        }

        await generateAndSendOTP(email.toLowerCase());

        res.status(200).json({ success: true, message: 'OTP sent to registered email id.' });
    } catch (error) {
        console.error('Send OTP Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 2. Verify OTP
otpRouter.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

        // Find the most recently requested OTP for this email
        const otpRecord = await Otp.findOne({ email: email.toLowerCase() }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new one.' });
        }

        const isValid = await otpRecord.compareOtp(otp);

        // ✨ SECURITY 3: Brute-Force Protection (3 Strikes Rule)
        if (!isValid) {
            otpRecord.attempts += 1;

            if (otpRecord.attempts >= 3) {
                // If they fail 3 times, destroy the OTP. They must wait/request a new one.
                await Otp.findByIdAndDelete(otpRecord._id);
                return res.status(403).json({
                    success: false,
                    message: 'Too many incorrect attempts. This OTP has been revoked. Please request a new one.'
                });
            }

            // Save the incremented attempt count
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                message: `Invalid OTP. You have ${3 - otpRecord.attempts} attempts remaining.`
            });
        }

        // OTP Verified successfully! DELETE it immediately so it can't be reused
        await Otp.deleteMany({ email: email.toLowerCase() });

        // Generate a temporary Reset Token (valid for 15 mins)
        const resetToken = jwt.sign(
            { email: email.toLowerCase(), purpose: 'password_reset' },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({ success: true, message: 'OTP verified successfully.', resetToken });
    } catch (error) {
        console.error('Verify OTP Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = otpRouter;