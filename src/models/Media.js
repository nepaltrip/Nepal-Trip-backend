const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    category: { type: String, enum: ["Mountains", "Culture", "Wildlife", "Lakes", "Honeymoon"], required: true },
    location: { type: String, required: true },

    // Analytics
    views: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);