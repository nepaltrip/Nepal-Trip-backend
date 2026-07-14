const express = require('express');
const packageRouter = express.Router();
const Package = require('../models/Package');
const { userAuth, superAdminAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// PUBLIC: Get all active packages
packageRouter.get('/', async (req, res) => {
    try {
        const packages = await Package.find({ isActive: true })
            .select('-itinerary -inclusions -exclusions')
            .sort({ createdAt: -1 });
        res.status(200).json(packages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching packages." });
    }
});

// PUBLIC: Get single package by slug
packageRouter.get('/:slug', async (req, res) => {
    try {
        const pkg = await Package.findOne({ slug: req.params.slug, isActive: true });
        if (!pkg) return res.status(404).json({ message: "Package not found." });

        pkg.totalClicks += 1;
        pkg.save();

        res.status(200).json(pkg);
    } catch (error) {
        res.status(500).json({ message: "Error fetching package details." });
    }
});

// ==========================================
// SUPERADMIN ROUTES (God Mode Mutations)
// ==========================================

// POST: ZERO-POPUP INSTANT DRAFT CREATION
packageRouter.post('/', userAuth, superAdminAuth, async (req, res) => {
    try {
        const uniqueSlug = `draft-package-${Date.now().toString().slice(-6)}`;

        const defaultPkg = {
            title: "New Custom Journey",
            slug: uniqueSlug,
            category: "Nature",
            // ✨ CHANGED: Now defaults to "Gold" instead of "All"
            serviceTier: "Gold",
            destination: "Set Destination",
            duration_days: 3,
            duration_nights: 2,
            price_gold: 25000,
            price_platinum: 45000,
            cover_image_mobile: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800&auto=format&fit=crop",
            cover_image_desktop: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1600&auto=format&fit=crop",
            short_description: "Short highlight description of the trip goes here.",
            isActive: true
        };

        const newPackage = await Package.create(defaultPkg);
        res.status(201).json(newPackage);
    } catch (error) {
        console.error("POST /packages error:", error);
        res.status(500).json({ message: "Failed to generate dummy package." });
    }
});

// POST: BULLETPROOF RESTORE DEFAULTS
packageRouter.post('/restore-defaults', userAuth, superAdminAuth, async (req, res) => {
    try {
        await Package.deleteMany({}); // Wipe clean

        const dummyPackages = [
            { title: "Ladakh Himalayan Adventure", slug: "ladakh-himalayan-adventure", category: "Mountains", serviceTier: "Platinum", destination: "Ladakh, India", duration_days: 7, duration_nights: 6, price_inr: 45000, cover_image_mobile: "https://images.unsplash.com/photo-1626714485857-79774681600c?q=80&w=800&auto=format&fit=crop", cover_image_desktop: "https://images.unsplash.com/photo-1626714485857-79774681600c?q=80&w=1600&auto=format&fit=crop", short_description: "A high-altitude journey through monasteries, deep valleys and turquoise lakes.", isActive: true },
            { title: "Maldives Overwater Escape", slug: "maldives-overwater-escape", category: "Beach", serviceTier: "Platinum", destination: "Maldives", duration_days: 5, duration_nights: 4, price_inr: 120000, cover_image_mobile: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=800&auto=format&fit=crop", cover_image_desktop: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?q=80&w=1600&auto=format&fit=crop", short_description: "Overwater villas, coral reefs and endless turquoise horizons.", isActive: true },
            { title: "Kerala Backwaters & Beaches", slug: "kerala-backwaters-beaches", category: "Nature", serviceTier: "Gold", destination: "Kerala, India", duration_days: 6, duration_nights: 5, price_inr: 32000, cover_image_mobile: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=800&auto=format&fit=crop", cover_image_desktop: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=1600&auto=format&fit=crop", short_description: "Houseboats, spice hills and the calm rhythm of Gods Own Country.", isActive: true }
        ];

        const restored = await Package.insertMany(dummyPackages);
        res.status(200).json(restored);
    } catch (error) {
        res.status(500).json({ message: "Failed to restore defaults." });
    }
});

// PUT: Inline Editing update
packageRouter.put('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        if (req.body.itinerary) {
            req.body.itinerary.forEach(day => {
                if (day._id && !day._id.match(/^[0-9a-fA-F]{24}$/)) delete day._id;
            });
        }
        const updatedPackage = await Package.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { returnDocument: 'after', runValidators: true }
        );
        if (!updatedPackage) return res.status(404).json({ message: "Package not found." });
        res.status(200).json(updatedPackage);
    } catch (error) {
        res.status(500).json({ message: "Failed to update package." });
    }
});

// DELETE: Remove package
packageRouter.delete('/:id', userAuth, superAdminAuth, async (req, res) => {
    try {
        const deleted = await Package.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Package not found." });
        res.status(200).json({ message: "Package deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete package." });
    }
});


// ==========================================
// POST: CONTINUOUS HEARTBEAT TELEMETRY
// ==========================================
packageRouter.post('/:id/telemetry', async (req, res) => {
    try {
        const packageId = req.params.id;
        const { actionType, tier, durationSeconds, packageName, category, isClick } = req.body;

        const pkg = await Package.findById(packageId);
        if (!pkg) return res.status(404).json({ message: "Package not found" });

        // Increment global click counter regardless of auth status
        if (isClick) pkg.totalClicks += 1;

        // 1. Manually extract JWT to support all requests
        let userId = null;
        let token = null;

        if (req.cookies && req.cookies.accessToken) token = req.cookies.accessToken;
        else if (req.cookies && req.cookies.token) token = req.cookies.token;
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                userId = decoded.id || decoded._id;
            } catch (err) { /* Invalid token */ }
        }

        // 2. If Anonymous, save package clicks and exit immediately. No tracking.
        if (!userId) {
            await pkg.save();
            return res.status(200).json({ success: true, message: "Anonymous click tracked" });
        }

        // 3. AUTHENTICATED USER TRACKING
        const user = await User.findById(userId);
        if (user) {
            let crmRecord = user.crmActivity.find(c => c.packageId.toString() === packageId);

            if (!crmRecord) {
                user.crmActivity.push({ packageId, packageName, category });
                crmRecord = user.crmActivity[user.crmActivity.length - 1];
            }

            // Bucket Time Allocations
            if (actionType === 'outside_hover') crmRecord.timeSpentOutside += durationSeconds;
            if (actionType === 'inside_detail' && tier === 'Gold') crmRecord.timeSpentGold += durationSeconds;
            if (actionType === 'inside_detail' && tier === 'Platinum') crmRecord.timeSpentPlatinum += durationSeconds;

            if (isClick) {
                crmRecord.totalClicks += 1;
                // ✨ FIX: Increment the global visits counter so it stops showing 0!
                user.totalPackageVisits = (user.totalPackageVisits || 0) + 1;
            }
            crmRecord.lastActiveAt = Date.now();

            // Prune logs older than 7 days dynamically
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            crmRecord.recentLogs = crmRecord.recentLogs.filter(log => new Date(log.timestamp) >= sevenDaysAgo);

            // Push New 7-Day Log
            if (durationSeconds > 0 || isClick) {
                crmRecord.recentLogs.push({
                    timestamp: Date.now(),
                    durationAdded: durationSeconds,
                    actionType: isClick ? 'click' : actionType,
                    tier: tier && ['Gold', 'Platinum'].includes(tier) ? tier : 'None'
                });
            }

            // Recalculate Top Vibe
            const vibeCounts = {};
            let maxTime = 0;
            let topPkgName = user.mostViewedPackageName;

            user.crmActivity.forEach(c => {
                const totalTime = c.timeSpentOutside + c.timeSpentGold + c.timeSpentPlatinum;
                vibeCounts[c.category] = (vibeCounts[c.category] || 0) + totalTime;

                if (totalTime > maxTime) {
                    maxTime = totalTime;
                    topPkgName = c.packageName;
                }
            });

            user.topVibe = Object.keys(vibeCounts).reduce((a, b) => vibeCounts[a] > vibeCounts[b] ? a : b, "None");
            user.mostViewedPackageName = topPkgName;

            await user.save();

            // Lightweight Package authViewers update
            const existingAuthViewer = pkg.authViewers.find(v => v.userId.toString() === userId.toString());
            if (existingAuthViewer) {
                existingAuthViewer.count += (isClick ? 1 : 0);
                existingAuthViewer.lastViewedAt = Date.now();
            } else {
                pkg.authViewers.push({ userId, count: isClick ? 1 : 0, lastViewedAt: Date.now() });
            }
        }

        await pkg.save();

        // 4. BROADCAST LIVE TO SUPERADMIN (Cleaned of anon fields)
        const io = req.app.get('io');
        if (io) {
            io.to('admin_room').emit('package_engagement_update', {
                packageId,
                packageName,
                triggerUser: userId // Alerts the frontend that an auth user triggered an update
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Telemetry error:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = packageRouter;