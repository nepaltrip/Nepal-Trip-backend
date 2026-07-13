// middleware/trackActivity.js
const User = require('../models/User');

const trackActivity = async (req, res, next) => {
    if (req.user?.id) {
        // fire-and-forget, don't block the request or care if it fails
        User.findByIdAndUpdate(req.user.id, { lastSeenAt: new Date() }).catch(() => { });
    }
    next();
};

module.exports = trackActivity;