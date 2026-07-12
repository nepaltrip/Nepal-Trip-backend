const express = require('express');
const discoverRouter = express.Router();
const VibeInteraction = require('../models/VibeInteraction');
// ✨ Import both functions here
const { broadcastVibeMetrics, getVibeStats } = require('../utils/vibeAnalytics');

// ✨ ADD THE MISSING GET ROUTE
// GET: Initial load for SuperAdmin Dashboard
discoverRouter.get('/track', async (req, res) => {
    try {
        const stats = await getVibeStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error("Failed to fetch initial vibe stats:", error);
        res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }
});

// POST: Intelligent Telemetry Tracker
discoverRouter.post('/track', async (req, res) => {
    try {
        const { vibe, visitorId, userId, duration, galleryClicked, isBounce } = req.body;

        // ✨ FIX: Create a NEW interaction record for EVERY swipe/view
        // instead of grouping them by day. This ensures math averages 
        // across total actual views instead of unique daily visitors.
        await VibeInteraction.create({
            vibe: vibe,
            ipHash: visitorId || 'anonymous_' + Math.random().toString(36).substring(7),
            userId: userId || null,
            duration: duration || 0,
            galleryClicked: galleryClicked ? true : false,
            isBounce: isBounce ? true : false
        });

        // Grab socket instance and broadcast the fresh data
        const io = req.app.get('io');
        await broadcastVibeMetrics(io);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Telemetry sync failed:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = discoverRouter;