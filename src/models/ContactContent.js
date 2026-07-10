const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'email', 'tel', 'textarea', 'radio', 'checkbox'], default: 'text' },
    required: { type: Boolean, default: false },
    options: { type: String, default: "" } // Used for comma-separated options
});

const contactContentSchema = new mongoose.Schema({
    singletonId: { type: String, default: "contactConfig", unique: true },
    page_tagline: { type: String, default: "Say hello" },
    page_title: { type: String, default: "Let's plan your journey" },
    page_subtitle: { type: String, default: "Tell us a bit about the trip you have in mind and we'll get back within one business day." },
    contact_email: { type: String, default: "info@nepaltrip.in" },
    contact_phone: { type: String, default: "+977-1-4000000" },
    contact_address: { type: String, default: "Thamel, Kathmandu, Nepal" },
    formFields: [formFieldSchema]
}, { timestamps: true });

module.exports = mongoose.model('ContactContent', contactContentSchema);