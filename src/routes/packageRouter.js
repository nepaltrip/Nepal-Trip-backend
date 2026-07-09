const express = require('express');
const packageRouter = express.Router();
const Package = require('../models/Package');
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');

// PUBLIC: Get all active packages (for Packages & Discover pages)
packageRouter.get('/', async (req, res) => {
    try {
        const packages = await Package.find({ isActive: true })
            .select('-itinerary -inclusions -exclusions'); // Exclude heavy data for list view
        res.status(200).json(packages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching packages." });
    }
});

// PUBLIC: Get single package by slug (for PackageDetail page)
packageRouter.get('/:slug', async (req, res) => {
    try {
        const pkg = await Package.findOne({ slug: req.params.slug, isActive: true });
        if (!pkg) return res.status(404).json({ message: "Package not found." });

        // Tracking analytics asynchronously
        pkg.totalClicks += 1;
        pkg.save();

        res.status(200).json(pkg);
    } catch (error) {
        res.status(500).json({ message: "Error fetching package details." });
    }
});

// SUPERADMIN ONLY: Update package content (Inline Editing)
packageRouter.put('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        const updatedPackage = await Package.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        res.status(200).json(updatedPackage);
    } catch (error) {
        res.status(500).json({ message: "Failed to update package." });
    }
});

module.exports = packageRouter;