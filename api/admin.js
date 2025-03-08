// api/admin.js
const { verifyToken } = require('./auth');

module.exports = (req, res) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: admin only' });
        }
        return res.status(200).json({ message: 'Welcome, admin!' });
    });
};
