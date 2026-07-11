const crypto = require('crypto');
const Traffic = require('../models/Traffic');

const trackTraffic = async (req, res, next) => {
    try {
        // 1. Generate daily signature string
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // 2. Anonymize IP to respect privacy but maintain distinct tracking
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || '';
        const ipHash = crypto.createHash('md5').update(`${ip}-${userAgent}`).digest('hex');

        // 3. Detect device profile
        const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
        const deviceType = isMobile ? 'Mobile' : 'Desktop';

        // 4. Safely extract userId if parsed by an earlier auth middleware
        const userId = req.user ? req.user.id : null;

        // 5. Atomic check & inject. upsert handles high concurrency gracefully without crashing
        const isNewVisitToday = await Traffic.findOneAndUpdate(
            { dateString: todayStr, ipHash: ipHash },
            { $setOnInsert: { dateString: todayStr, ipHash: ipHash, deviceType, userId } },
            { upsert: true, new: false } // returns null if inserted brand new
        );

        // If it was inserted fresh right now, push a real-time event to the active dashboard admins!
        if (!isNewVisitToday) {
            const io = req.app.get('io');
            if (io) {
                // Fetch the updated rolling count to broadcast live
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const uniqueVisitorsCount = await Traffic.distinct('ipHash', {
                    createdAt: { $gte: thirtyDaysAgo }
                });

                io.to('admin_room').emit('dashboard_counter_update', {
                    action: 'live_visitor_update',
                    count: uniqueVisitorsCount.length
                });
            }
        }
    } catch (error) {
        // Silently catch tracking errors so a logging failure never breaks the customer app load
        console.error("Traffic tracking failure:", error.message);
    }
    next();
};

module.exports = { trackTraffic };