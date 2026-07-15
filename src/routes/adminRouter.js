const express = require('express');
const adminRouter = express.Router();
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const Traffic = require('../models/Traffic');
const Package = require('../models/Package');
const { userAuth, adminAuth } = require('../middleware/authMiddleware');
const { sendWebPush } = require('../services/pushService');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const Broadcast = require('../models/Broadcast');
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const assetsS3Client = require('../config/cloudflareAssetsS3');

// ==========================================
// GET: DASHBOARD METRICS COUNTERS
// ==========================================
adminRouter.get('/dashboard-counters', userAuth, adminAuth, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totalInquiries, pendingReplies, recentInquiriesRaw, uniqueVisitorHashes] = await Promise.all([
            Inquiry.countDocuments(),
            Inquiry.countDocuments({ status: { $ne: 'replied' } }),
            Inquiry.find().sort({ createdAt: -1 }).limit(20),
            Traffic.distinct('ipHash', { createdAt: { $gte: thirtyDaysAgo } })
        ]);

        const recentInquiries = recentInquiriesRaw.map(inq => ({
            id: inq._id,
            name: inq.formData.name || 'Anonymous',
            subject: inq.source || 'General Inquiry',
            date: new Date(inq.createdAt).toLocaleDateString(),
            status: inq.status === 'replied' ? 'replied' : 'pending'
        }));

        res.status(200).json({
            uniqueVisitors: uniqueVisitorHashes.length,
            totalInquiries,
            pendingReplies,
            recentInquiries
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
});

// ==========================================
// GET: FETCH BASELINE PACKAGE ANALYTICS
// ==========================================
adminRouter.get('/package-analytics', userAuth, adminAuth, async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const packages = await Package.find({ isActive: true }).select('_id title').lean();

        const userStats = await User.aggregate([
            { $unwind: "$crmActivity" },
            { $match: { "crmActivity.totalClicks": { $gt: 0 } } },
            {
                $addFields: {
                    "recentLogs": {
                        $filter: {
                            input: { $ifNull: ["$crmActivity.recentLogs", []] },
                            as: "log",
                            cond: { $gte: ["$$log.timestamp", sevenDaysAgo] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    sevenDayTotalTime: { $sum: "$recentLogs.durationAdded" },
                    sevenDayClicksOnThisPackage: {
                        $size: {
                            $filter: { input: "$recentLogs", as: "log", cond: { $eq: ["$$log.actionType", "click"] } }
                        }
                    },
                    tiersRaw: [
                        {
                            tier: "Gold",
                            allTimeSeconds: { $ifNull: ["$crmActivity.timeSpentGold", 0] },
                            sevenDaySeconds: { $sum: { $map: { input: { $filter: { input: "$recentLogs", as: "log", cond: { $eq: ["$$log.tier", "Gold"] } } }, as: "log", in: "$$log.durationAdded" } } }
                        },
                        {
                            tier: "Platinum",
                            allTimeSeconds: { $ifNull: ["$crmActivity.timeSpentPlatinum", 0] },
                            sevenDaySeconds: { $sum: { $map: { input: { $filter: { input: "$recentLogs", as: "log", cond: { $eq: ["$$log.tier", "Platinum"] } } }, as: "log", in: "$$log.durationAdded" } } }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    tiers: {
                        $filter: { input: "$tiersRaw", as: "t", cond: { $gt: [{ $add: ["$$t.allTimeSeconds", "$$t.sevenDaySeconds"] }, 0] } }
                    }
                }
            },
            {
                $group: {
                    _id: "$crmActivity.packageId",
                    allTimeClicks: { $sum: "$crmActivity.totalClicks" },
                    sevenDayClicks: { $sum: "$sevenDayClicksOnThisPackage" },
                    allTimeTotalTime: { $sum: { $add: [{ $ifNull: ["$crmActivity.timeSpentGold", 0] }, { $ifNull: ["$crmActivity.timeSpentPlatinum", 0] }, { $ifNull: ["$crmActivity.timeSpentOutside", 0] }] } },
                    sevenDayTotalTime: { $sum: "$sevenDayTotalTime" },
                    users: {
                        $push: {
                            userId: "$_id",
                            name: "$name",
                            email: "$email",
                            phone: "$mobile",
                            photo: "$profilePic",
                            status: "$status",
                            role: "$role",
                            isOnline: "$isOnline",
                            totalVisits: "$totalPackageVisits",
                            lastSeen: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$crmActivity.lastActiveAt" } },
                            mostViewed: "$mostViewedPackageName",
                            topVibe: "$topVibe",
                            totalClicksOnThisPackage: "$crmActivity.totalClicks",
                            sevenDayClicksOnThisPackage: "$sevenDayClicksOnThisPackage",
                            tiers: "$tiers"
                        }
                    }
                }
            }
        ]);

        const formattedData = packages.map(pkg => {
            const stats = userStats.find(u => u._id.toString() === pkg._id.toString());
            let topUsers = [];
            if (stats && stats.users && stats.users.length > 0) {
                topUsers = stats.users
                    .sort((a, b) => b.sevenDayTotalTime - a.sevenDayTotalTime)
                    .slice(0, 10)
                    .map(u => ({
                        id: u.userId,
                        userId: u.userId,
                        name: u.name,
                        email: u.email,
                        phone: u.phone || "No phone",
                        photo: u.photo || (u.name ? u.name.charAt(0).toUpperCase() : 'U'),
                        status: u.status || 'active',
                        role: u.role || 'User',
                        isOnline: u.isOnline || false,
                        totalVisits: u.totalVisits || 0,
                        lastSeen: u.lastSeen || "N/A",
                        mostViewed: u.mostViewed || "None",
                        topVibe: u.topVibe || "None",
                        totalClicksOnThisPackage: u.totalClicksOnThisPackage,
                        sevenDayClicksOnThisPackage: u.sevenDayClicksOnThisPackage,
                        tiers: u.tiers,
                        leadScore: u.sevenDayTotalTime > 30 ? "Hot" : "Warm"
                    }));
            }

            return {
                packageId: pkg._id,
                name: pkg.title,
                allTimeClicks: stats ? stats.allTimeClicks : 0,
                sevenDayClicks: stats ? stats.sevenDayClicks : 0,
                allTimeTotalTime: stats ? stats.allTimeTotalTime : 0,
                sevenDayTotalTime: stats ? stats.sevenDayTotalTime : 0,
                topUsers: topUsers
            };
        });

        res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
        console.error("Failed to fetch package analytics:", error);
        res.status(500).json({ success: false, message: "Analytics fetch failed" });
    }
});

// ==========================================
// GET: ALL USERS LIST (REAL-TIME DASHBOARD)
// ==========================================
adminRouter.get('/users', userAuth, adminAuth, async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password -refreshTokens')
            .sort({ isOnline: -1, lastSeenAt: -1, createdAt: -1 })
            .lean();

        const formattedUsers = users.map(u => ({
            id: u._id,
            name: u.name || 'Unknown',
            email: u.email || 'N/A',
            phone: u.mobile || 'N/A',
            location: u.district && u.state ? `${u.district}, ${u.state}` : (u.location?.coordinates ? 'Has Coordinates' : 'Unknown'),
            status: u.status || 'active',
            isOnline: u.isOnline || false,
            lastSeenAt: u.lastSeenAt || u.updatedAt,
            role: u.role,
            profilePic: u.profilePic,
            mostViewed: u.mostViewedPackageName || 'None',
            topVibe: u.topVibe || 'None',
            leadScore: (u.crmActivity && u.crmActivity.length > 0) ? 'Hot' : 'Warm',
            joinDate: u.createdAt,
            active24h: u.isOnline || (u.lastSeenAt && (new Date() - new Date(u.lastSeenAt)) < 24 * 60 * 60 * 1000)
        }));

        res.status(200).json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error("Failed to fetch users:", error);
        res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
});

// ==========================================
// GET: LIGHTWEIGHT USERS LIST (For Dropdowns)
// ==========================================
adminRouter.get('/users-list', userAuth, adminAuth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select('name email role isOnline')
            .sort({ name: 1 })
            .lean();

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Failed to fetch users list:", error);
        res.status(500).json({ success: false, message: "Failed to fetch users list" });
    }
});

// ==========================================
// POST: SEND GLOBAL BROADCAST
// ==========================================
adminRouter.post('/broadcast', userAuth, adminAuth, async (req, res) => {
    try {
        const { title, message, audience, type, specificUserId, state, district } = req.body;

        let query = { _id: { $ne: req.user.id } };

        if (audience === 'users') query.role = 'User';
        if (audience === 'admins') query.role = { $in: ['Admin', 'SuperAdmin'] };
        if (audience === 'online') query.isOnline = true;

        if (audience === 'specific' && specificUserId) {
            query._id = specificUserId;
        } else {
            if (state) query.state = state;
            if (district) query.district = district;
        }

        const targetUsers = await User.find(query).select('_id email');

        if (targetUsers.length === 0) {
            return res.status(404).json({ message: "No users matched the selected audience and location criteria." });
        }

        const io = req.app.get('io');
        const onlineUsersMap = req.app.get('onlineUsers');

        const notificationsToInsert = [];
        const webPushPromises = [];

        targetUsers.forEach(user => {
            const userIdStr = user._id.toString();

            notificationsToInsert.push({
                recipient: user._id,
                title: title,
                message: message,
                type: type || 'system',
            });

            if (!onlineUsersMap || !onlineUsersMap.has(userIdStr)) {
                webPushPromises.push(
                    sendWebPush(user._id, title, message, "/")
                );
            }
        });

        const savedNotifications = await Notification.insertMany(notificationsToInsert);

        if (io && onlineUsersMap) {
            savedNotifications.forEach(notification => {
                const recipientStr = notification.recipient.toString();
                if (onlineUsersMap.has(recipientStr)) {
                    io.to(recipientStr).emit('new_notification', notification);
                }
            });
        }

        if (webPushPromises.length > 0) {
            Promise.allSettled(webPushPromises).catch(console.error);
        }

        const targetEmails = targetUsers.map(user => user.email).filter(Boolean);
        if (targetEmails.length > 0) {
            notificationService.sendBroadcastEmail(targetEmails, title, message).catch(console.error);
        }

        const sender = await User.findById(req.user.id).select('name role');

        const broadcastHistory = new Broadcast({
            sender: sender._id,
            senderName: sender.name,
            senderRole: sender.role,
            title,
            message,
            alertType: type || 'system',
            targetAudience: audience,
            specificUserId: specificUserId || null,
            targetState: audience !== 'specific' ? (state || '') : '',
            targetDistrict: audience !== 'specific' ? (district || '') : '',
            recipientCount: targetUsers.length
        });

        await broadcastHistory.save();

        res.status(200).json({
            success: true,
            message: "Broadcast deployed",
            recipientCount: targetUsers.length,
            broadcastId: broadcastHistory._id
        });

    } catch (error) {
        console.error("Broadcast failed:", error);
        res.status(500).json({ message: "Failed to send broadcast" });
    }
});

// ==========================================
// GET: BROADCAST HISTORY
// ==========================================
adminRouter.get('/broadcast-history', userAuth, adminAuth, async (req, res) => {
    try {
        const history = await Broadcast.find()
            .populate('specificUserId', 'name email role')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        console.error("Failed to fetch broadcast history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load broadcast history"
        });
    }
});

// ==========================================
// ROUTE: Update Admin Profile
// ==========================================
adminRouter.put('/profile', userAuth, adminAuth, async (req, res) => {
    try {
        const { name, email, profilePic } = req.body;
        const adminId = req.user.id;

        const targetAdmin = await User.findById(adminId);

        if (!targetAdmin) {
            return res.status(404).json({ success: false, message: "Admin account not found." });
        }

        const oldProfilePic = targetAdmin.profilePic;

        if (name) targetAdmin.name = name.trim();
        if (email) targetAdmin.email = email.trim().toLowerCase();

        if (profilePic !== undefined && profilePic !== oldProfilePic) {
            targetAdmin.profilePic = profilePic;

            if (oldProfilePic) {
                try {
                    const publicUrlBase = process.env.R2_ASSETS_PUBLIC_URL || "";
                    let fileKey = oldProfilePic;

                    if (publicUrlBase && oldProfilePic.startsWith(publicUrlBase)) {
                        fileKey = oldProfilePic.replace(`${publicUrlBase}/`, '');
                    } else {
                        const urlObj = new URL(oldProfilePic);
                        fileKey = urlObj.pathname.substring(1);
                    }

                    await assetsS3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.R2_ASSETS_BUCKET_NAME || "assets",
                        Key: decodeURIComponent(fileKey)
                    }));

                    console.log(`Cleaned up orphaned Admin profile pic: ${fileKey}`);
                } catch (r2Error) {
                    console.error("Failed to delete old profile pic from R2:", r2Error);
                }
            }
        }

        const updatedAdmin = await targetAdmin.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: {
                id: updatedAdmin._id,
                name: updatedAdmin.name,
                email: updatedAdmin.email,
                role: updatedAdmin.role,
                profilePic: updatedAdmin.profilePic
            }
        });

    } catch (error) {
        console.error("Admin Profile Update Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already taken." });
        }
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// ==========================================
// ROUTE: Update/Set Admin Password
// ==========================================
adminRouter.put('/password', userAuth, adminAuth, async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        const adminId = req.user.id;

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Both new password and confirm password fields are required."
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });
        }

        const admin = await User.findById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        admin.password = newPassword;
        await admin.save();

        res.status(200).json({
            success: true,
            message: "Password updated successfully!"
        });

    } catch (error) {
        console.error("Admin Password Update Error:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({
            success: false,
            message: "Internal server error while updating password."
        });
    }
});

module.exports = adminRouter;