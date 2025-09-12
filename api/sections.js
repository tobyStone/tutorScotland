/**
 * @fileoverview Dynamic sections management API for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Comprehensive dynamic sections management supporting:
 * - Section creation with image upload to Vercel Blob
 * - Section listing with filtering and pagination
 * - Section updates with validation and conflict resolution
 * - Section deletion with proper cleanup
 * - Team member management within sections
 * - Navigation anchor generation and uniqueness
 *
 * @security Admin authentication required for write operations
 * @performance Implements efficient blob storage and database operations
 */

const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');
const Section = require('../models/Section');
const connectDB = require('./connectToDatabase');

const MAX_UPLOAD = 4.5 * 1024 * 1024;  // 4.5 MB

// Utility function to create URL-friendly slugs
const slugify = (str) => {
    return str.toString().toLowerCase()
        .replace(/[^\w\s-]/g, '')        // remove symbols
        .trim()
        .replace(/\s+/g, '-');           // spaces → dashes
};

// Helper: Vercel Blob upload
async function uploadToBlob(file) {
    console.log('Uploading image', file.originalFilename, file.size);
    const tempPath = file.filepath || file.path;
    const stream = fs.createReadStream(tempPath);
    const key = `content-images/${Date.now()}-${file.originalFilename}`;
    const { url } = await put(key, stream, {
        access: 'public',
        contentType: file.mimetype
    });
    console.log('Uploaded:', url);
    return url;
}

// Convert formidable's callback to a promise with better error handling
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        console.log('Starting form parsing with headers:', req.headers['content-type']);

        const form = formidable({
            keepExtensions: true,
            multiples: false,
            maxFileSize: MAX_UPLOAD,
            maxFields: 20,
            maxFieldsSize: 2 * 1024 * 1024, // 2MB for text fields
            allowEmptyFiles: true, // Allow forms without files
            minFileSize: 0 // Allow empty files
        });

        // Add timeout to prevent hanging requests
        const timeout = setTimeout(() => {
            reject(new Error('Form parsing timeout'));
        }, 30000); // 30 second timeout

        form.parse(req, (err, fields, files) => {
            clearTimeout(timeout);
            if (err) {
                console.error('Form parsing error:', err);
                console.error('Error details:', {
                    message: err.message,
                    code: err.code,
                    httpCode: err.httpCode
                });
                return reject(err);
            }
            console.log('Form parsed successfully:', {
                fieldCount: Object.keys(fields).length,
                fileCount: Object.keys(files).length,
                fields: Object.keys(fields),
                files: Object.keys(files)
            });
            resolve({ fields, files });
        });

        // Add error handler for the form itself
        form.on('error', (err) => {
            console.error('Formidable error event:', err);
            clearTimeout(timeout);
            reject(err);
        });
    });
};

/**
 * Main API handler for dynamic sections management
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with operation result
 *
 * @description Handles comprehensive section management:
 * - POST: Create new sections with image upload and validation
 * - PUT: Update existing sections with conflict resolution
 * - DELETE: Remove sections with proper cleanup
 * - GET: Retrieve sections with filtering and pagination
 *
 * @example
 * // POST /api/sections with multipart form data
 * // GET /api/sections?page=index
 * // PUT /api/sections with section data
 * // DELETE /api/sections?id=sectionId
 *
 * @security Admin authentication required for write operations
 * @performance Implements efficient file upload and database operations
 * @throws {Error} 400 - Invalid input data or validation errors
 * @throws {Error} 401 - Authentication required for write operations
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    try {
        await connectDB();

        // 🔒 SECURITY FIX: Add authentication for write operations
        if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
            const { verify } = require('./protected');
            const [ok, payload] = verify(req, res);
            if (!ok) {
                console.warn('🚨 SECURITY: Unauthorized sections management attempt from IP:', req.ip || req.connection.remoteAddress);
                return res.status(401).json({
                    message: 'Authentication required for sections management',
                    error: 'UNAUTHORIZED_SECTIONS_ACCESS'
                });
            }

            // Require admin role for sections management
            if (payload.role !== 'admin') {
                console.warn(`🚨 SECURITY: User role '${payload.role}' attempted sections management. User ID: ${payload.id}`);
                return res.status(403).json({
                    message: 'Admin access required for sections management',
                    error: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            console.log(`✅ Authenticated sections management by admin ${payload.id}`);
        }

        // CREATE
        if (req.method === 'POST') {
            console.log('POST request received for sections API');
            try {
                console.log('Starting form parsing...');
                const { fields, files } = await parseForm(req);
                console.log('Form parsing completed successfully');

                // Helper to get a single value from a field that might be an array
                const getField = (name) => Array.isArray(fields[name]) ? fields[name][0] : fields[name];

                // ★★★ UPDATE LOGIC ★★★
                // If an editId is present, we perform an update.
                const editId = getField('editId');
                if (editId) {
                    console.log('Update operation detected for ID:', editId);

                    // Get the current section to check if it's rolling-banner
                    const currentDoc = await Section.findById(editId);
                    if (!currentDoc) {
                        return res.status(404).json({ message: 'Section not found for update' });
                    }

                    // 🐛 DEBUG: Log rolling banner update details
                    if (currentDoc.page === 'rolling-banner') {
                        console.log('🔄 ROLLING BANNER UPDATE DEBUG:');
                        console.log('- Current document:', {
                            _id: currentDoc._id,
                            page: currentDoc.page,
                            heading: currentDoc.heading,
                            text: currentDoc.text
                        });
                        console.log('- Incoming fields:', Object.keys(fields));
                        console.log('- Text field value:', fields.text);
                        console.log('- Heading field value:', fields.heading);
                    }

                    // 💡 Safety net: Strip irrelevant fields for rolling-banner updates
                    if (currentDoc.page === 'rolling-banner') {
                        delete fields.layout;
                        delete fields.buttonLabel;
                        delete fields.buttonUrl;
                        delete fields.imagePath;
                        delete fields.showInNav;
                        delete fields.navCategory;
                        delete fields.position;
                        delete fields.team;
                        console.log('Stripped irrelevant fields for rolling-banner update');
                    }

                    // 💡 Safety net: Strip image uploads for testimonial sections (they use default background)
                    if (currentDoc.layout === 'testimonial') {
                        delete fields.imagePath;
                        delete fields.image;
                        console.log('Stripped image fields for testimonial section update');
                    }
                    
                    const updateData = { updatedAt: new Date() };

                    // ─── 1 ▸ allow the page itself to change ─────────────────────────────
                    const newPage = getField('page');               // may be undefined
                    if (newPage && newPage !== currentDoc.page) {
                          updateData.page = newPage.toLowerCase().trim();
                        }

                    if (fields.heading) updateData.heading = getField('heading').trim();
                    if (fields.text) updateData.text = getField('text').trim();
                    if (fields.position) updateData.position = getField('position').toLowerCase();

                    // Add button update logic
                    if (fields.buttonLabel) updateData.buttonLabel = getField('buttonLabel').trim();
                    if (fields.buttonUrl) updateData.buttonUrl = getField('buttonUrl').trim();

                    // Handle explicit button removal
                    if (getField('removeButton') === 'true') {
                        updateData.buttonLabel = '';
                        updateData.buttonUrl = '';
                    }

                    // Add navigation update logic
                    if (fields.showInNav) updateData.showInNav = getField('showInNav') === 'true';
                    if (fields.navCategory) updateData.navCategory = getField('navCategory').toLowerCase();

                    // Re-calculate navAnchor if either heading OR page is changing
                        if (fields.heading || updateData.page) {
                                // finalPage   = where the row will live after the update
                                    const finalPage = updateData.page || currentDoc.page;
                                // finalHeading = updated heading (if supplied) or keep existing
                                    const finalHeading = fields.heading
                                            ? getField('heading').trim()
                                        : currentDoc.heading;
                            
                                    let newAnchor = slugify(finalHeading);
                            
                                    // Ensure uniqueness within the *destination* page
                                    const collision = await Section.exists({
                                            page: finalPage,
                                            navAnchor: newAnchor,
                                            _id: { $ne: editId }
                                    });
                        if (collision) newAnchor += '-' + Date.now().toString(36);
                                            updateData.navAnchor = newAnchor;
                    }

                    // Add layout update logic with validation
                    if (fields.layout) {
                        let newLayout = getField('layout').toLowerCase();
                        const validLayouts = ['standard', 'team', 'list', 'testimonial'];
                        if (validLayouts.includes(newLayout)) {
                            updateData.layout = newLayout;
                        } else {
                            console.warn(`Invalid layout "${newLayout}" provided in update, keeping existing layout`);
                        }
                    }
                    if (fields.team) {
                        try {
                            const parsedTeam = JSON.parse(getField('team'));
                            // Only update the team array if it's a non-empty array
                            if (Array.isArray(parsedTeam) && parsedTeam.length > 0) {
                                updateData.team = parsedTeam;
                                console.log('Team data updated with:', parsedTeam);
                            } else {
                                console.log('Skipping team update because parsed data is empty or invalid.');
                            }
                        } catch (e) {
                            console.error('Error parsing team data for update:', e);
                        }
                    }

                    // Handle image: Use new image if uploaded, otherwise keep the old one.
                    // An explicit 'removeImage' flag can clear it.
                    if (getField('imagePath') && getField('imagePath') !== 'undefined') {
                        updateData.image = getField('imagePath');
                        console.log('Updating image to:', updateData.image);
                    } else if (getField('removeImage') === 'true') {
                        updateData.image = ''; // Set image to empty string to remove it
                        console.log('Removing image from section');
                    }

                    // ✅ NEW: Preserve existing block IDs or generate new ones if missing
                    const { v4: uuidv4 } = require('uuid');
                    if (!currentDoc.headingBlockId) updateData.headingBlockId = uuidv4();
                    if (!currentDoc.contentBlockId) updateData.contentBlockId = uuidv4();
                    if (!currentDoc.imageBlockId && (updateData.image || currentDoc.image)) {
                        updateData.imageBlockId = uuidv4();
                    }
                    if (!currentDoc.buttonBlockId && ((updateData.buttonLabel || currentDoc.buttonLabel) && (updateData.buttonUrl || currentDoc.buttonUrl))) {
                        updateData.buttonBlockId = uuidv4();
                    }

                    // 🐛 DEBUG: Log update data for rolling banner
                    if (currentDoc.page === 'rolling-banner') {
                        console.log('🔄 ROLLING BANNER UPDATE DATA:', updateData);
                    }

                    if (Object.keys(updateData).length === 1) { // Only contains updatedAt
                        return res.status(400).json({ message: 'No fields to update provided' });
                    }

                    const updatedDoc = await Section.findByIdAndUpdate(editId, updateData, { new: true });
                    if (!updatedDoc) {
                        return res.status(404).json({ message: 'Section not found for update' });
                    }

                    // 🐛 DEBUG: Log successful rolling banner update
                    if (currentDoc.page === 'rolling-banner') {
                        console.log('✅ ROLLING BANNER UPDATED SUCCESSFULLY:', {
                            _id: updatedDoc._id,
                            heading: updatedDoc.heading,
                            text: updatedDoc.text
                        });
                    } else {
                        console.log('Section updated successfully:', updatedDoc);
                    }

                    return res.status(200).json(updatedDoc);
                }

                // ★★★ CREATE LOGIC ★★★
                // If no editId, we proceed with creating a new section.
                console.log('Create operation detected');

                // Check if this is a full page first
                const isFullPage = fields.isFullPage ?
                    (Array.isArray(fields.isFullPage) ? fields.isFullPage[0] : fields.isFullPage) === 'true'
                    : false;

                // Get the raw page field. It is REQUIRED for sections but not for full pages.
                const rawPage = getField('page');
                if (!rawPage && !isFullPage) {
                    return res.status(400).json({ message: 'Target Page is a required field and was not provided.' });
                }

                // Handle page field differently for sections vs full pages
                let page = '';
                if (!isFullPage) {
                    // For sections, normalize the page field
                    page = rawPage.toString().trim().toLowerCase().replace(/\s+/g, '-');

                    // Validate page for sections - updated to match actual HTML filenames
                    const validPages = [
                        'index',
                        'about-us',
                        'contact',
                        'parents',
                        'tutorconnect',  // normalized to lowercase
                        'tutordirectory', // normalized to lowercase
                        'tutormembership', // normalized to lowercase
                        'tutorszone',
                        'partnerships',
                        'rolling-banner'
                    ];
                    if (!validPages.includes(page)) {
                        return res.status(400).json({ message: `Invalid page: ${page}. Valid pages are: ${validPages.join(', ')}` });
                    }

                    // 💡 Safety net: Strip irrelevant fields for rolling-banner
                    if (page === 'rolling-banner') {
                        delete fields.layout;
                        delete fields.buttonLabel;
                        delete fields.buttonUrl;
                        delete fields.imagePath;
                        delete fields.showInNav;
                        delete fields.navCategory;
                        delete fields.position;
                        delete fields.team;
                        console.log('Stripped irrelevant fields for rolling-banner submission');
                    }
                } else {
                    // For full pages, we'll set the page field from the slug later
                    console.log('Full page detected, page field will be set from slug');
                }
                const heading = getField('heading')?.toString().trim() || '';
                const text = getField('text')?.toString().trim() || '';

                // Keep your original validation, adjusted for different layout types
                let layout = getField('layout') || 'standard';
                if (!heading || !text) {
                    if (['team', 'list', 'testimonial'].includes(layout)) {
                        // Special layouts have their own text content structure
                        if (!heading) {
                            return res.status(400).json({ message: 'Heading required' });
                        }
                    } else {
                        return res.status(400).json({ message: 'Heading and text required' });
                    }
                }

                // ✅ NEW: Validate testimonial JSON format
                if (layout === 'testimonial' && text) {
                    try {
                        const testimonialData = JSON.parse(text);
                        if (!Array.isArray(testimonialData)) {
                            return res.status(400).json({ message: 'Testimonial data must be an array' });
                        }
                        // Validate each testimonial has required fields
                        for (let i = 0; i < testimonialData.length; i++) {
                            const testimonial = testimonialData[i];
                            if (!testimonial.quote || typeof testimonial.quote !== 'string') {
                                return res.status(400).json({ message: `Testimonial ${i + 1} missing required quote field` });
                            }
                            if (!testimonial.author || typeof testimonial.author !== 'string') {
                                return res.status(400).json({ message: `Testimonial ${i + 1} missing required author field` });
                            }
                        }
                        console.log('✅ Testimonial JSON validation passed:', testimonialData.length, 'testimonials');
                    } catch (e) {
                        console.error('❌ Invalid testimonial JSON:', e.message, 'Raw text:', text);
                        return res.status(400).json({ message: 'Invalid testimonial JSON format: ' + e.message });
                    }
                }

                // Optional image (skip for testimonial sections - they use default background)
                let image = '';

                if (layout !== 'testimonial') {
                    // Check if imagePath is provided in fields (from client-side upload)
                    if (fields.imagePath && fields.imagePath !== 'undefined' && fields.imagePath !== '') {
                        image = Array.isArray(fields.imagePath) ? fields.imagePath[0] : fields.imagePath;
                        console.log('Using imagePath from fields:', image);
                    } else {
                        // Otherwise try to upload file directly
                        let file = files.image || files.file;
                        if (Array.isArray(file)) file = file[0];

                        if (file && file.size && file.size > 0) {
                            if (file.size > MAX_UPLOAD) {
                                return res.status(400).json({ message: 'Image larger than 4.5 MB' });
                            }
                            console.log('Uploading file directly:', file.originalFilename, file.size);
                            image = await uploadToBlob(file);
                        } else {
                            console.log('No valid file found for upload');
                        }
                    }
                } else {
                    console.log('Skipping image upload for testimonial section - using default background');
                }

                // Handle slug for full pages
                let slug; // ✅ Use undefined for standard sections to work with sparse index
                if (isFullPage) {
                    slug = fields.slug ?
                        (Array.isArray(fields.slug) ? fields.slug[0] : fields.slug).toString().toLowerCase().trim().replace(/\s+/g, '-')
                        : '';

                    if (!slug) {
                        return res.status(400).json({ message: 'Slug is required for full pages' });
                    }

                    // Check if slug already exists
                    const existingPage = await Section.findOne({ slug, isFullPage: true });
                    if (existingPage) {
                        return res.status(400).json({ message: 'A page with this slug already exists' });
                    }

                    // For full pages, set the page field to the slug
                    page = slug;
                }
                // For standard sections, slug remains undefined (not included in document)

                // Check if page should be published
                const isPublished = fields.isPublished ?
                    (Array.isArray(fields.isPublished) ? fields.isPublished[0] : fields.isPublished) === 'true'
                    : true;

                // Get position (top, middle, bottom)
                const position = fields.position ?
                    (Array.isArray(fields.position) ? fields.position[0] : fields.position).toString().toLowerCase()
                    : 'bottom';

                // Get button fields
                const buttonLabel = fields.buttonLabel ?
                    (Array.isArray(fields.buttonLabel) ? fields.buttonLabel[0] : fields.buttonLabel).toString().trim()
                    : '';
                const buttonUrl = fields.buttonUrl ?
                    (Array.isArray(fields.buttonUrl) ? fields.buttonUrl[0] : fields.buttonUrl).toString().trim()
                    : '';

                // Get navigation fields
                const navCategory = fields.navCategory ?
                    (Array.isArray(fields.navCategory) ? fields.navCategory[0] : fields.navCategory).toString().toLowerCase()
                    : 'about';
                const showInNav = fields.showInNav ?
                    (Array.isArray(fields.showInNav) ? fields.showInNav[0] : fields.showInNav) === 'true'
                    : false;
                let navAnchor = slugify(heading);

                // Ensure uniqueness within the same page
                const collision = await Section.exists({ page, navAnchor });
                if (collision) {
                    navAnchor += '-' + Date.now().toString(36);
                }

                // ✅ APPLICATION-LEVEL VALIDATION: Ensure layout is valid
                const validLayouts = ['standard', 'team', 'list', 'testimonial'];
                if (!validLayouts.includes(layout)) {
                    console.warn(`Invalid layout "${layout}" provided, defaulting to "standard"`);
                    layout = 'standard';
                }

                let team = [];
                if (layout === 'team' && fields.team) {
                    try {
                        const teamData = Array.isArray(fields.team) ? fields.team[0] : fields.team;
                        team = JSON.parse(teamData);
                        console.log('Parsed team data:', team);
                    } catch (e) {
                        console.error('Error parsing team data:', e);
                        team = [];
                    }
                }

                // ✅ NEW: Generate block IDs for visual editor persistence
                const { v4: uuidv4 } = require('uuid');
                const headingBlockId = uuidv4();
                const contentBlockId = uuidv4();
                const imageBlockId = image ? uuidv4() : '';
                const buttonBlockId = (buttonLabel && buttonUrl) ? uuidv4() : '';

                console.log('Creating section with data:', {
                    page, heading, text, image, isFullPage, slug, isPublished, position, navCategory, showInNav, navAnchor, layout, team,
                    headingBlockId, contentBlockId, imageBlockId, buttonBlockId
                });

                // Build document data, only including slug if it has a value
                const docData = {
                    page, heading, text, image, isFullPage, isPublished, position, buttonLabel, buttonUrl,
                    navCategory, showInNav, navAnchor, layout, team,
                    headingBlockId, contentBlockId, imageBlockId, buttonBlockId
                };

                // Only include slug field if it has a value (for full pages)
                if (slug !== undefined) {
                    docData.slug = slug;
                }

                const doc = await Section.create(docData);
                console.log('Section created:', doc);
                return res.status(201).json(doc);
            } catch (e) {
                console.error('SECTION_POST error:', e);
                console.error('Error stack:', e.stack);

                // Log the request details for debugging
                try {
                    console.error('Request method:', req.method);
                    console.error('Request headers:', JSON.stringify(req.headers, null, 2));
                    console.error('Content-Type:', req.headers['content-type']);
                } catch (logError) {
                    console.error('Error logging request details:', logError);
                }

                // Determine if this was a form parsing error or database error
                const isFormParsingError = e.message.includes('Form parsing') || e.message.includes('timeout');
                const statusCode = isFormParsingError ? 400 : 500;
                const message = isFormParsingError ?
                    'Failed to parse form data. Please try again.' :
                    'Server error while saving section';

                return res.status(statusCode).json({
                    message,
                    error: e.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // READ
        if (req.method === 'GET') {
            // Check if we're requesting sections for navigation
            if (req.query.showInNav === 'true') {
                try {
                    const sections = await Section.find({
                        showInNav: true,
                        isPublished: true
                    }).sort({ navCategory: 1, heading: 1 }).lean();

                    // ✅ BACKWARD COMPATIBILITY: Normalize layout field
                    const normalizedSections = sections.map(section => {
                        if (!section.layout || section.layout === null) {
                            section.layout = 'standard';
                        }
                        return section;
                    });

                    return res.status(200).json(normalizedSections);
                } catch (e) {
                    console.error('SECTION_GET_NAV error', e);
                    return res.status(500).json({
                        message: 'Error retrieving navigation sections',
                        error: e.message
                    });
                }
            }

            // Check if we're requesting full pages
            if (req.query.isFullPage === 'true') {
                try {
                    // If slug is provided, get a specific page
                    if (req.query.slug) {
                        const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
                        const page = await Section.findOne({
                            isFullPage: true,
                            slug: slug
                        }).lean();

                        if (!page) {
                            return res.status(404).json({ message: 'Page not found' });
                        }

                        return res.status(200).json(page);
                    }

                    // Otherwise, get all pages
                    const pages = await Section.find({
                        isFullPage: true
                    }).sort({ createdAt: -1 }).lean();

                    // ✅ BACKWARD COMPATIBILITY: Normalize layout field
                    const normalizedPages = pages.map(page => {
                        if (!page.layout || page.layout === null) {
                            page.layout = 'standard';
                        }
                        return page;
                    });

                    return res.status(200).json(normalizedPages);
                } catch (e) {
                    console.error('SECTION_GET_PAGES error', e);
                    return res.status(500).json({
                        message: 'Error retrieving pages',
                        error: e.message
                    });
                }
            }

            // Regular sections request
            const page = req.query.page ?
                (Array.isArray(req.query.page) ? req.query.page[0] : req.query.page).toString().toLowerCase()
                : 'index';

            try {
                const list = await Section.find({
                    page,
                    isFullPage: { $ne: true }, // Exclude full pages from regular sections
                    isContentOverride: { $ne: true }, // ✅ FIXED: Exclude content overrides from dynamic sections
                    layout: { $ne: 'video' } // Exclude video sections (handled by video-sections API)
                }).sort({ position: 1, createdAt: 1 }).lean();

                // ✅ BACKWARD COMPATIBILITY: Normalize layout field for existing records
                const normalizedList = list.map(section => {
                    if (!section.layout || section.layout === null) {
                        section.layout = 'standard';
                    }
                    return section;
                });

                return res.status(200).json(normalizedList);
            } catch (e) {
                console.error('SECTION_GET error', e);
                return res.status(500).json({
                    message: 'Error retrieving sections',
                    error: e.message
                });
            }
        }

        // DELETE
        if (req.method === 'DELETE') {
            // Debug the incoming request
            console.log('DELETE request received');
            console.log('URL:', req.url);
            console.log('Query:', req.query);

            // Get ID from URL path segments
            // The URL format could be /api/sections/[id] or /api/sections?id=[id]
            let id;

            // Try to extract from path
            const urlParts = req.url.split('/');
            console.log('URL parts:', urlParts);

            // Check if we have a path parameter after /api/sections/
            if (urlParts.length >= 4) {
                // Handle potential query parameters in the ID segment
                id = urlParts[3].split('?')[0];
                console.log('Extracted ID from URL path:', id);
            }

            // If no ID in path or ID is empty, try query parameter
            if (!id || id === 'sections' || id === '') {
                id = req.query.id;
                console.log('Using ID from query parameter:', id);
            }

            if (!id) {
                console.log('No ID found in request');
                return res.status(400).json({ message: 'ID parameter required' });
            }

            console.log('Final ID to be used for deletion is:', id);

            try {
                const gone = await Section.findByIdAndDelete(id);
                if (!gone) {
                    return res.status(404).json({ message: 'Section not found' });
                }
                return res.status(204).end();
            } catch (e) {
                console.error('SECTION_DELETE error', e);
                return res.status(500).json({
                    message: 'Delete failed',
                    error: e.message
                });
            }
        }

        // Fallback
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end('Method Not Allowed');
    } catch (error) {
        console.error('Sections API error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Tell Vercel we need the Node runtime (so formidable works)
module.exports.config = { runtime: 'nodejs18.x' };