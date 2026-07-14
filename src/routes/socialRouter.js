const express = require('express');
const Social = require('../models/Social');
const { userAuth } = require('../middleware/authMiddleware'); // Adjust path to your auth middleware

const socialRouter = express.Router();

// ==========================================
// PUBLIC ROUTE: Get Global Site Configuration
// Used by the footer to fetch the latest details
// ==========================================
socialRouter.get('/', async (req, res) => {
    try {
        // Find the first (and only) configuration document
        let config = await Social.findOne();

        // If no config exists yet, return an empty object so the frontend doesn't crash
        if (!config) {
            config = {
                email: "", phone: "", address: "",
                whatsapp: "", youtube: "", instagram: "", facebook: "", twitter: ""
            };
        }

        res.status(200).json({ success: true, data: config });
    } catch (error) {
        console.error("Fetch Site Config Error:", error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ==========================================
// SECURED ROUTE: Update Global Site Configuration
// Allowed only for Admin and SuperAdmin
// ==========================================
socialRouter.put('/', userAuth, async (req, res) => {
    try {
        const requestingUser = req.user;

        // Role Authorization Check
        if (!['Admin', 'SuperAdmin'].includes(requestingUser.role)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only Administrators can modify the global site configuration."
            });
        }

        const {
            email, phone, address,
            whatsapp, youtube, instagram, facebook, twitter
        } = req.body;

        // Using findOneAndUpdate with { upsert: true } ensures that if a document doesn't exist, 
        // it creates one. If it does exist, it updates the single existing document.
        const updatedConfig = await Social.findOneAndUpdate(
            {}, // Empty filter matches the very first document in the collection
            {
                $set: {
                    email, phone, address,
                    whatsapp, youtube, instagram, facebook, twitter
                }
            },
            {
                new: true,       // Return the updated document
                upsert: true,    // Create if it doesn't exist
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: 'Site configuration updated successfully',
            data: updatedConfig
        });

    } catch (error) {
        console.error("Update Site Config Error:", error);

        // Handle Mongoose Validation Errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }

        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = socialRouter;