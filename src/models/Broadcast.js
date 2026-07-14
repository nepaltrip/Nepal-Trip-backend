// models/Broadcast.js
const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderRole: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    alertType: {
        type: String,
        enum: ['system', 'marketing', 'urgent'],
        default: 'system'
    },
    targetAudience: {
        type: String,
        required: true
    },
    specificUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    targetState: {
        type: String,
        default: ''
    },
    targetDistrict: {
        type: String,
        default: ''
    },
    recipientCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Broadcast', broadcastSchema);