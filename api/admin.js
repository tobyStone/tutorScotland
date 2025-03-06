// api/admin.js
const { verifyToken } = require('./auth');

module.exports = (req, res) => {
    verifyToken(req, res, () => {
        // verifyToken sets req.user if valid
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: admin only' });
        }
        // If OK, just respond with 200
        return res.status(200).json({ message: 'Welcome, admin!' });
    });
};
