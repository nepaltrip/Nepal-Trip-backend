const express = require('express');
const mongoose = require('mongoose');
const pageContentRouter = express.Router();

const PageContent = require('../models/PageContent');
const AboutContent = require('../models/AboutContent');

const { superAdminAuth, userAuth } = require('../middleware/authMiddleware');
const TestimonialContent = require('../models/TestimonialContent');

// GLOBAL ROUTES (Home Page / Footer / Nav)

pageContentRouter.get('/global', async (req, res) => {
    try {
        let config = await PageContent.findOne({ singletonId: "globalConfig" });
        if (!config) {
            config = await PageContent.create({ singletonId: "globalConfig" });
        }
        res.status(200).json(config);
    } catch (error) {
        console.error("GET /global error:", error);
        res.status(500).json({ message: "Error fetching global configuration." });
    }
});

pageContentRouter.put('/global', userAuth, superAdminAuth, async (req, res) => {
    try {
        // Pre-clean dummy IDs from the frontend payload
        if (req.body.whyUsCards) {
            req.body.whyUsCards.forEach(item => {
                if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) {
                    delete item._id; // Let Mongoose generate a real one
                }
            });
        }

        const updatedConfig = await PageContent.findOneAndUpdate(
            { singletonId: "globalConfig" },
            { $set: req.body },
            { returnDocument: 'after', upsert: true } // <-- Fixed Deprecation Warning
        );
        res.status(200).json(updatedConfig);
    } catch (error) {
        console.error("PUT /global error:", error);
        res.status(500).json({ message: "Failed to update global configuration.", error: error.message });
    }
});


// ==========================================
// ABOUT PAGE ROUTES
// ==========================================

pageContentRouter.get('/about', async (req, res) => {
    try {
        let config = await AboutContent.findOne({ singletonId: "aboutConfig" });
        if (!config) {
            config = await AboutContent.create({ singletonId: "aboutConfig" });
        }
        res.status(200).json(config);
    } catch (error) {
        console.error("GET /about error:", error);
        res.status(500).json({ message: "Error fetching about configuration." });
    }
});

pageContentRouter.put('/about', userAuth, superAdminAuth, async (req, res) => {
    try {
        // Pre-clean dummy IDs from the frontend payload arrays
        if (req.body.stats) {
            req.body.stats.forEach(item => {
                if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) delete item._id;
            });
        }
        if (req.body.values) {
            req.body.values.forEach(item => {
                if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) delete item._id;
            });
        }

        const updatedConfig = await AboutContent.findOneAndUpdate(
            { singletonId: "aboutConfig" },
            { $set: req.body },
            { returnDocument: 'after', upsert: true } // <-- Fixed Deprecation Warning
        );
        res.status(200).json(updatedConfig);
    } catch (error) {
        console.error("PUT /about error:", error); // <-- Will log exact issues to terminal
        res.status(500).json({ message: "Failed to update about configuration.", error: error.message });
    }
});


// GET for Testimonials
pageContentRouter.get('/testimonials', async (req, res) => {
    try {
        let config = await TestimonialContent.findOne({ singletonId: "testimonialConfig" });
        if (!config) config = await TestimonialContent.create({ singletonId: "testimonialConfig" });
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ message: "Error fetching testimonials configuration." });
    }
});

// PUT for Testimonials
pageContentRouter.put('/testimonials', userAuth, superAdminAuth, async (req, res) => {
    try {
        if (req.body.testimonials) {
            req.body.testimonials.forEach(item => {
                if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) delete item._id;
            });
        }
        const updatedConfig = await TestimonialContent.findOneAndUpdate(
            { singletonId: "testimonialConfig" },
            { $set: req.body },
            { returnDocument: 'after', upsert: true }
        );
        res.status(200).json(updatedConfig);
    } catch (error) {
        res.status(500).json({ message: "Failed to update testimonials.", error: error.message });
    }
});

module.exports = pageContentRouter;