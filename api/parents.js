// api/parents.js
const { verifyToken } = require('./auth');

module.exports = (req, res) => {
    verifyToken(req, res, () => {
        // Now we know the token is valid
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Access denied: parents only' });
        }
        // If OK, just respond with 200
        return res.status(200).json({ message: 'Welcome, parent!' });
    });
};
