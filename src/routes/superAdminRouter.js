const express = require('express');
const superAdminRouter = express.Router();
const Inquiry = require('../models/Inquiry');
const User = require('../models/User'); // If you are using this for visitors
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');
const Traffic = require('../models/Traffic');

// GET /dashboard-counters
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
            // Fetch distinct active logs over the rolling 30-day window
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
            uniqueVisitors: uniqueVisitorHashes.length, // ✨ Real computed metrics array length
            totalInquiries,
            pendingReplies,
            recentInquiries
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
});

module.exports = superAdminRouter;