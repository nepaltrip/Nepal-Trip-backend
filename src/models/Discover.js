const mongoose = require('mongoose');

const discoverSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    vibe: { type: String, required: true },
    destination: { type: String, required: true },
    cover_image_mobile: { type: String, required: true },
    cover_image_desktop: { type: String, required: true },
    trivia: { type: String },
    altitude: { type: String },
    bestTime: { type: String },
    weather: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    // THE MASTER LINK:
    linkedPackage: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Discover', discoverSchema);