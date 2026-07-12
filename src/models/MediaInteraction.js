const mongoose = require('mongoose');

const mediaInteractionSchema = new mongoose.Schema({
    mediaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GalleryItem',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    ipHash: {
        type: String,
        required: true
    },
    dateString: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Prevent spam: 1 view per user/device per day per media asset
mediaInteractionSchema.index({ mediaId: 1, ipHash: 1, dateString: 1 }, { unique: true });

// ✨ Auto-delete logs after 7 days (604,800 seconds)
mediaInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('MediaInteraction', mediaInteractionSchema);