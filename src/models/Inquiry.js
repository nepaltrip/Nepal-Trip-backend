const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    // Captures all dynamic fields (Name, Email, Custom Checkboxes, etc.)
    formData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    // CRM tracking fields
    status: {
        type: String,
        enum: ['unread', 'read', 'replied'],
        default: 'unread'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', inquirySchema);