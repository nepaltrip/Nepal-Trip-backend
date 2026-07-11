const mongoose = require('mongoose');

const trafficSchema = new mongoose.Schema({
    // Store a clean YYYY-MM-DD string to aggregate unique daily hits easily
    dateString: { type: String, required: true },

    // Anonymized tracking identifier (MD5 hash of IP + User-Agent)
    ipHash: { type: String, required: true },

    // Optional: Tie it to a user if they are logged in
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    deviceType: { type: String, enum: ['Mobile', 'Desktop'], default: 'Desktop' }
}, { timestamps: true });

// Strict constraint: One unique entry per device/user per day
trafficSchema.index({ dateString: 1, ipHash: 1 }, { unique: true });

module.exports = mongoose.model('Traffic', trafficSchema);