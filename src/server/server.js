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
const User = require('../models/User');
const socialRouter = require('../routes/socialRouter');
const adminRouter = require('../routes/adminRouter');

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
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    }
});

app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'https://nepaltrip.in', 'https://www.nepaltrip.in'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// ✨ Track Online Users { userId: socketId }
const onlineUsers = new Map();

io.on('connection', (socket) => {
    socket.on('register', async (userData) => {
        if (userData && (userData.id || userData._id)) {
            const userId = (userData.id || userData._id).toString();
            socket.userId = userId; // Attach to socket for the disconnect event

            // 1. Join personal room & admin room
            socket.join(userId);
            if (['Admin', 'SuperAdmin'].includes(userData.role)) {
                socket.join('admin_room');
            }

            // 2. Multi-tab Tracking
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            const userSockets = onlineUsers.get(userId);
            userSockets.add(socket.id);

            // 3. ✨ True Online Trigger: Only fire if this is their FIRST active tab
            if (userSockets.size === 1) {
                try {
                    await User.findByIdAndUpdate(userId, { isOnline: true });
                    io.to('admin_room').emit('user_presence_update', {
                        userId: userId,
                        isOnline: true,
                        lastSeenAt: new Date()
                    });
                } catch (error) {
                    console.error("Failed to set user online:", error);
                }
            }
        }
    });

    socket.on('disconnect', async () => {
        const userId = socket.userId;

        if (userId && onlineUsers.has(userId)) {
            const userSockets = onlineUsers.get(userId);
            userSockets.delete(socket.id); // Remove this specific tab

            // ✨ True Offline Trigger: Only fire if ALL tabs are closed
            if (userSockets.size === 0) {
                onlineUsers.delete(userId);
                const exactExitTime = new Date();

                try {
                    await User.findByIdAndUpdate(userId, {
                        isOnline: false,
                        lastSeenAt: exactExitTime
                    });

                    io.to('admin_room').emit('user_presence_update', {
                        userId: userId,
                        isOnline: false,
                        lastSeenAt: exactExitTime
                    });
                } catch (error) {
                    console.error("Failed to set user offline:", error);
                }
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
app.use('/api/admin', adminRouter);
app.use('/api/superadmin', superAdminRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/social', socialRouter);

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