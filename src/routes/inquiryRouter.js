const express = require('express');
const inquiryRouter = express.Router();
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendWebPush } = require('../services/pushService');
const { userAuth } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');

// --- SUBMIT NEW INQUIRY ---
inquiryRouter.post('/', async (req, res) => {
    try {
        const { packageId, package_id, source, formData, ...rest } = req.body;
        const finalFormData = formData || rest;

        if (!finalFormData || Object.keys(finalFormData).length === 0) {
            return res.status(400).json({ message: "Form data is required." });
        }

        const newInquiry = new Inquiry({
            formData: finalFormData,
            packageId: packageId || package_id || null,
            source: source || 'General',
            userId: req.user ? req.user.id : null
        });
        await newInquiry.save();

        const admins = await User.find({ role: { $in: ['Admin', 'SuperAdmin'] } });
        const io = req.app.get('io');
        const onlineUsers = req.app.get('onlineUsers');

        // ✨ REAL-TIME SYNC: Instantly increment dashboard counters across all active admin panels
        if (io) {
            io.to('admin_room').emit('dashboard_counter_update', { action: 'increment_inquiry' });
        }

        let isAnyAdminOnline = false;
        const offlineAdminEmails = [];
        const notificationsToInsert = [];
        const webPushPromises = [];

        admins.forEach(admin => {
            notificationsToInsert.push({
                recipient: admin._id,
                title: "New Lead Received 🚀",
                message: `An inquiry was submitted by ${finalFormData.name || 'a user'} via ${source || 'General'}.`,
                type: 'inquiry'
            });

            webPushPromises.push(
                sendWebPush(admin._id, "New Lead Received 🚀", `Inquiry from ${finalFormData.name || 'a user'}`, "/admin/inquiries")
            );

            if (onlineUsers.has(admin._id.toString())) {
                isAnyAdminOnline = true;
            } else {
                offlineAdminEmails.push(admin.email);
            }
        });

        const savedNotifications = await Notification.insertMany(notificationsToInsert);
        await Promise.all(webPushPromises);

        if (isAnyAdminOnline && savedNotifications.length > 0) {
            savedNotifications.forEach(notification => {
                if (onlineUsers.has(notification.recipient.toString())) {
                    io.to(notification.recipient.toString()).emit('new_notification', notification);
                }
            });
        }

        if (offlineAdminEmails.length > 0) {
            await notificationService.sendAdminInquiryAlertEmail(offlineAdminEmails, source);
        }

        res.status(201).json({ message: "Inquiry submitted successfully!" });
    } catch (error) {
        console.error("Inquiry Submission Error:", error);
        res.status(500).json({ message: "Failed to submit inquiry." });
    }
});

// --- ADMIN REPLY TO INQUIRY ---
inquiryRouter.post('/:id/reply', userAuth, async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized. Only admins can reply." });
        }

        const { replyMessage } = req.body;
        if (!replyMessage) {
            return res.status(400).json({ message: "Reply message is required." });
        }

        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) return res.status(404).json({ message: "Inquiry not found." });

        inquiry.status = 'replied';
        await inquiry.save();

        const io = req.app.get('io');

        // ✨ REAL-TIME SYNC: Instantly decrement pending replies across all active admin panels
        if (io) {
            io.to('admin_room').emit('dashboard_counter_update', { action: 'decrement_pending' });
        }

        const customerEmail = inquiry.formData.email;
        const customerName = inquiry.formData.name || 'Traveler';

        await notificationService.sendInquiryReplyEmail(customerEmail, customerName, replyMessage);

        if (inquiry.userId) {
            const savedNotification = await Notification.create({
                recipient: inquiry.userId,
                title: "Inquiry Replied ✅",
                message: "An admin has responded to your trip inquiry. Check your email for details!",
                type: "reply"
            });

            await sendWebPush(inquiry.userId, "Nepal Trip Support", "An admin has responded to your inquiry!", "/");

            const onlineUsers = req.app.get('onlineUsers');

            if (onlineUsers.has(inquiry.userId.toString())) {
                io.to(inquiry.userId.toString()).emit('new_notification', savedNotification);
            }
        }

        res.status(200).json({ message: "Reply sent successfully!" });
    } catch (error) {
        console.error("Inquiry Reply Error:", error);
        res.status(500).json({ message: "Failed to send reply." });
    }
});

module.exports = inquiryRouter;