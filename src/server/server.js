const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const connectDB = require('../database/database');
const authRouter = require('../routes/authRouter');
const userRouter = require('../routes/userRouter');
const otpRouter = require('../routes/otpRouter');
const packageRouter = require('../routes/packageRouter');
const pageContentRouter = require('../routes/pageContentRouter');
const mediaRouter = require('../routes/mediaRouter');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'https://nepaltrip.in',
        'https://www.nepaltrip.in'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/otp', otpRouter);
app.use('/api/packages', packageRouter);
app.use('/api/content', pageContentRouter);
app.use('/api/media', mediaRouter);

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is ONLINE at PORT : ${PORT}`);
        });
    } catch (err) {
        console.log("Server initiation failed:", err.message);
    }
};

startServer();