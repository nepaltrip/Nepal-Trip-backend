const Otp = require('../models/Otp');
const NotificationService = require('../services/notificationService');

const generateAndSendOTP = async (email) => {
    // 1. Generate a 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save to database (pre-save hook will hash it)
    const newOtp = new Otp({ email, otp: otpCode });
    await newOtp.save();

    // 3. Send via NotificationService (run in background, don't await blocking)
    NotificationService.sendOtpEmail(email, otpCode).catch((err) => {
        console.error('Error sending OTP Email in background:', err.message);
    });

    return true;
};

module.exports = { generateAndSendOTP };