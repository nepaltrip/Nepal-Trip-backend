const mongoose = require('mongoose');

const statSchema = new mongoose.Schema({
    icon: { type: String, default: "Star" },
    to: { type: String, default: "100" },
    suffix: { type: String, default: "+" },
    label: { type: String, default: "New Stat" }
});

const valueSchema = new mongoose.Schema({
    icon: { type: String, default: "Star" },
    title: { type: String, default: "New Value" },
    description: { type: String, default: "Description goes here." }
});

const aboutContentSchema = new mongoose.Schema({
    // Singleton ID ensures only one document exists for the About page
    singletonId: { type: String, default: "aboutConfig", unique: true },

    // Hero Section
    hero_image: { type: String, default: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1920&auto=format&fit=crop" },
    hero_tagline: { type: String, default: "Our Story" },
    hero_title: { type: String, default: "We bring you closer to the roof of the world." },

    // Core About Content
    about_tagline: { type: String, default: "Who We Are" },
    about_title: { type: String, default: "Crafting Unforgettable Himalayan Journeys" },
    about_body: {
        type: String,
        default: "We are a passionate team of travel curators helping thousands of travelers discover the world since 2015. \n\nBorn out of a deep love for the Himalayas, our mission is to connect travelers with the authentic heart of Nepal."
    },

    // Dynamic Arrays
    stats: [statSchema],

    values_title: { type: String, default: "Why Travel With Us?" },
    values_subtitle: { type: String, default: "We believe travel should be more than just checking boxes. It should be safe, sustainable, and deeply enriching." },
    values: [valueSchema]

}, { timestamps: true });

module.exports = mongoose.model('AboutContent', aboutContentSchema);