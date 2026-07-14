const mongoose = require('mongoose');
const validator = require('validator');

const socialSchema = new mongoose.Schema({
    // Contact Information
    email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },

    // Social Media Presence
    whatsapp: {
        type: String,
        trim: true
    },
    youtube: {
        type: String,
        trim: true
    },
    instagram: {
        type: String,
        trim: true
    },
    facebook: {
        type: String,
        trim: true
    },
    twitter: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const Social = mongoose.model('Social', socialSchema);
module.exports = Social;