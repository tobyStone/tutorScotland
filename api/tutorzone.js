// api/tutorszone.js
const { verifyToken } = require('./auth');

module.exports = (req, res) => {
    verifyToken(req, res, () => {
        if (req.user.role !== 'tutor') {
            return res.status(403).json({ message: 'Access denied: tutors only' });
        }
        return res.status(200).json({ message: 'Welcome, tutor!' });
    });
};
