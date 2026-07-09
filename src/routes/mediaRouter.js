const express = require('express');
const mediaRouter = express.Router();
const Media = require('../models/Media');
const { superAdminAuth, userAuth } = require('../middleware/authMiddleware');

// PUBLIC: Get all media files
mediaRouter.get('/', async (req, res) => {
    try {
        const media = await Media.find().sort({ createdAt: -1 });
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: "Error fetching gallery." });
    }
});

// SUPERADMIN ONLY: Add new media
mediaRouter.post('/', userAuth, superAdminAuth, async (req, res) => {
    try {
        const newMedia = await Media.create(req.body);
        res.status(201).json(newMedia);
    } catch (error) {
        res.status(500).json({ message: "Failed to upload media." });
    }
});

module.exports = mediaRouter;