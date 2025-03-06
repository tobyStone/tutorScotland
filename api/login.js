// api/login.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Ensure this model includes { email, password, role, name, ... }
const connectToDatabase = require('./connectToDatabase');

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const { email, password } = req.body;
        try {
            await connectToDatabase();
            // Search for the user by email (case-insensitive)
            const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            // Compare passwords using bcrypt
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }
            if (!process.env.JWT_SECRET) {
                return res.status(500).json({ message: 'Internal server error: JWT_SECRET not set' });
            }
            // Generate a JWT token with the user's ID and role
            const token = jwt.sign(
                { id: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '3h' }
            );
            // Set the JWT in an HTTP-only cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3 * 60 * 60 * 1000
            });
            // Determine the redirect URL based on the user's role
            let redirectUrl = '/parents';
            if (user.role === 'admin') {
                redirectUrl = '/admin';
            }
            return res.json({
                user: { id: user._id, email: user.email, name: user.name, role: user.role },
                redirectUrl
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};
