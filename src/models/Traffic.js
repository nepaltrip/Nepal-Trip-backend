const mongoose = require('mongoose');

const trafficSchema = new mongoose.Schema({
    dateString: { type: String, required: true },
    ipHash: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deviceType: { type: String, enum: ['Mobile', 'Desktop'], default: 'Desktop' }
}, { timestamps: true });

// Strict constraint: One unique entry per device/user per day
trafficSchema.index({ dateString: 1, ipHash: 1 }, { unique: true });

// ✨ NEW: Auto-delete documents when they become 30 days old (2,592,000 seconds)
trafficSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Traffic', trafficSchema);