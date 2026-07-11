const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    // Captures all dynamic fields (Name, Email, Phone, Travelers, etc.)
    formData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // Tracks where the inquiry came from (e.g., "Contact Page", "Package Details")
    source: {
        type: String,
        default: 'General'
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