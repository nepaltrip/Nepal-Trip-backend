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
            const actionButtonHtml = `<a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Explore Dashboard</a>`;

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
    },

    // 4. Admin Alert for New Inquiry Template Execution
    sendAdminInquiryAlertEmail: async (adminEmailsArray, source) => {
        try {
            const title = "New Lead Alert";
            const bodyText = `
                <p>A new inquiry was submitted via the <b>${source || 'General'}</b>.</p>
                <p>Log in to your dashboard to view the details and respond to the traveler.</p>
            `;
            const actionButtonHtml = `<a href="${process.env.FRONTEND_URL}/admin/inquiries" class="btn">View Inquiry</a>`;

            const compiledHtml = getMasterTemplate(title, bodyText, actionButtonHtml);
            await sendEmail(adminEmailsArray.join(','), "New Lead Received - Nepal Trip", compiledHtml);
        } catch (error) {
            console.error("Error sending admin alert email via service:", error.message);
        }
    },

    // 5. Inquiry Reply Email Template Execution
    sendInquiryReplyEmail: async (userEmail, userName, replyMessage) => {
        try {
            const title = "Response to Your Inquiry";
            const bodyText = `
                <p>Hi ${userName},</p>
                <p>Our team has reviewed your inquiry regarding your upcoming trip!</p>
                <div style="background-color: #f9f6f0; padding: 15px; border-left: 4px solid #e05e2b; margin: 20px 0;">
                    <p style="margin: 0; white-space: pre-wrap;">${replyMessage}</p>
                </div>
                <p>If you have further questions, feel free to reply directly to this email.</p>
            `;
            const actionButtonHtml = `<a href="${process.env.FRONTEND_URL}" class="btn">Return to Nepal Trip</a>`;

            const compiledHtml = getMasterTemplate(title, bodyText, actionButtonHtml);
            await sendEmail(userEmail, "Nepal Trip - Inquiry Response", compiledHtml);
        } catch (error) {
            console.error("Error sending inquiry reply email via service:", error.message);
        }
    },

    // ✨ 6. Global Broadcast Email Template Execution
    sendBroadcastEmail: async (bccEmailsArray, broadcastTitle, broadcastMessage) => {
        try {
            const title = "Important Update";
            const bodyText = `
                <p>Hello,</p>
                <p>We have an announcement regarding your Nepal Trip account:</p>
                <div style="background-color: #f9f6f0; padding: 15px; border-left: 4px solid #e05e2b; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1a3a3a;">${broadcastTitle}</h3>
                    <p style="margin: 0; white-space: pre-wrap;">${broadcastMessage}</p>
                </div>
            `;
            const actionButtonHtml = `<a href="${process.env.FRONTEND_URL}" class="btn">Open App</a>`;

            const compiledHtml = getMasterTemplate(title, bodyText, actionButtonHtml);

            // Join the email array into a single comma-separated BCC string
            const bccString = bccEmailsArray.join(',');

            // Send the "To" field directly to the platform's email, and "BCC" everyone else
            await sendEmail(process.env.FROM_EMAIL, broadcastTitle, compiledHtml, bccString);
        } catch (error) {
            console.error("Error sending broadcast email via service:", error.message);
        }
    }
};

module.exports = NotificationService;