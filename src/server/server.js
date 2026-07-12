const express = require('express');
const http = require('http'); // ✨ ADDED
const { Server } = require('socket.io'); // ✨ ADDED
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
const inquiryRouter = require('../routes/inquiryRouter');
const galleryRouter = require('../routes/galleryRouter');
const notificationRouter = require('../routes/notificationRouter'); // ✨ ADDED
const { keepServerAwake } = require('../jobs/keepAwake');
const superAdminRouter = require('../routes/superAdminRouter');
const { trackTraffic } = require('../middleware/trafficMiddleware');
const discoverRouter = require('../routes/discoverRouter');

const app = express();
const PORT = process.env.PORT || 5000;

// ✨ Create HTTP server & Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'https://nepaltrip.in',
            'https://www.nepaltrip.in'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
});

app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'https://nepaltrip.in', 'https://www.nepaltrip.in'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// ✨ Track Online Users { userId: socketId }
const onlineUsers = new Map();

io.on('connection', (socket) => {
    socket.on('register', (userData) => {
        if (userData && userData.id) {
            const userId = userData.id.toString();

            // 1. Keep tracking them in the map for quick online/offline checks
            onlineUsers.set(userId, socket.id);

            // 2. ✨ THE FIX: The user joins a personal room using their exact DB ID
            // This ensures if they have 3 tabs open, all 3 tabs join this room.
            socket.join(userId);

            // 3. Group Admins together for mass-broadcasting
            if (userData.role === 'Admin' || userData.role === 'SuperAdmin') {
                socket.join('admin_room');
            }
        }
    });

    socket.on('disconnect', () => {
        for (let [key, value] of onlineUsers.entries()) {
            if (value === socket.id) {
                onlineUsers.delete(key);
                break;
            }
        }
    });
});

// Make io & onlineUsers globally accessible in routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

app.post('/api/analytics/hit', trackTraffic, (req, res) => {
    res.status(200).json({ success: true });
});

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/otp', otpRouter);
app.use('/api/packages', packageRouter);
app.use('/api/content', pageContentRouter);
app.use('/api/media', mediaRouter);
app.use('/api/inquiries', inquiryRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/superadmin', superAdminRouter);
app.use('/api/discover', discoverRouter);

const startServer = async () => {
    try {
        await connectDB();
        // ✨ Use server.listen instead of app.listen
        server.listen(PORT, () => {
            console.log(`Server is ONLINE at PORT : ${PORT}`);
            keepServerAwake();
        });
    } catch (err) {
        console.log("Server initiation failed:", err.message);
    }
};

startServer();