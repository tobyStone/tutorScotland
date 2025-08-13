// api/addTutor.js
const connectToDatabase = require('./connectToDatabase');
const jwt = require('jsonwebtoken');
const Tutor = require('../models/Tutor');
const cookieParser = require('cookie-parser');

// Canonical region labels used across the app
const CANONICAL_REGIONS = [
  'Aberdeen & Aberdeenshire', 'Dundee & Angus', 'Fife', 'Perth & Kinross',
  'Edinburgh & Lothians', 'Glasgow & West', 'Stirling & Falkirk', 'Lanarkshire',
  'Ayrshire', 'Dumfries & Galloway', 'Scottish Borders', 'Highlands', 'Moray',
  'Argyll & Bute', 'Orkney', 'Shetland', 'Western Isles', 'Caithness & Sutherland', 'Online'
];

function toKey(str = '') {
  return String(str).toLowerCase().trim().replace(/\s+/g, ' ').replace(/\band\b/g, '&');
}

const REGION_SYNONYMS = (() => {
  const map = new Map();
  for (const label of CANONICAL_REGIONS) {
    const keyAmp = toKey(label);
    const keyAnd = toKey(label.replace(/&/g, 'and'));
    map.set(keyAmp, label);
    map.set(keyAnd, label);
  }
  // Extra common variants
  map.set(toKey('on line'), 'Online');
  map.set(toKey('on-line'), 'Online');
  return map;
})();

function canonicalizeRegion(input) {
  const key = toKey(input);
  return REGION_SYNONYMS.get(key) || null;
}

function canonicalizeRegionArray(arr) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(arr) ? arr : [arr]) {
    if (!v) continue;
    const canon = canonicalizeRegion(v);
    if (canon && !seen.has(canon)) { seen.add(canon); out.push(canon); }
  }
  return out;
}

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

        // Handle DELETE request
        if (req.method === 'DELETE') {
            const tutorId = req.query.id;

            if (!tutorId) {
                console.log('Missing tutor ID for deletion');
                return res.status(400).json({
                    message: "Missing tutor ID"
                });
            }

            console.log(`Attempting to delete tutor with ID: ${tutorId}`);

            try {
                const deletedTutor = await Tutor.findByIdAndDelete(tutorId);

                if (!deletedTutor) {
                    console.log(`Tutor with ID ${tutorId} not found`);
                    return res.status(404).json({
                        message: "Tutor not found"
                    });
                }

                console.log(`Tutor with ID ${tutorId} deleted successfully`);
                return res.status(200).json({
                    message: "Tutor deleted successfully",
                    tutor: deletedTutor
                });
            } catch (deleteError) {
                console.error(`Error deleting tutor with ID ${tutorId}:`, deleteError);
                return res.status(500).json({
                    message: "Error deleting tutor",
                    error: deleteError.message
                });
            }
        }

        // Handle PUT request (update tutor)
        if (req.method === 'PUT') {
            const tutorId = req.query.id;

            if (!tutorId) {
                console.log('Missing tutor ID for update');
                return res.status(400).json({
                    message: "Missing tutor ID for update"
                });
            }

            console.log(`Attempting to update tutor with ID: ${tutorId}`);
            console.log('Update data:', req.body);

            const {
                name,
                subjects,
                costRange,
                badges,
                contact,
                description,
                regions,
                imagePath,
                removeImage,
                editId
            } = req.body;

            // Validate required fields
            if (!name || !subjects || !costRange) {
                console.log('Missing required fields for update:', { name, subjects, costRange });
                return res.status(400).json({
                    message: "Missing required fields: name, subjects, and costRange are required"
                });
            }

            // Build update data
            const updateData = {
                name,
                subjects: Array.isArray(subjects) ? subjects : [subjects],
                costRange,
                badges: Array.isArray(badges) ? badges : [badges],
                contact,
                description,
                regions: canonicalizeRegionArray(regions),
                updatedAt: new Date()
            };

            // Handle image updates
            if (imagePath) {
                updateData.imagePath = imagePath;
            }

            // Clear imagePath if removal is requested
            if (removeImage === 'true' || removeImage === true) {
                updateData.imagePath = '';
            }

            try {
                const updatedTutor = await Tutor.findByIdAndUpdate(tutorId, updateData, { new: true });

                if (!updatedTutor) {
                    console.log(`Tutor with ID ${tutorId} not found for update`);
                    return res.status(404).json({
                        message: "Tutor not found for update"
                    });
                }

                console.log('Tutor updated successfully:', updatedTutor._id);
                return res.status(200).json({
                    message: "Tutor updated successfully",
                    tutor: updatedTutor
                });
            } catch (updateError) {
                console.error(`Error updating tutor with ID ${tutorId}:`, updateError);
                return res.status(500).json({
                    message: "Error updating tutor",
                    error: updateError.message
                });
            }
        }

        // Handle POST request (add tutor or update fallback)
        // Log the request body for debugging
        console.log('Request body:', req.body);

        // Check for update fallback (editId in body)
        const { editId } = req.body;
        if (editId) {
            console.log('POST request with editId - processing as update fallback');

            const {
                name,
                subjects,
                costRange,
                badges,
                contact,
                description,
                regions,
                imagePath,
                removeImage
            } = req.body;

            // Validate required fields
            if (!name || !subjects || !costRange) {
                console.log('Missing required fields for update:', { name, subjects, costRange });
                return res.status(400).json({
                    message: "Missing required fields: name, subjects, and costRange are required"
                });
            }

            // Build update data
            const updateData = {
                name,
                subjects: Array.isArray(subjects) ? subjects : [subjects],
                costRange,
                badges: Array.isArray(badges) ? badges : [badges],
                contact,
                description,
                regions: canonicalizeRegionArray(regions),
                updatedAt: new Date()
            };

            // Handle image updates
            if (imagePath) {
                updateData.imagePath = imagePath;
            }

            // Clear imagePath if removal is requested
            if (removeImage === 'true' || removeImage === true) {
                updateData.imagePath = '';
            }

            try {
                const updatedTutor = await Tutor.findByIdAndUpdate(editId, updateData, { new: true });

                if (!updatedTutor) {
                    console.log(`Tutor with ID ${editId} not found for update`);
                    return res.status(404).json({
                        message: "Tutor not found for update"
                    });
                }

                console.log('Tutor updated successfully via POST fallback:', updatedTutor._id);
                return res.status(200).json({
                    message: "Tutor updated successfully",
                    tutor: updatedTutor
                });
            } catch (updateError) {
                console.error(`Error updating tutor via POST fallback:`, updateError);
                return res.status(500).json({
                    message: "Error updating tutor",
                    error: updateError.message
                });
            }
        }

        // Extract fields from request body for new tutor creation
        const {
            name,
            subjects,
            costRange,
            badges,
            contact,
            description,
            regions,
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
            regions: canonicalizeRegionArray(regions),
            imagePath
        });

        const newTutor = new Tutor({
            name,
            subjects: Array.isArray(subjects) ? subjects : [subjects],
            costRange,
            badges: Array.isArray(badges) ? badges : [badges],
            contact,
            description,
            regions: canonicalizeRegionArray(regions),
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
