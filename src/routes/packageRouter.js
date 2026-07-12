const express = require('express');
const packageRouter = express.Router();
const Package = require('../models/Package');
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');

// PUBLIC: Get all active packages
packageRouter.get('/', async (req, res) => {
    try {
        const packages = await Package.find({ isActive: true })
            .select('-itinerary -inclusions -exclusions')
            .sort({ createdAt: -1 });
        res.status(200).json(packages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching packages." });
    }
});

// PUBLIC: Get single package by slug
packageRouter.get('/:slug', async (req, res) => {
    try {
        const pkg = await Package.findOne({ slug: req.params.slug, isActive: true });
        if (!pkg) return res.status(404).json({ message: "Package not found." });

        pkg.totalClicks += 1;
        pkg.save();

        res.status(200).json(pkg);
    } catch (error) {
        res.status(500).json({ message: "Error fetching package details." });
    }
});

// ==========================================
// SUPERADMIN ROUTES (God Mode Mutations)
// ==========================================

// POST: ZERO-POPUP INSTANT DRAFT CREATION
packageRouter.post('/', userAuth, superAdminAuth, async (req, res) => {
    try {
        const uniqueSlug = `draft-package-${Date.now().toString().slice(-6)}`;

        const defaultPkg = {
            title: "New Custom Journey",
            slug: uniqueSlug,
            category: "Nature",
            serviceTier: "All",
            destination: "Set Destination",
            duration_days: 3,
            duration_nights: 2,
            price_inr: 25000,
            cover_image_mobile: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800&auto=format&fit=crop",
            cover_image_desktop: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1600&auto=format&fit=crop",
            short_description: "Short highlight description of the trip goes here.",
            isActive: true // Visible instantly for editing
        };

        const newPackage = await Package.create(defaultPkg);
        res.status(201).json(newPackage);
    } catch (error) {
        console.error("POST /packages error:", error);
        res.status(500).json({ message: "Failed to generate dummy package." });
    }
});

// POST: BULLETPROOF RESTORE DEFAULTS
packageRouter.post('/restore-defaults', userAuth, superAdminAuth, async (req, res) => {
    try {
        await Package.deleteMany({}); // Wipe clean

        const dummyPackages = [
            { title: "Ladakh Himalayan Adventure", slug: "ladakh-himalayan-adventure", category: "Mountains", serviceTier: "Platinum", destination: "Ladakh, India", duration_days: 7, duration_nights: 6, price_inr: 45000, cover_image_mobile: "https://images.unsplash.com/photo-1626714485857-79774681600c?q=80&w=800&auto=format&fit=crop", cover_image_desktop: "https://images.unsplash.com/photo-1626714485857-79774681600c?q=80&w=1600&auto=format&fit=crop", short_description: "A high-altitude journey through monasteries, deep valleys and turquoise lakes.", isActive: true },
            { title: "Maldives Overwater Escape", slug: "maldives-overwater-escape", category: "Beach", serviceTier: "Platinum", destination: "Maldives", duration_days: 5, duration_nights: 4, price_inr: 120000, cover_image_mobile: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=800&auto=format&fit=crop", cover_image_desktop: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=1600&auto=format&fit=crop", short_description: "Overwater villas, coral reefs and endless turquoise horizons.", isActive: true },
            { title: "Kerala Backwaters & Beaches", slug: "kerala-backwaters-beaches", category: "Nature", serviceTier: "Gold", destination: "Kerala, India", duration_days: 6, duration_nights: 5, price_inr: 32000, cover_image_mobile: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=800&auto=format&fit=crop", cover_image_desktop: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=1600&auto=format&fit=crop", short_description: "Houseboats, spice hills and the calm rhythm of Gods Own Country.", isActive: true }
        ];

        const restored = await Package.insertMany(dummyPackages);
        res.status(200).json(restored);
    } catch (error) {
        res.status(500).json({ message: "Failed to restore defaults." });
    }
});

// PUT: Inline Editing update
packageRouter.put('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        if (req.body.itinerary) {
            req.body.itinerary.forEach(day => {
                if (day._id && !day._id.match(/^[0-9a-fA-F]{24}$/)) delete day._id;
            });
        }
        const updatedPackage = await Package.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { returnDocument: 'after', runValidators: true }
        );
        if (!updatedPackage) return res.status(404).json({ message: "Package not found." });
        res.status(200).json(updatedPackage);
    } catch (error) {
        res.status(500).json({ message: "Failed to update package." });
    }
});

// DELETE: Remove package
packageRouter.delete('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        const deleted = await Package.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Package not found." });
        res.status(200).json({ message: "Package deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete package." });
    }
});

module.exports = packageRouter;