const express = require('express');
const galleryRouter = express.Router();
const GalleryItem = require('../models/Gallery');
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const path = require('path');
const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/s3'); // Custom configured R2 client
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// --------------------------------------------------
// PUBLIC ENDPOINTS
// --------------------------------------------------

// POST: Standard Single-File Upload Signature (For files < 5MB)
galleryRouter.post('/upload/sign', userAuth, superAdminAuth, async (req, res) => {
    try {
        const { filename, type, metadata } = req.body;
        const safeLocation = (metadata?.locationTag || "General").replace(/[^a-zA-Z0-9]/g, '-');
        const ext = path.extname(filename) || '';
        const uniqueString = crypto.randomBytes(3).toString('hex');

        const key = `gallery/${req.user._id}/single-${safeLocation}-${Date.now()}-${uniqueString}${ext}`;

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: type
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        res.status(200).json({ url, publicUrl, key });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate standard signed URL." });
    }
});

// GET: Fetch gallery media with Pagination, Search, and Sorting
galleryRouter.get('/', async (req, res) => {
    try {
        // 1. Extract query parameters with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15; // 15 items per chunk
        const search = req.query.search || "";
        const sortKey = req.query.sortKey || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // 2. Build the MongoDB query
        const query = { isActive: true };
        if (search) {
            query.locationTag = { $regex: search, $options: 'i' }; // Case-insensitive search
        }

        // 3. Build the sort configuration
        const sortConfig = {};
        sortConfig[sortKey] = sortOrder;

        // 4. Calculate how many documents to skip
        const skip = (page - 1) * limit;

        // 5. Execute query and count in parallel
        const [items, total] = await Promise.all([
            GalleryItem.find(query).sort(sortConfig).skip(skip).limit(limit),
            GalleryItem.countDocuments(query)
        ]);

        // 6. Return chunk + pagination metadata
        res.status(200).json({
            success: true,
            data: items,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                hasMore: page * limit < total // True if there are more items left
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching gallery items." });
    }
});

// --------------------------------------------------
// SUPERADMIN MULTIPART CLOUDFLARE R2 UPLOAD UPPY HANDSHAKES
// --------------------------------------------------

// 1. Initiate Multipart Stream
galleryRouter.post('/multipart/create', userAuth, superAdminAuth, async (req, res) => {
    try {
        const { filename, type, metadata } = req.body;
        if (!filename) return res.status(400).json({ error: "Filename is required" });

        const safeLocation = (metadata?.locationTag || "General").replace(/[^a-zA-Z0-9]/g, '-');
        const ext = path.extname(filename) || '.mp4';
        const uniqueString = crypto.randomBytes(3).toString('hex');

        // Assemble clean asset filepath
        const smartFileName = `gallery-${safeLocation}-${Date.now()}-${uniqueString}${ext}`;
        const key = `gallery/${req.user._id}/${smartFileName}`;

        const command = new CreateMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: type
        });

        const upload = await s3Client.send(command);
        res.status(200).json({ uploadId: upload.UploadId, key: key });
    } catch (error) {
        console.error("R2 Multipart Initialization Crash:", error);
        res.status(500).json({ error: "Failed to initiate multipart stream upload." });
    }
});

// 2. Sign Chunks Individually
galleryRouter.post('/multipart/sign', userAuth, superAdminAuth, async (req, res) => {
    try {
        const { uploadId, key, partNumber } = req.body;

        const command = new UploadPartCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.status(200).json({ url });
    } catch (error) {
        res.status(500).json({ error: "Failed to securely sign part upload slice." });
    }
});

// 3. Complete and Stitch Chunks
galleryRouter.post('/multipart/complete', userAuth, superAdminAuth, async (req, res) => {
    try {
        const { uploadId, key, parts } = req.body;
        const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

        const command = new CompleteMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: sortedParts }
        });

        await s3Client.send(command);
        const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
        res.status(200).json({ location: publicUrl });
    } catch (error) {
        res.status(500).json({ error: "Cloudflare failed to stitch file slices." });
    }
});

// 4. Abort Stream
galleryRouter.post('/multipart/abort', userAuth, superAdminAuth, async (req, res) => {
    try {
        const { uploadId, key } = req.body;
        const command = new AbortMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        });
        await s3Client.send(command);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to abort data upload stream cleanly." });
    }
});

// --------------------------------------------------
// SUPERADMIN GOD MODE MUTATIONS
// --------------------------------------------------

// POST: Save confirmed completely uploaded media to catalog database
galleryRouter.post('/save-log', userAuth, superAdminAuth, async (req, res) => {
    try {
        const { title, locationTag, description, mediaUrl, thumbnailUrl, fileType, aspectRatio } = req.body;

        const newMediaItem = await GalleryItem.create({
            title: title || "Untitled Memory",
            locationTag: locationTag || "Nepal",
            description,
            mediaUrl,
            thumbnailUrl,
            fileType,
            aspectRatio: aspectRatio || 'landscape'
        });

        res.status(201).json({ success: true, data: newMediaItem });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to persist gallery metadata catalog item." });
    }
});

// PUT: Inline Editing modification logic
galleryRouter.put('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        const updatedItem = await GalleryItem.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updatedItem) return res.status(404).json({ message: "Gallery item not found." });
        res.status(200).json({ success: true, data: updatedItem });
    } catch (error) {
        res.status(500).json({ message: "Failed to inline update catalog document details." });
    }
});

// DELETE: Hard Wipe file from R2 Bucket alongside Database Document
galleryRouter.delete('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        const target = await GalleryItem.findById(req.params.id);
        if (!target) return res.status(404).json({ success: false, message: "Gallery item not found." });

        // Wipe object from Cloudflare R2
        try {
            let fileKey = target.mediaUrl.replace(process.env.R2_PUBLIC_URL, '');
            if (fileKey.startsWith('/')) fileKey = fileKey.substring(1);

            await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: decodeURIComponent(fileKey)
            }));
        } catch (r2Error) {
            console.error("R2 asset deletion mismatch or failure:", r2Error);
        }

        await target.deleteOne();
        res.status(200).json({ success: true, message: "Wiped gallery asset item completely." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to complete catalog deletion matrix clean." });
    }
});


// POST: Intelligent View Tracker with 10-Min Cooldown & Real-Time Admin Sync
galleryRouter.post('/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(" ")[1]);

        let shouldIncrementGlobal = true;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id);

                if (user) {
                    const existingMediaIndex = user.viewedGalleryItems.findIndex(
                        item => item.mediaId.toString() === id
                    );

                    if (existingMediaIndex > -1) {
                        const lastView = user.viewedGalleryItems[existingMediaIndex].lastViewedAt;
                        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

                        // If user viewed this less than 10 minutes ago, BLOCK the increment
                        if (lastView > tenMinutesAgo) {
                            shouldIncrementGlobal = false;
                        } else {
                            user.viewedGalleryItems[existingMediaIndex].count += 1;
                            user.viewedGalleryItems[existingMediaIndex].lastViewedAt = Date.now();
                        }
                    } else {
                        user.viewedGalleryItems.push({ mediaId: id, count: 1, lastViewedAt: Date.now() });
                    }
                    if (shouldIncrementGlobal) await user.save({ validateBeforeSave: false });
                }
            } catch (err) {
                // Invalid token fallback
            }
        }

        if (shouldIncrementGlobal) {
            const galleryItem = await GalleryItem.findByIdAndUpdate(
                id, { $inc: { views: 1 } }, { new: true }
            );

            // ✨ REAL-TIME SYNC: Broadcast updated view metrics straight to the Admin panel room
            const io = req.app.get('io');
            if (io) {
                io.to('admin_room').emit('gallery_view_update', {
                    mediaId: id,
                    views: galleryItem.views
                });
            }

            return res.status(200).json({ success: true, views: galleryItem.views });
        } else {
            // Return current views without incrementing (Cooldown active)
            const item = await GalleryItem.findById(id).select('views');
            return res.status(200).json({ success: false, message: "Cooldown active", views: item.views });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to update view count." });
    }
});


module.exports = galleryRouter;