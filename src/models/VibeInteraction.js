const mongoose = require('mongoose');

const vibeInteractionSchema = new mongoose.Schema({
    vibe: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    ipHash: {
        type: String,
        required: true
    },
    galleryClicked: {
        type: Boolean,
        default: false
    },
    duration: {
        type: Number,
        default: 0
    }, // Tracked in seconds
    isBounce: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// ✨ Auto-delete logs after 7 days (604,800 seconds)
// This keeps your collection incredibly light and fast.
vibeInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

// Prevent multiple documents for the same user/vibe session today
vibeInteractionSchema.index({ vibe: 1, ipHash: 1 }, { unique: false });

module.exports = mongoose.model('VibeInteraction', vibeInteractionSchema);