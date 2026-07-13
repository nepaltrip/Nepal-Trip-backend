const express = require('express');
const webpush = require('web-push'); // ✨ FIXED: Added this missing import
const notificationRouter = express.Router();
const Notification = require('../models/Notification');
const { userAuth } = require('../middleware/authMiddleware');
const PushSubscription = require('../models/PushSubscription');

// Initialize Web Push
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Get all notifications for logged-in user
notificationRouter.get('/', userAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

// Mark as read
notificationRouter.put('/:id/read', userAuth, async (req, res) => {
    try {
        await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { isRead: true });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to update notification" });
    }
});

// Delete single notification
notificationRouter.delete('/:id', userAuth, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete notification" });
    }
});

// Clear all notifications
notificationRouter.delete('/clear/all', userAuth, async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user.id });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to clear notifications" });
    }
});

// Save Push Subscription from Browser
notificationRouter.post('/subscribe-push', userAuth, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;

        // Prevent duplicate subscriptions for the same browser
        const existingSub = await PushSubscription.findOne({ endpoint });
        if (!existingSub) {
            const newSub = new PushSubscription({
                userId: req.user.id,
                endpoint,
                keys
            });
            await newSub.save();
        }
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Push Subscription Error:', error);
        res.status(500).json({ message: "Failed to save subscription" });
    }
});


// ✨ NEW: Get unread count for the red dot indicator
notificationRouter.get('/unread-count', userAuth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.user.id, isRead: false });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch unread count" });
    }
});

// ✨ NEW: Mark all notifications as read at once
notificationRouter.put('/mark-all-read', userAuth, async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user.id, isRead: false }, { isRead: true });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to update notifications" });
    }
});
module.exports = notificationRouter;