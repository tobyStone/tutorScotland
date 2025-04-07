// api/admin.js
const connectToDatabase = require('./db');
const { verifyToken } = require('./auth');

module.exports = async (req, res) => {
    try {
        // Connect to database first
        await connectToDatabase();
        
        verifyToken(req, res, () => {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied: admin only' });
            }
            return res.status(200).json({ message: 'Welcome, admin!' });
        });
    } catch (error) {
        console.error('Database connection error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
