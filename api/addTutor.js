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

// Helper function to normalize tutor data
function normalizeTutorData(body) {
    const asArray = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        return value.split(',').map(x => x.trim()).filter(Boolean);
    };

    return {
        name: body.name?.trim(),
        subjects: asArray(body.subjects),
        costRange: body.costRange?.trim(),
        badges: asArray(body.badges),
        contact: body.contact?.trim(),
        description: body.description?.trim(),
        postcodes: asArray(body.postcodes),
        imagePath: body.imagePath || ''
    };
}

module.exports = async (req, res) => {
    // Allow POST, PUT, and DELETE methods
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
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

        // Handle PUT request - Update existing tutor
        if (req.method === 'PUT') {
            console.log('Processing PUT request for tutor update');
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ message: 'Tutor ID is required for update.' });
            }

            const updateData = normalizeTutorData(req.body);

            // Handle image removal
            if (req.body.removeImage === 'true' || req.body.removeImage === true) {
                updateData.imagePath = '';
            }

            try {
                const updatedTutor = await Tutor.findByIdAndUpdate(id, updateData, {
                    new: true,
                    runValidators: true
                });

                if (!updatedTutor) {
                    return res.status(404).json({ message: 'Tutor not found for update.' });
                }

                console.log('Tutor updated successfully:', updatedTutor._id);
                return res.status(200).json({
                    message: "Tutor updated successfully",
                    tutor: updatedTutor
                });
            } catch (error) {
                console.error('Error updating tutor:', error);
                return res.status(500).json({
                    message: 'Error updating tutor',
                    error: error.message
                });
            }
        }

        // Handle DELETE request
        if (req.method === 'DELETE') {
            const { id } = req.query;

            if (!id) {
                console.log('Missing tutor ID for deletion');
                return res.status(400).json({
                    message: "Missing tutor ID"
                });
            }

            console.log(`Attempting to delete tutor with ID: ${id}`);

            try {
                const deletedTutor = await Tutor.findByIdAndDelete(id);

                if (!deletedTutor) {
                    console.log(`Tutor with ID ${id} not found`);
                    return res.status(404).json({
                        message: "Tutor not found"
                    });
                }

                console.log(`Tutor with ID ${id} deleted successfully`);
                return res.status(200).json({
                    message: "Tutor deleted successfully",
                    tutor: deletedTutor
                });
            } catch (deleteError) {
                console.error(`Error deleting tutor with ID ${id}:`, deleteError);
                return res.status(500).json({
                    message: "Error deleting tutor",
                    error: deleteError.message
                });
            }
        }

        // Handle POST request (add tutor or update fallback)
        console.log('Processing POST request');

        // Check for update fallback (editId in body)
        const { editId } = req.body;
        if (editId) {
            console.log('POST request with editId - processing as update fallback');
            const updateData = normalizeTutorData(req.body);

            // Handle image removal
            if (req.body.removeImage === 'true' || req.body.removeImage === true) {
                updateData.imagePath = '';
            }

            try {
                const updatedTutor = await Tutor.findByIdAndUpdate(editId, updateData, {
                    new: true,
                    runValidators: true
                });

                if (!updatedTutor) {
                    return res.status(404).json({ message: 'Tutor not found for update.' });
                }

                console.log('Tutor updated successfully via POST fallback:', updatedTutor._id);
                return res.status(200).json({
                    message: "Tutor updated successfully",
                    tutor: updatedTutor
                });
            } catch (error) {
                console.error('Error updating tutor via POST fallback:', error);
                return res.status(500).json({
                    message: 'Error updating tutor',
                    error: error.message
                });
            }
        }

        // Handle POST request (add tutor)
        console.log('Request body:', req.body);

        // Normalize and validate tutor data
        const tutorData = normalizeTutorData(req.body);

        // Validate required fields
        if (!tutorData.name || !tutorData.subjects.length || !tutorData.costRange) {
            console.log('Missing required fields:', tutorData);
            return res.status(400).json({
                message: "Missing required fields: name, subjects, and costRange are required"
            });
        }

        // Create new Tutor
        console.log('Creating new tutor with data:', tutorData);
        const newTutor = new Tutor(tutorData);

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
