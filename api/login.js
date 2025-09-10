/**
 * @fileoverview Authentication API for Tutors Alliance Scotland admin access
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Secure authentication system supporting:
 * - Admin login with bcrypt password hashing
 * - JWT token generation and validation
 * - HTTP-only cookie management
 * - Role-based access control
 *
 * @security Implements secure password hashing and JWT tokens
 * @performance Efficient database queries and token validation
 */

// api/login.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { serialize, parse } = require('cookie');  // <-- important for setting cookies manually
const connectToDatabase = require('./connectToDatabase');

// Import User model - use try/catch approach similar to tutors.js
let User;
try {
    // Try to get the existing model first
    User = require('mongoose').model('User');
} catch {
    // If it doesn't exist, import it from the models directory
    try {
        User = require('../models/User.js');
    } catch (error) {
        console.error('Error importing User model:', error);
        // This will cause the login to fail, which is appropriate
        User = null;
    }
}

/**
 * Main authentication API handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with authentication result
 *
 * @description Handles authentication operations:
 * - GET ?check=admin: Verify admin authentication status
 * - POST: Admin login with credentials validation
 *
 * @example
 * // GET /api/login?check=admin
 * // POST /api/login with { username, password }
 *
 * @security Uses bcrypt for password hashing and JWT for session management
 * @throws {Error} 401 - Invalid credentials or authentication failure
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    // Handle auth check requests
    if (req.method === 'GET' && req.query.check === 'admin') {
        return handleAdminCheck(req, res);
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { email, password } = req.body;
    try {
        await connectToDatabase();

        // Check if User model is available
        if (!User) {
            console.error('User model is not available');
            return res.status(500).json({ message: 'Server error: User model not available' });
        }

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

        // Ensure JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'Internal server error: JWT_SECRET not set' });
        }

        // Generate a JWT token with the user's ID and role
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );

        // Manually set the HTTP-only cookie using the `cookie` library
        // In Vercel serverless, res.cookie() is not available.
        const serializedCookie = serialize('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3 * 60 * 60, // 3 hours in seconds
            path: '/'            // cookie valid on entire site
        });
        res.setHeader('Set-Cookie', serializedCookie);

        // If admin => /admin.html, else if tutor => /tutorszone.html
        let redirectUrl = '/tutorszone.html';
        if (user.role === 'admin') {
            redirectUrl = '/admin.html';
        } else if (user.role === 'blogwriter') {
            // For example, go to /blogwriter.html or /blog-writer (your choice)
            redirectUrl = '/blogWriter.html';
        } else if (user.role === 'tutor') {
            redirectUrl = '/tutorszone.html';
        }


        return res.status(200).json({
            user: { id: user._id, email: user.email, name: user.name, role: user.role },
            redirectUrl
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Function to check if user is admin
async function handleAdminCheck(req, res) {
    try {
        // Parse cookies from request headers
        const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
        const token = cookies.token;

        if (!token) {
            return res.status(200).json({ isAdmin: false });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user is admin
        const isAdmin = decoded.role === 'admin';

        return res.status(200).json({
            isAdmin,
            user: { id: decoded.id, role: decoded.role }
        });
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(200).json({ isAdmin: false });
    }
}
