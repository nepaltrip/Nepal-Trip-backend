const mongoose = require('mongoose');

const serviceItemSchema = new mongoose.Schema({
    icon: { type: String, default: "Star" },
    title: { type: String, default: "New Service" },
    description: { type: String, default: "Description of the new service." }
});

const servicesContentSchema = new mongoose.Schema({
    singletonId: { type: String, default: "servicesConfig", unique: true },
    tagline: { type: String, default: "What We Offer" },
    title: { type: String, default: "Our Services" },
    servicesList: {
        type: [serviceItemSchema],
        default: [
            { icon: "Headset", title: "Tour Operator", description: "Expert guidance and personalized itineraries for your perfect getaway." },
            { icon: "PlaneTakeoff", title: "Airline Ticketing", description: "Hassle-free domestic and international flight bookings at the best rates." },
            { icon: "Ship", title: "Cruise Services", description: "Luxurious ocean and river cruise packages for unforgettable voyages." },
            { icon: "TrainFront", title: "Railway Ticketing", description: "Quick and confirmed train reservations across the national network." },
            { icon: "Car", title: "Car and Coach Rental", description: "Comfortable and safe road travel with our premium fleet of vehicles." },
            { icon: "Building2", title: "Hotel Booking", description: "Handpicked accommodations ranging from budget stays to luxury resorts." },
            { icon: "BookCheck", title: "Passport and Visa Services", description: "Streamlined documentation and processing for your international travel." },
            { icon: "ShieldCheck", title: "Travel Insurance", description: "Comprehensive coverage to ensure peace of mind throughout your journey." },
            { icon: "MapPin", title: "Destination Advice", description: "Insider knowledge and tips to help you choose your next dream location." }
        ]
    }
}, { timestamps: true });

module.exports = mongoose.model('ServicesContent', servicesContentSchema);