const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    rating: { type: Number, default: 5 },
    message: { type: String, default: "New review message." },
    name: { type: String, default: "Traveler Name" },
    location: { type: String, default: "City, Country" }
});

const testimonialContentSchema = new mongoose.Schema({
    singletonId: { type: String, default: "testimonialConfig", unique: true },
    page_tagline: { type: String, default: "Kind Words" },
    page_title: { type: String, default: "Traveler Stories" },
    page_subtitle: { type: String, default: "Don't just take our word for it. Read what our guests have to say about their Himalayan adventures with us." },
    testimonials: [testimonialSchema]
}, { timestamps: true });

module.exports = mongoose.model('TestimonialContent', testimonialContentSchema);