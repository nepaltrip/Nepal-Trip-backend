const express = require('express');
const mediaRouter = express.Router();
const Media = require('../models/Media');
const { superAdminAuth, userAuth } = require('../middleware/authMiddleware');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const assetsS3Client = require('../config/cloudflareAssetsS3');

// PUBLIC: Get all media files
mediaRouter.get('/', async (req, res) => {
    try {
        const media = await Media.find().sort({ createdAt: -1 });
        res.status(200).json(media);
    } catch (error) {
        res.status(500).json({ message: "Error fetching gallery." });
    }
});

// SUPERADMIN ONLY: Add new media to gallery database
mediaRouter.post('/', userAuth, superAdminAuth, async (req, res) => {
    try {
        const newMedia = await Media.create(req.body);
        res.status(201).json(newMedia);
    } catch (error) {
        res.status(500).json({ message: "Failed to upload media." });
    }
});

// ==========================================
// SCALABLE PRESIGNED URL GENERATOR 
// ANY logged-in user (User, Admin, SuperAdmin) can use this
// ==========================================
mediaRouter.get('/presigned-url', userAuth, async (req, res) => {
    try {
        // Accept a dynamic 'folder' query param, defaulting to 'profiles'
        const { fileName, fileType, folder = 'profiles' } = req.query;

        if (!fileName || !fileType) {
            return res.status(400).json({ message: "fileName and fileType are required." });
        }

        const extension = fileName.split('.').pop();

        // Inject req.user.id into the filename. 
        // This keeps your bucket organized and prevents file name collisions.
        const userId = req.user.id || req.user._id;
        const uniqueFileName = `${folder}/user_${userId}_${Date.now()}.${extension}`;

        const command = new PutObjectCommand({
            // ✨ FIX 2: Removed quotes so it reads the environment variable, added fallback
            Bucket: process.env.R2_ASSETS_BUCKET_NAME || "assets",
            Key: uniqueFileName,
            ContentType: fileType,
        });

        // ✨ Use the dedicated assetsS3Client here
        const presignedUrl = await getSignedUrl(assetsS3Client, command, { expiresIn: 3600 });

        // ✨ FIX 3: Use R2_ASSETS_PUBLIC_URL from your .env
        const publicUrl = `${process.env.R2_ASSETS_PUBLIC_URL}/${uniqueFileName}`;

        res.status(200).json({ presignedUrl, publicUrl, key: uniqueFileName });
    } catch (error) {
        console.error("Presigned URL Error:", error);
        res.status(500).json({ message: "Failed to generate upload URL." });
    }
});

module.exports = mediaRouter;