const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema({
    day: { type: Number, required: true },
    title: { type: String, required: true },
    details: { type: String, required: true }
});

const packageSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },

    // Enum removed to allow custom category creation
    category: { type: String, required: true },

    serviceTier: {
        type: String,
        enum: ["All", "Gold", "Platinum"],
        default: "All"
    },
    destination: { type: String, required: true },

    duration_days: { type: Number, required: true },
    duration_nights: { type: Number, required: true },
    price_gold: { type: Number },
    price_platinum: { type: Number },

    linkedPackage: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },

    cover_image_mobile: { type: String, required: true },
    cover_image_desktop: { type: String, required: true },
    gallery_images: [{ type: String }],

    short_description: { type: String, required: true },
    full_description: { type: String }, // Cleanly kept here

    itinerary: [itinerarySchema],
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],

    altitude: { type: String },
    bestTime: { type: String },
    weather: { type: String },
    trivia: { type: String },

    // New UX fields for PackageDetail page mappings
    about_title: { type: String },
    price_subtitle: { type: String },
    sidebar_features: [{ type: String }],

    totalClicks: { type: Number, default: 0 },
    galleryConversions: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);