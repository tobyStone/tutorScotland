/**
 * /api/sections - create / list / delete dynamic sections
 * Images go to Vercel Blob, meta to MongoDB.
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

module.exports = async (req, res) => {
    try {
        await connectDB();

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
                    const updateData = { updatedAt: new Date() };

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

                    // If heading changes, update navAnchor
                    if (fields.heading) updateData.navAnchor = slugify(getField('heading').trim());

                    // Handle image: Use new image if uploaded, otherwise keep the old one.
                    // An explicit 'removeImage' flag can clear it.
                    if (getField('imagePath') && getField('imagePath') !== 'undefined') {
                        updateData.image = getField('imagePath');
                        console.log('Updating image to:', updateData.image);
                    } else if (getField('removeImage') === 'true') {
                        updateData.image = ''; // Set image to empty string to remove it
                        console.log('Removing image from section');
                    }

                    if (Object.keys(updateData).length === 1) { // Only contains updatedAt
                        return res.status(400).json({ message: 'No fields to update provided' });
                    }

                    const updatedDoc = await Section.findByIdAndUpdate(editId, updateData, { new: true });
                    if (!updatedDoc) {
                        return res.status(404).json({ message: 'Section not found for update' });
                    }
                    console.log('Section updated successfully:', updatedDoc);
                    return res.status(200).json(updatedDoc);
                }

                // ★★★ CREATE LOGIC ★★★
                // If no editId, we proceed with creating a new section.
                console.log('Create operation detected');

                // Handle different possible formats of fields
                const page = fields.page ?
                    (Array.isArray(fields.page) ? fields.page[0] : fields.page).toString().toLowerCase().trim()
                    : 'index';
                const heading = fields.heading ?
                    (Array.isArray(fields.heading) ? fields.heading[0] : fields.heading).toString().trim()
                    : '';
                const text = fields.text ?
                    (Array.isArray(fields.text) ? fields.text[0] : fields.text).toString().trim()
                    : '';

                if (!heading || !text) {
                    return res.status(400).json({ message: 'Heading and text required' });
                }

                // Optional image
                let image = '';

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

                // Check if this is a full page
                const isFullPage = fields.isFullPage ?
                    (Array.isArray(fields.isFullPage) ? fields.isFullPage[0] : fields.isFullPage) === 'true'
                    : false;

                // If it's a full page, we need a slug
                let slug = '';
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
                }

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
                const navAnchor = slugify(heading);

                console.log('Creating section with data:', {
                    page, heading, text, image, isFullPage, slug, isPublished, position, navCategory, showInNav, navAnchor
                });

                const doc = await Section.create({
                    page, heading, text, image, isFullPage, slug, isPublished, position, buttonLabel, buttonUrl,
                    navCategory, showInNav, navAnchor
                });
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

                    return res.status(200).json(sections);
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

                    return res.status(200).json(pages);
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
                    isFullPage: { $ne: true } // Exclude full pages from regular sections
                }).sort({ position: 1, createdAt: 1 }).lean();
                return res.status(200).json(list);
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