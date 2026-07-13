const express = require('express');
const userRouter = express.Router();
const Fuse = require('fuse.js');
const { State, City } = require('country-state-city');
const User = require('../models/User');
const { userAuth, superAdminAuth, adminAuth } = require('../middleware/authMiddleware');

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
// ROUTE: Update User Profile (User/Admin/SuperAdmin)
// ==========================================
userRouter.put('/:id', userAuth, adminAuth, superAdminAuth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const requestingUser = req.user;

        // 1. Permission Check
        const isSelf = requestingUser.id === targetUserId;
        const isAdmin = requestingUser.role === 'Admin';
        const isSuperAdmin = requestingUser.role === 'SuperAdmin';

        if (!isSelf && !isAdmin && !isSuperAdmin) {
            return res.status(403).json({ message: "Not authorized to edit this profile" });
        }

        // 2. Prepare Update Data
        const { name, email, phone, role } = req.body;
        let updateFields = {};

        if (name) updateFields.name = name;
        if (email) updateFields.email = email;

        // Map frontend 'phone' to DB 'mobile'
        if (phone !== undefined) updateFields.mobile = phone;

        // 3. Strict Role Modification Protection
        // Only SuperAdmins are allowed to elevate or downgrade user roles
        if (role && role !== 'User' && !isSuperAdmin) {
            return res.status(403).json({ message: "Only SuperAdmins can modify access roles." });
        } else if (role && isSuperAdmin) {
            updateFields.role = role;
        }

        // 4. Update the Database
        const updatedUser = await User.findByIdAndUpdate(
            targetUserId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password -refreshTokens');

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // 5. Send back formatted data matching frontend expectations
        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.mobile,
                role: updatedUser.role,
                location: updatedUser.district ? `${updatedUser.district}, ${updatedUser.state}` : '',
            }
        });

    } catch (error) {
        console.error("Profile update error:", error);

        // Catch MongoDB Unique Constraint Errors (e.g., email or phone already in use)
        if (error.code === 11000) {
            return res.status(400).json({ message: "Email or phone number is already in use by another account." });
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