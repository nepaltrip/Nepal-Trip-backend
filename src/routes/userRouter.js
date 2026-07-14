const express = require('express');
const userRouter = express.Router();
const Fuse = require('fuse.js');
const { State, City } = require('country-state-city');
const User = require('../models/User');
const { userAuth, superAdminAuth, adminAuth } = require('../middleware/authMiddleware');
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const assetsS3Client = require('../config/cloudflareAssetsS3');

// ==========================================
// IMPROVED HELPER: Case-Insensitive Fuzzy Match
// ==========================================
const findBestMatch = (query, list, keys) => {
    if (!query) return null;

    // Clean up incoming query string
    const cleanQuery = query.trim();

    // Loosened threshold to 0.5 to catch natural variations safely
    const fuse = new Fuse(list, {
        keys,
        threshold: 0.5,
        distance: 100,
        ignoreLocation: true
    });

    const result = fuse.search(cleanQuery);

    if (result.length > 0) {
        return result[0].item.name;
    }

    // Direct case-insensitive fallback search if fuse yields nothing
    const exactFallback = list.find(item =>
        item.name.toLowerCase() === cleanQuery.toLowerCase()
    );

    return exactFallback ? exactFallback.name : cleanQuery;
};

// ==========================================
// ROUTE: Update Location & Fuzzy Matching
// ==========================================
userRouter.post('/location', userAuth, async (req, res) => {
    try {
        const { latitude, longitude, rawState, rawDistrict, forceUpdate } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // COOLDOWN CHECK
        if (!forceUpdate && user.lastLocationFetch) {
            const hoursSinceLastFetch = (new Date() - user.lastLocationFetch) / (1000 * 60 * 60);
            if (hoursSinceLastFetch < 24) {
                return res.status(200).json({
                    message: "Location up to date (Cooldown active)",
                    state: user.state,
                    district: user.district
                });
            }
        }

        // 1. Fetch Indian States list
        const indiaStates = State.getStatesOfCountry('IN');

        // 2. Resolve fuzzy State identity
        const matchedStateName = findBestMatch(rawState, indiaStates, ['name']);

        // 3. Match state object using case-insensitive validation
        const matchedStateObj = indiaStates.find(s =>
            s.name.toLowerCase() === matchedStateName.toLowerCase()
        );

        let matchedDistrictName = rawDistrict;

        // 4. Resolve fuzzy District identity inside that specific state context
        if (matchedStateObj) {
            const citiesInState = City.getCitiesOfState('IN', matchedStateObj.isoCode);
            matchedDistrictName = findBestMatch(rawDistrict, citiesInState, ['name']);
        }

        // TERMINAL DEBUG LOGGING: Check your Node console to see what is passing
        console.log("--- LOCATION DATA PARSING ---");
        console.log(`Incoming: State -> ${rawState} | District -> ${rawDistrict}`);
        console.log(`Resolved: State -> ${matchedStateName} | District -> ${matchedDistrictName}`);
        console.log("------------------------------");

        // FIX: Atomic Find & Update completely bypasses Mongoose schema update detection bugs
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
                    state: matchedStateName,
                    district: matchedDistrictName,
                    lastLocationFetch: new Date()
                }
            },
            { returnDocument: 'after', runValidators: true } // Return the freshly modified document
        );

        res.status(200).json({
            message: "Location updated successfully",
            state: updatedUser.state,
            district: updatedUser.district
        });
    } catch (error) {
        console.error("Location update error:", error);
        res.status(500).json({ message: "Server error updating location" });
    }
});

// ==========================================
// ROUTE: Save PWA Push Subscription
// ==========================================
userRouter.post('/push-subscribe', userAuth, async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user.id;

        await User.findByIdAndUpdate(userId, {
            $set: { pushSubscription: subscription }
        });

        res.status(200).json({ message: "Push subscription saved successfully" });
    } catch (error) {
        console.error("Push subscription error:", error);
        res.status(500).json({ message: "Server error saving push subscription" });
    }
});

// ==========================================
// ROUTE: Update User Profile (Highly Secure & R2 Optimized)
// ==========================================
userRouter.put('/:id', userAuth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const requestingUser = req.user;

        const isSelf = requestingUser.id === targetUserId;
        const isAdmin = requestingUser.role === 'Admin';
        const isSuperAdmin = requestingUser.role === 'SuperAdmin';

        // 1. STRICT BASE CHECK
        if (!isSelf && !isAdmin && !isSuperAdmin) {
            return res.status(403).json({ message: "Unauthorized: You can only modify your own profile." });
        }

        // 2. FETCH TARGET USER 
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // 3. HIERARCHY PROTECTION
        if (!isSelf && isAdmin) {
            if (targetUser.role === 'SuperAdmin' || targetUser.role === 'Admin') {
                return res.status(403).json({ message: "Unauthorized: Admins cannot modify other administrative accounts." });
            }
        }

        // 4. PREPARE DATA
        const { name, email, phone, role, profilePic, password } = req.body;
        const oldProfilePic = targetUser.profilePic; // Save the old URL before we overwrite it

        if (name) targetUser.name = name;
        if (email) targetUser.email = email;
        if (phone !== undefined) targetUser.mobile = phone;
        if (password) targetUser.password = password;

        // 5. HANDLE PROFILE PICTURE & R2 CLEANUP
        if (profilePic !== undefined && profilePic !== oldProfilePic) {
            targetUser.profilePic = profilePic; // Update to new picture (or empty string)

            // If they had an old picture, delete it from the R2 bucket
            if (oldProfilePic) {
                try {
                    // Extract the Object Key from the public URL
                    const publicUrlBase = process.env.R2_ASSETS_PUBLIC_URL || "";
                    let fileKey = oldProfilePic;

                    if (publicUrlBase && oldProfilePic.startsWith(publicUrlBase)) {
                        fileKey = oldProfilePic.replace(`${publicUrlBase}/`, '');
                    } else {
                        // Fallback extraction just in case
                        const urlObj = new URL(oldProfilePic);
                        fileKey = urlObj.pathname.substring(1);
                    }

                    // Send the delete command to Cloudflare R2
                    await assetsS3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.R2_ASSETS_BUCKET_NAME || "assets",
                        Key: decodeURIComponent(fileKey)
                    }));

                    console.log(`Cleaned up orphaned profile pic: ${fileKey}`);
                } catch (r2Error) {
                    // We catch this error without crashing the server. 
                    // If R2 deletion fails, we still want the DB update to succeed!
                    console.error("Failed to delete old profile pic from R2:", r2Error);
                }
            }
        }

        // 6. STRICT ROLE MODIFICATION
        if (role && role !== targetUser.role) {
            if (!isSuperAdmin) {
                return res.status(403).json({ message: "Unauthorized: Only SuperAdmins can change user roles." });
            }
            targetUser.role = role;
        }

        // 7. EXECUTE THE UPDATE
        const updatedUser = await targetUser.save();

        // 8. RETURN FORMATTED DATA
        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.mobile,
                role: updatedUser.role,
                profilePic: updatedUser.profilePic,
                location: updatedUser.district ? `${updatedUser.district}, ${updatedUser.state}` : '',
            }
        });

    } catch (error) {
        console.error("Profile update error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: "Email or phone number is already in use by another account." });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: "Server error updating profile" });
    }
});

// ==========================================
// ROUTE: Delete User Account (Self / Admin / SuperAdmin)
// ==========================================
userRouter.delete('/:id', userAuth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const requestingUser = req.user;

        const isSelf = requestingUser.id === targetUserId;
        const isAdminOrSuper = ['Admin', 'SuperAdmin'].includes(requestingUser.role);

        if (!isSelf && !isAdminOrSuper) {
            return res.status(403).json({ message: "Not authorized to delete this account." });
        }

        const deletedUser = await User.findByIdAndDelete(targetUserId);
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.status(200).json({ success: true, message: "Account permanently deleted." });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ message: "Server error deleting account." });
    }
});

// ==========================================
// ROUTE: Toggle Ban Status (Admin / SuperAdmin Only)
// ==========================================
userRouter.patch('/:id/ban', userAuth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const requestingUser = req.user;
        const { status } = req.body; // Expects 'active' or 'banned'

        if (!['Admin', 'SuperAdmin'].includes(requestingUser.role)) {
            return res.status(403).json({ message: "Only administrators can modify ban status." });
        }

        if (requestingUser.id === targetUserId) {
            return res.status(400).json({ message: "You cannot ban your own admin account." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            targetUserId,
            { $set: { status: status } },
            { new: true, runValidators: true }
        ).select('-password -refreshTokens');

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        res.status(200).json({
            success: true,
            message: `User is now ${status}`,
            user: updatedUser
        });
    } catch (error) {
        console.error("Ban user error:", error);
        res.status(500).json({ message: "Server error updating ban status." });
    }
});

// ==========================================
// ROUTE: Get User Profile (For Modal Sync)
// ==========================================
userRouter.get('/:id', userAuth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const requestingUser = req.user;

        const isSelf = requestingUser.id === targetUserId;
        const isAdminOrSuper = ['Admin', 'SuperAdmin'].includes(requestingUser.role);
        if (!isSelf && !isAdminOrSuper) {
            return res.status(403).json({ message: "Not authorized to view this profile." });
        }

        const user = await User.findById(targetUserId).select('-password -refreshTokens');
        if (!user) return res.status(404).json({ message: "User not found." });

        const lastSeen = user.lastSeenAt || user.updatedAt;

        res.status(200).json({ user: { ...user.toObject(), lastSeen } });
    } catch (error) {
        console.error("Fetch user error:", error);
        res.status(500).json({ message: "Server error fetching user profile." });
    }
});

module.exports = userRouter;