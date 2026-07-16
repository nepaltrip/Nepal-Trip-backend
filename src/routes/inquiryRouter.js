const express = require('express');
const inquiryRouter = express.Router();
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendWebPush } = require('../services/pushService');
const { userAuth, optionalAuth } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');

// --- SUBMIT NEW INQUIRY ---
inquiryRouter.post('/', optionalAuth, async (req, res) => {
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

        const populatedInquiry = await Inquiry.findById(newInquiry._id).populate('userId', 'name email profilePic isOnline lastSeenAt status');

        // ✨ 1. REAL-TIME DASHBOARD SYNC (Silent UI Update)
        if (io) {
            io.to('admin_room').emit('dashboard_counter_update', { action: 'increment_inquiry' });
            io.to('admin_room').emit('new_inquiry_received', populatedInquiry);
        }

        // ✨ 2. EMAIL ALL ADMINS (Unconditional)
        const allAdminEmails = admins.map(a => a.email);
        if (allAdminEmails.length > 0) {
            await notificationService.sendAdminInquiryAlertEmail(allAdminEmails, source);
        }

        // ✨ 3. IN-APP DOCS & PRESENCE ROUTING (Push vs Socket Toast)
        const notificationsToInsert = [];
        const webPushPromises = [];

        admins.forEach(admin => {
            const adminIdStr = admin._id.toString();
            const targetUrl = admin.role === 'SuperAdmin' ? '/superadmin/inquiries' : '/admin/inquiries';

            // Always prep the In-App doc
            notificationsToInsert.push({
                recipient: admin._id,
                title: "New Lead Received 🚀",
                message: `An inquiry was submitted by ${finalFormData.name || 'a user'} via ${source || 'General'}.`,
                type: 'inquiry',
                inquiryId: newInquiry._id,
                payload: {
                    inquiryText: finalFormData.message || "No specific message provided."
                }
            });

            // If OFFLINE, queue Web Push (Online admins get handled post-insert)
            if (!onlineUsers || !onlineUsers.has(adminIdStr)) {
                webPushPromises.push(
                    sendWebPush(admin._id, "New Lead Received 🚀", `Inquiry from ${finalFormData.name || 'a user'}`, targetUrl)
                );
            }
        });

        // Insert Docs
        const savedNotifications = await Notification.insertMany(notificationsToInsert);

        // Send Live Socket Toast ONLY to ONLINE admins
        if (io && onlineUsers) {
            savedNotifications.forEach(notification => {
                const recipientStr = notification.recipient.toString();
                if (onlineUsers.has(recipientStr)) {
                    io.to(recipientStr).emit('new_notification', notification);
                }
            });
        }

        // Fire off Web Pushes to OFFLINE admins
        if (webPushPromises.length > 0) {
            await Promise.allSettled(webPushPromises);
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

        // ✨ NEW: Save the reply to the database
        inquiry.replies.push({
            message: replyMessage,
            repliedBy: req.user.id
        });

        await inquiry.save();

        // Populate the user and the new reply sender data
        const updatedInquiry = await Inquiry.findById(inquiry._id)
            .populate('userId', 'name email profilePic isOnline lastSeenAt status')
            .populate('replies.repliedBy', 'name role');

        const io = req.app.get('io');
        const onlineUsers = req.app.get('onlineUsers');

        // 1. REAL-TIME DASHBOARD SYNC (Silent UI Update)
        if (io) {
            io.to('admin_room').emit('dashboard_counter_update', { action: 'decrement_pending' });
            io.to('admin_room').emit('inquiry_replied', updatedInquiry);
        }

        // 2. EMAIL CUSTOMER (Unconditional)
        const customerEmail = inquiry.formData.email;
        const customerName = inquiry.formData.name || 'Traveler';
        await notificationService.sendInquiryReplyEmail(customerEmail, customerName, replyMessage);

        // ... rest of the existing notification logic remains exactly the same ...
        if (inquiry.userId) {
            const userIdStr = inquiry.userId.toString();
            const savedNotification = await Notification.create({
                recipient: inquiry.userId,
                title: "Inquiry Replied ✅",
                message: "An admin has responded to your trip inquiry. Check your email for details!",
                type: "reply",
                inquiryId: inquiry._id,
                payload: {
                    inquiryText: inquiry.formData.message || "Your trip inquiry.",
                    replyText: replyMessage
                }
            });

            if (onlineUsers && onlineUsers.has(userIdStr)) {
                if (io) io.to(userIdStr).emit('new_notification', savedNotification);
            } else {
                await sendWebPush(inquiry.userId, "Nepal Trip Support", "An admin has responded to your inquiry!", "/");
            }
        }

        res.status(200).json({ message: "Reply sent successfully!" });
    } catch (error) {
        console.error("Inquiry Reply Error:", error);
        res.status(500).json({ message: "Failed to send reply." });
    }
});

// --- GET ALL INQUIRIES (Filtered by hiddenBy) ---
inquiryRouter.get('/', userAuth, async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized." });
        }

        const inquiries = await Inquiry.find({ hiddenBy: { $ne: req.user.id } })
            .populate('userId', 'name email profilePic isOnline lastSeenAt status')
            .populate('replies.repliedBy', 'name role') // ✨ NEW: Populate admin names on load
            .sort({ createdAt: -1 });

        res.status(200).json(inquiries);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch inquiries." });
    }
});

// --- SOFT DELETE (HIDE) SINGLE INQUIRY ---
inquiryRouter.patch('/:id/hide', userAuth, async (req, res) => {
    try {
        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

        if (!inquiry.hiddenBy.includes(req.user.id)) {
            inquiry.hiddenBy.push(req.user.id);
            await inquiry.save();
        }

        res.status(200).json({ message: "Inquiry removed from your view." });
    } catch (error) {
        res.status(500).json({ message: "Failed to hide inquiry." });
    }
});

// --- BULK CLEAR INQUIRIES ---
inquiryRouter.patch('/hide-bulk', userAuth, async (req, res) => {
    try {
        const { filterType } = req.body;

        let query = { hiddenBy: { $ne: req.user.id } };
        if (filterType === 'unread') query.status = 'unread';
        if (filterType === 'replied') query.status = 'replied';

        await Inquiry.updateMany(
            query,
            { $addToSet: { hiddenBy: req.user.id } }
        );

        res.status(200).json({ message: "Inquiries cleared from your view." });
    } catch (error) {
        res.status(500).json({ message: "Failed to clear inquiries." });
    }
});

// --- MARK INQUIRY AS READ ---
inquiryRouter.patch('/:id/read', userAuth, async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized." });
        }

        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({ message: "Inquiry not found." });
        }

        if (inquiry.status === 'unread') {
            inquiry.status = 'read';
            await inquiry.save();

            const io = req.app.get('io');
            if (io) {
                io.to('admin_room').emit('inquiry_read', { id: inquiry._id });
            }
        }

        res.status(200).json({ message: "Inquiry marked as read." });
    } catch (error) {
        console.error("Error marking inquiry as read:", error);
        res.status(500).json({ message: "Failed to mark inquiry as read." });
    }
});

// --- TOGGLE INQUIRY STATUS (CLOSE / REOPEN) ---
inquiryRouter.patch('/:id/status', userAuth, async (req, res) => {
    try {
        if (!['Admin', 'SuperAdmin'].includes(req.user.role)) {
            return res.status(403).json({ message: "Unauthorized." });
        }
        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) return res.status(404).json({ message: "Inquiry not found." });

        inquiry.status = req.body.status;
        await inquiry.save();

        // Optional: Emit socket event to sync other admins
        const io = req.app.get('io');
        if (io) {
            const updatedInquiry = await Inquiry.findById(inquiry._id).populate('userId', 'name email profilePic isOnline lastSeenAt status');
            io.to('admin_room').emit('inquiry_replied', updatedInquiry); // Reusing this event to sync the UI
        }

        res.status(200).json({ message: `Inquiry marked as ${req.body.status}` });
    } catch (error) {
        res.status(500).json({ message: "Failed to update status." });
    }
});

module.exports = inquiryRouter;