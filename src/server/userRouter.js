const express = require('express');
const userRouter = express.Router();
const Fuse = require('fuse.js');
const { State, City } = require('country-state-city');
const User = require('../models/User');
const { userAuth } = require('../middleware/authMiddleware');

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
            { new: true, runValidators: true } // Return the freshly modified document
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

module.exports = userRouter;