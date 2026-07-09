const express = require('express');
const pageContentRouter = express.Router();
const PageContent = require('../models/PageContent');
const { superAdminAuth, userAuth } = require('../middleware/authMiddleware');

// PUBLIC: Get global configuration
pageContentRouter.get('/global', async (req, res) => {
    try {
        let config = await PageContent.findOne({ singletonId: "globalConfig" });
        if (!config) {
            // Create default if it doesn't exist
            config = await PageContent.create({ singletonId: "globalConfig" });
        }
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ message: "Error fetching global configuration." });
    }
});

// SUPERADMIN ONLY: Update global configuration (Used for Inline Editing)
pageContentRouter.put('/global', userAuth, superAdminAuth, async (req, res) => {
    try {
        const updatedConfig = await PageContent.findOneAndUpdate(
            { singletonId: "globalConfig" },
            { $set: req.body },
            { new: true, upsert: true }
        );
        res.status(200).json(updatedConfig);
    } catch (error) {
        res.status(500).json({ message: "Failed to update configuration." });
    }
});

module.exports = pageContentRouter;