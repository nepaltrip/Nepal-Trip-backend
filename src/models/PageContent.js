const mongoose = require('mongoose');

const whyUsCardSchema = new mongoose.Schema({
    icon: { type: String, default: "Compass" },
    title: { type: String, default: "New Feature" },
    body: { type: String, default: "Description goes here." }
});

const pageContentSchema = new mongoose.Schema({
    singletonId: { type: String, default: "globalConfig", unique: true },

    brandName: { type: String, default: "Nepal Trip" },
    tagline: { type: String, default: "CURATED JOURNEYS, UNFORGETTABLE MEMORIES" },

    // Hero Section
    heroTitle: { type: String, default: "Journeys crafted for the way you travel" },
    heroSubtitle: { type: String, default: "Handpicked tour packages across breathtaking destinations." },
    heroVideoUrl: { type: String, default: "/nepal-landscape.mp4" },
    heroVideoMobileUrl: { type: String, default: "/nepal-portrait.mp4" },

    // Dynamic Arrays (Why Us & Gallery)
    whyUsTitle: { type: String, default: "Why Travel With Us?" },
    whyUsCards: [whyUsCardSchema],

    galleryTagline: { type: String, default: "Through our lens" },
    galleryTitle: { type: String, default: "Glimpses of Nepal" },
    galleryPreview: [{ type: String }],

    // Testimonials Section Headings (NEW)
    testimonialsTagline: { type: String, default: "Kind words" },
    testimonialsTitle: { type: String, default: "Loved by travelers" },

    // Bottom CTA Section
    showCtaCard: { type: Boolean, default: true },
    ctaSubtitle: { type: String, default: "Know before you go" },
    ctaTitle: { type: String, default: "Haven't decided where to go yet? Let's fix that." },
    ctaBody: { type: String, default: "Explore local trivia, practical travel insights, and discover the perfect destination based on your vibe." },

    // Contact & Footer details
    contactEmail: { type: String, default: "info@example.com" },
    contactPhone: { type: String, default: "+91 0000000000" },
    officeAddress: { type: String, default: "Address" },

    socialLinks: {
        youtube: { type: String },
        instagram: { type: String },
        facebook: { type: String },
        twitter: { type: String }
    }
}, { timestamps: true });

module.exports = mongoose.model('PageContent', pageContentSchema);