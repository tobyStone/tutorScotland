/**
 * @fileoverview API endpoint for adding new tutors to the Tutors Alliance Scotland platform
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Handles tutor registration with comprehensive validation, region normalization,
 * and admin authentication. Supports both public tutor applications and admin-managed additions.
 *
 * @security Requires admin authentication for direct tutor creation
 * @performance Implements region synonym mapping for consistent data storage
 */

// api/addTutor.js
const connectToDatabase = require('./connectToDatabase');
const jwt = require('jsonwebtoken');
const Tutor = require('../models/Tutor');
const { validateText, validateEmail } = require('../utils/input-validation');
const { applyComprehensiveSecurityHeaders } = require('../utils/security-headers');
const { csrfProtection } = require('../utils/csrf-protection');
const queryCache = require('../utils/query-cache');

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

  // Admin UI form variants that need mapping to canonical labels
  map.set(toKey('angus & dundee'), 'Dundee & Angus');
  map.set(toKey('borders'), 'Scottish Borders');
  map.set(toKey('glasgow & west central'), 'Glasgow & West');
  map.set(toKey('stirling & clackmannanshire'), 'Stirling & Falkirk');

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

/**
 * Main API handler for tutor management operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with operation result
 *
 * @description Handles POST (create), PUT (update), and DELETE operations for tutors.
 * Implements comprehensive validation, region normalization, and admin authentication.
 *
 * @example
 * // POST /api/addTutor
 * {
 *   "name": "John Smith",
 *   "subjects": ["Mathematics", "Physics"],
 *   "costRange": "£20-30",
 *   "regions": ["Edinburgh & Lothians"],
 *   "description": "Experienced tutor...",
 *   "contact": "john@example.com"
 * }
 *
 * @security Admin authentication required for all operations
 * @throws {Error} 401 - Invalid or missing authentication token
 * @throws {Error} 400 - Invalid input data or validation errors
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    // ✅ CRITICAL SECURITY FIX: Apply comprehensive security headers
    applyComprehensiveSecurityHeaders(res);

    // Allow POST, PUT, and DELETE methods
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // ✅ CRITICAL SECURITY FIX: CSRF protection for all state-changing operations
    try {
        await new Promise((resolve, reject) => {
            csrfProtection(req, res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    } catch (error) {
        console.log('CSRF validation failed:', error.message);
        return res.status(403).json({
            message: 'CSRF token validation failed',
            error: error.message
        });
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

                // ✅ CACHE INVALIDATION: Clear tutor cache after deletion
                queryCache.invalidate('tutors');

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
            // Extract tutorId from query parameter first, then fall back to request body
            let tutorId = req.query.id;

            // If no query ID, extract editId from request body as fallback
            if (!tutorId) {
                const { editId } = req.body;
                tutorId = editId;
            }

            if (!tutorId) {
                console.log('Missing tutor ID for update (checked both query.id and body.editId)');
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
                tutorType,
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
                tutorType: tutorType || '',
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

                // ✅ CACHE INVALIDATION: Clear tutor cache after update
                queryCache.invalidate('tutors');

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

                // ✅ CACHE INVALIDATION: Clear tutor cache after update
                queryCache.invalidate('tutors');

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
            tutorType,
            imagePath = ''
        } = req.body;

        // ✅ SECURITY FIX: Comprehensive input validation
        const errors = [];

        // Validate name
        const nameValidation = validateText(name, {
            required: true,
            minLength: 1,
            maxLength: 100,
            fieldName: 'name'
        });
        if (!nameValidation.valid) {
            errors.push(nameValidation.error);
        }

        // Validate subjects
        if (!subjects || (Array.isArray(subjects) && subjects.length === 0)) {
            errors.push('At least one subject is required');
        } else {
            const subjectArray = Array.isArray(subjects) ? subjects : [subjects];
            for (const subject of subjectArray) {
                const subjectValidation = validateText(subject, {
                    required: true,
                    maxLength: 50,
                    fieldName: 'subject'
                });
                if (!subjectValidation.valid) {
                    errors.push(`Invalid subject: ${subjectValidation.error}`);
                }
            }
        }

        // Validate cost range
        const costValidation = validateText(costRange, {
            required: true,
            maxLength: 50,
            fieldName: 'costRange'
        });
        if (!costValidation.valid) {
            errors.push(costValidation.error);
        }

        // Validate optional fields
        if (contact) {
            // Check if it's an email or URL
            if (contact.includes('@')) {
                const emailValidation = validateEmail(contact);
                if (!emailValidation.valid) {
                    errors.push(`Invalid contact email: ${emailValidation.error}`);
                }
            } else {
                const contactValidation = validateText(contact, {
                    maxLength: 200,
                    fieldName: 'contact'
                });
                if (!contactValidation.valid) {
                    errors.push(contactValidation.error);
                }
            }
        }

        if (description) {
            const descValidation = validateText(description, {
                maxLength: 1000,
                fieldName: 'description'
            });
            if (!descValidation.valid) {
                errors.push(descValidation.error);
            }
        }

        if (errors.length > 0) {
            console.log('Tutor validation failed:', errors);
            return res.status(400).json({
                message: "Invalid input data",
                errors
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
            tutorType: tutorType || '',
            imagePath
        });

        // Save the tutor to the database
        console.log('Saving tutor to database...');
        const savedTutor = await newTutor.save();
        console.log('Tutor saved successfully:', savedTutor);

        // ✅ CACHE INVALIDATION: Clear tutor cache after creation
        queryCache.invalidate('tutors');

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
