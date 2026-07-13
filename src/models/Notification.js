const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry', default: null },
    message: { type: String, required: true },
    type: { type: String, default: 'info' },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null }
}, { timestamps: true });

notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: 1296000, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);