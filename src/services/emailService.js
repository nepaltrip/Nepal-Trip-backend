const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 2525,
    secure: false, // TLS
    auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_SMTP_KEY
    }
});

// Master Layout HTML Shell
const getMasterTemplate = (title, bodyText, actionButtonHtml = '') => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f9f6f0; color: #333333; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e6e0d4; }
            .header { background-color: #1a3a3a; padding: 30px; text-align: center; }
            .logo { max-height: 50px; }
            .content { padding: 40px 30px; line-height: 1.6; }
            .title { color: #e05e2b; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 20px; }
            .footer { background-color: #f1ede4; text-align: center; padding: 20px; font-size: 12px; color: #777777; border-top: 1px solid #e6e0d4; }
            .btn { display: inline-block; padding: 12px 30px; background-color: #e05e2b; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="color: #ffffff; margin: 0; letter-spacing: 1px;">NEPAL TRIP</h2>
            </div>
            <div class="content">
                <h1 class="title">${title}</h1>
                <div style="font-size: 16px; color: #4a4a4a;">
                    ${bodyText}
                </div>
                ${actionButtonHtml}
            </div>
            <div class="footer">
                &copy; 2026 Nepal Trip. All rights reserved.<br>
                Explore the Himalayas with absolute ease.
            </div>
        </div>
    </body>
    </html>
    `;
};

// ✨ Added BCC support for mass broadcasting
const sendEmail = async (to, subject, htmlContent, bcc = null) => {
    const mailOptions = {
        from: `"Nepal Trip" <${process.env.FROM_EMAIL}>`,
        to,
        subject,
        html: htmlContent
    };

    if (bcc) {
        mailOptions.bcc = bcc;
    }

    return transporter.sendMail(mailOptions);
};

module.exports = {
    getMasterTemplate,
    sendEmail
};