const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        default: null
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    travelDate: { type: Date },
    travelers: { type: Number, min: 1 },
    message: { type: String, maxlength: 1000 },

    status: {
        type: String,
        enum: ['unread', 'read', 'replied'],
        default: 'unread'
    },

    // CRM tracking fields linking back to the User if they were authenticated
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Inquiry', inquirySchema);