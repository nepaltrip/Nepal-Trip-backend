const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    formData: { type: mongoose.Schema.Types.Mixed, required: true },
    source: { type: String, default: 'General' },
    status: {
        type: String,
        enum: ['unread', 'read', 'replied', 'closed'],
        default: 'unread'
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
    hiddenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ✨ ADDED: Store the history of admin replies here
    replies: [{
        message: { type: String, required: true },
        repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        repliedAt: { type: Date, default: Date.now }
    }],

    expiresAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

inquirySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model('Inquiry', inquirySchema);