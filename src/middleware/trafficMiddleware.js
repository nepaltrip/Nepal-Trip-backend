const crypto = require('crypto');
const Traffic = require('../models/Traffic');

const trackTraffic = async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        // ✨ THE FIX: Prioritize the permanent browser ID sent from React.
        // (We keep the IP hash as a fallback just in case).
        const visitorSignature = req.body.visitorId || crypto.createHash('md5').update(`${req.socket.remoteAddress}-${req.headers['user-agent']}`).digest('hex');

        const isMobile = /mobile|android|iphone|ipad|phone/i.test(req.headers['user-agent'] || '');
        const deviceType = isMobile ? 'Mobile' : 'Desktop';
        const userId = req.user ? req.user.id : null;

        // Use visitorSignature to check for duplicates
        const isNewVisitToday = await Traffic.findOneAndUpdate(
            { dateString: todayStr, ipHash: visitorSignature },
            { $setOnInsert: { dateString: todayStr, ipHash: visitorSignature, deviceType, userId } },
            { upsert: true, new: false }
        );

        if (!isNewVisitToday) {
            const io = req.app.get('io');
            if (io) {
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
        console.error("Traffic tracking failure:", error.message);
    }
    next();
};

module.exports = { trackTraffic };