const ServicesRouter = require('express').Router();
const mongoose = require('mongoose');
const ServicesContent = require('../models/ServicesContent');
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');

// GET Services Layout
ServicesRouter.get('/', async (req, res) => {
    try {
        let config = await ServicesContent.findOne({ singletonId: "servicesConfig" });
        if (!config) {
            config = await ServicesContent.create({ singletonId: "servicesConfig" });
        }
        res.status(200).json(config);
    } catch (error) {
        console.error("GET /services error:", error);
        res.status(500).json({ message: "Error fetching services configuration." });
    }
});

// PUT Services Layout (SuperAdmin)
ServicesRouter.put('/', userAuth, superAdminAuth, async (req, res) => {
    try {
        // Pre-clean dummy IDs from the frontend payload arrays
        if (req.body.servicesList) {
            req.body.servicesList.forEach(item => {
                if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) {
                    delete item._id; // Let Mongoose generate a real one
                }
            });
        }

        const updatedConfig = await ServicesContent.findOneAndUpdate(
            { singletonId: "servicesConfig" },
            { $set: req.body },
            { returnDocument: 'after', upsert: true }
        );
        res.status(200).json(updatedConfig);
    } catch (error) {
        console.error("PUT /services error:", error);
        res.status(500).json({ message: "Failed to update services configuration.", error: error.message });
    }
});

// PUT Restore Services Defaults (SuperAdmin)
ServicesRouter.put('/restore', userAuth, superAdminAuth, async (req, res) => {
    try {
        // Delete the modified config
        await ServicesContent.findOneAndDelete({ singletonId: "servicesConfig" });

        // Creating a new one automatically applies the default array from the Schema
        const defaultConfig = await ServicesContent.create({ singletonId: "servicesConfig" });

        res.status(200).json(defaultConfig);
    } catch (error) {
        console.error("PUT /services/restore error:", error);
        res.status(500).json({ message: "Failed to restore default services configuration.", error: error.message });
    }
});

module.exports = { ServicesRouter };