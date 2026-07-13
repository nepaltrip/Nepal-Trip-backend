const jwt = require('jsonwebtoken');

const userAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        req.user = decoded; // Contains id and role
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired access token.' });
    }
};

// ✨ NEW: Optional Auth for routes that guests CAN access, but logged-in users get extra benefits
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // If no token exists, just move on! The user is treated as a guest.
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        // If a token exists, verify it and attach the user data
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;

        next();
    } catch (error) {
        // If the token exists but is invalid or expired, don't crash. 
        // Just treat them as a guest instead of throwing a 401 error.
        next();
    }
};

const adminAuth = (req, res, next) => {
    userAuth(req, res, () => {
        // Convert role to lowercase for case-insensitive matching
        const userRole = req.user.role ? req.user.role.toLowerCase() : '';

        if (userRole !== 'admin' && userRole !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
        }
        next();
    });
};

const superAdminAuth = (req, res, next) => {
    userAuth(req, res, () => {
        // Convert role to lowercase for case-insensitive matching
        const userRole = req.user.role ? req.user.role.toLowerCase() : '';

        if (userRole !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Access denied. SuperAdmin privileges required.' });
        }
        next();
    });
};

module.exports = {
    userAuth,
    optionalAuth,
    adminAuth,
    superAdminAuth
};