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

// Master Layout HTML Shell (UI Improved, Logo Added, Generic '/' Link as Default)
const getMasterTemplate = (title, bodyText, actionButtonHtml = `<a href="${process.env.FRONTEND_URL}/" class="btn">View in App</a>`) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #FDFBF7; 
                color: #333333; 
            }
            .container { 
                max-width: 600px; 
                margin: 40px auto; 
                background: #ffffff; 
                border-radius: 16px; 
                overflow: hidden; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
                border: 1px solid #e6e0d4; 
            }
            .header { 
                background-color: #2A5244; 
                padding: 30px; 
                text-align: center; 
            }
            .logo { 
                max-height: 50px; 
                margin-bottom: 10px;
            }
            .content { 
                padding: 40px 30px; 
                line-height: 1.6; 
            }
            .title { 
                color: #FA6D16; 
                font-size: 24px; 
                font-weight: 700; 
                margin-top: 0; 
                margin-bottom: 20px; 
            }
            .footer { 
                background-color: #EAE9E6; 
                text-align: center; 
                padding: 20px; 
                font-size: 12px; 
                color: #777777; 
                border-top: 1px solid #e6e0d4; 
            }
            .btn { 
                display: inline-block; 
                padding: 14px 32px; 
                background-color: #FA6D16; 
                color: #ffffff !important; 
                text-decoration: none; 
                border-radius: 12px; 
                font-weight: 700; 
                margin-top: 20px; 
                box-shadow: 0 4px 10px rgba(250, 109, 22, 0.3);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${process.env.FRONTEND_URL}/logo.svg" alt="Nepal Trip Logo" class="logo" onerror="this.style.display='none'" />
                <h2 style="color: #ffffff; margin: 0; letter-spacing: 2px; font-weight: 600;">NEPAL TRIP</h2>
            </div>
            <div class="content">
                <h1 class="title">${title}</h1>
                <div style="font-size: 16px; color: #4a4a4a;">
                    ${bodyText}
                </div>
                ${actionButtonHtml}
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Nepal Trip. All rights reserved.<br>
                CURATED JOURNEYS, UNFORGETTABLE MEMORIES
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