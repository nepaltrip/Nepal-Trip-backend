const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    title: { type: String, required: true },
    details: { type: String, required: true }
});

const packageSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: String, required: true, enum: ["Mountains", "Beach", "Nature", "Honeymoon", "Heritage", "Culture"] },
    destination: { type: String, required: true },

    durationDays: { type: Number, required: true },
    durationNights: { type: Number, required: true },
    priceInr: { type: Number, required: true },

    coverImageMobile: { type: String, required: true },
    coverImageDesktop: { type: String, required: true },
    galleryImages: [{ type: String }],

    shortDescription: { type: String, required: true },
    fullDescription: { type: String },

    itinerary: [itinerarySchema],
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],

    // Discover page specific stats
    altitude: { type: String },
    bestTime: { type: String },
    weather: { type: String },
    trivia: { type: String },

    // Analytics & Tracking
    totalClicks: { type: Number, default: 0 },
    galleryConversions: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);