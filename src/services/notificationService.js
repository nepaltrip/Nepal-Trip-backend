const { getMasterTemplate, sendEmail } = require('./emailService');

const NotificationService = {
    // 1. Welcome Onboarding Email Template Execution
    sendWelcomeEmail: async (userEmail, userName) => {
        try {
            const title = `Welcome to Nepal Trip, ${userName}!`;
            const bodyText = `
                <p>We are absolutely thrilled to welcome you to our community.</p>
                <p>Your account has been securely activated. Get ready to explore handcrafted trekking packages, cultural local experiences, and fully customizable itineraries across Nepal.</p>
            `;
            const actionButtonHtml = `<a href="https://nepaltrip.com/dashboard" class="btn">Explore Dashboard</a>`;

            const compiledHtml = getMasterTemplate(title, bodyText, actionButtonHtml);
            await sendEmail(userEmail, "Welcome to Nepal Trip!", compiledHtml);
        } catch (error) {
            console.error("Error sending welcome email via service:", error.message);
        }
    },

    // 2. Transact OTP Verification Email Template Execution
    sendOtpEmail: async (userEmail, otpCode) => {
        try {
            const title = "Verify Your Account";
            const bodyText = `
                <p>You requested a verification process for your action. Please use the secure authorization code provided below to complete the cycle.</p>
                <div style="background: #f1ede4; padding: 15px; border-radius: 6px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1a3a3a; margin: 20px 0;">
                    ${otpCode}
                </div>
                <p style="font-size: 13px; color: #888888;">This authorization code is strictly sensitive and remains valid for exactly 10 minutes. Do not share this code with anyone.</p>
            `;

            const compiledHtml = getMasterTemplate(title, bodyText);
            await sendEmail(userEmail, `${otpCode} is your Nepal Trip verification code`, compiledHtml);
        } catch (error) {
            console.error("Error sending OTP email via service:", error.message);
        }
    },

    // 3. Password Management Reset Link Template Execution
    sendPasswordResetEmail: async (userEmail, resetLink) => {
        try {
            const title = "Reset Your Password";
            const bodyText = `
                <p>We received a formal request to completely reset the password associated with your account credentials.</p>
                <p>Click the secure interactive terminal button below to configure your brand new password parameters.</p>
            `;
            const actionButtonHtml = `<a href="${resetLink}" class="btn">Reset Password</a>`;

            const compiledHtml = getMasterTemplate(title, bodyText, actionButtonHtml);
            await sendEmail(userEmail, "Reset Your Nepal Trip Password", compiledHtml);
        } catch (error) {
            console.error("Error sending reset email via service:", error.message);
        }
    }
};

module.exports = NotificationService;