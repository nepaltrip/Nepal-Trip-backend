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
    adminAuth,
    superAdminAuth
};