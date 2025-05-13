// api/addTutor.js
const connectToDatabase = require('./connectToDatabase');
const jwt = require('jsonwebtoken');
const Tutor = require('../models/Tutor');
const cookieParser = require('cookie-parser');

// Helper function to extract and verify token
function verifyToken(req) {
    try {
        // Parse cookies if they haven't been parsed yet
        if (!req.cookies) {
            const cookieHeader = req.headers.cookie;
            if (!cookieHeader) {
                console.log('No cookie header found');
                return [false, "No authentication token found"];
            }

            // Manually parse cookies
            const cookies = {};
            cookieHeader.split(';').forEach(cookie => {
                const parts = cookie.split('=');
                const name = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                cookies[name] = value;
            });
            req.cookies = cookies;
        }

        // Get the token from cookies
        const token = req.cookies.token;

        // Check if token exists
        if (!token) {
            console.log('No token found in cookies:', req.cookies);
            return [false, "No authentication token found"];
        }

        // Check if JWT_SECRET is set
        const SECRET = process.env.JWT_SECRET;
        if (!SECRET) {
            console.log('JWT_SECRET is not set');
            return [false, "Server configuration error: JWT_SECRET missing"];
        }

        // Verify the token
        const decoded = jwt.verify(token, SECRET);
        console.log('Token verified successfully:', decoded);
        return [true, decoded];
    } catch (error) {
        console.error('Token verification error:', error.message);
        return [false, "Invalid authentication token"];
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Verify authentication
    const [ok, payloadOrMsg] = verifyToken(req);
    if (!ok) {
        console.log('Authentication failed:', payloadOrMsg);
        return res.status(401).json({ message: payloadOrMsg });
    }

    // Check if user is admin
    const userRole = (payloadOrMsg.role || '').toLowerCase();
    if (userRole !== 'admin') {
        console.log('Access denied: User role is', userRole);
        return res.status(403).json({ message: "Access denied: Admin only" });
    }

    try {
        console.log('Connecting to database...');
        await connectToDatabase();
        console.log('Database connected successfully');

        // Log the request body for debugging
        console.log('Request body:', req.body);

        // Extract fields from request body
        const {
            name,
            subjects,
            costRange,
            badges,
            contact,
            description,
            postcodes,
            imagePath = ''
        } = req.body;

        // Validate required fields
        if (!name || !subjects || !costRange) {
            console.log('Missing required fields:', { name, subjects, costRange });
            return res.status(400).json({
                message: "Missing required fields: name, subjects, and costRange are required"
            });
        }

        // Create new Tutor
        console.log('Creating new tutor with data:', {
            name,
            subjects: Array.isArray(subjects) ? subjects : [subjects],
            costRange,
            badges: Array.isArray(badges) ? badges : [badges],
            contact,
            description,
            postcodes: Array.isArray(postcodes) ? postcodes : [postcodes],
            imagePath
        });

        const newTutor = new Tutor({
            name,
            subjects: Array.isArray(subjects) ? subjects : [subjects],
            costRange,
            badges: Array.isArray(badges) ? badges : [badges],
            contact,
            description,
            postcodes: Array.isArray(postcodes) ? postcodes : [postcodes],
            imagePath
        });

        // Save the tutor to the database
        console.log('Saving tutor to database...');
        const savedTutor = await newTutor.save();
        console.log('Tutor saved successfully:', savedTutor);

        return res.status(201).json({
            message: "Tutor added successfully",
            tutor: savedTutor
        });
    } catch (error) {
        console.error("Error adding tutor:", error);

        // Provide more detailed error information
        let errorMessage = "Server error";
        if (error.name === 'ValidationError') {
            errorMessage = "Validation error: " + Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.name === 'MongoServerError' && error.code === 11000) {
            errorMessage = "Duplicate key error: This tutor may already exist";
        }

        return res.status(500).json({
            message: errorMessage,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
