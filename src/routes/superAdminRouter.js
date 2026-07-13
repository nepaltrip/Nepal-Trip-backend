const express = require('express');
const superAdminRouter = express.Router();
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const Traffic = require('../models/Traffic');
const Package = require('../models/Package');
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');

// ==========================================
// GET: DASHBOARD METRICS COUNTERS
// ==========================================
superAdminRouter.get('/dashboard-counters', userAuth, superAdminAuth, async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized" });
        }

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
superAdminRouter.get('/package-analytics', userAuth, superAdminAuth, async (req, res) => {
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
                            isOnline: "$isOnline", // ✨ ADDED
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
                        isOnline: u.isOnline || false, // ✨ ADDED
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

module.exports = superAdminRouter;