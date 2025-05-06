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

// Helper: Vercel Blob upload
async function uploadToBlob(file) {
    console.log('Uploading image', file.originalFilename, file.size);
    const tempPath = file.filepath || file.path;
    const stream = fs.createReadStream(tempPath);
    const key = `sections/${Date.now()}-${file.originalFilename}`;
    const { url } = await put(key, stream, {
        access: 'public',
        contentType: file.mimetype
    });
    console.log('Uploaded:', url);
    return url;
}

// Convert formidable's callback to a promise
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({ keepExtensions: true, multiples: false });
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
};

module.exports = async (req, res) => {
    try {
        await connectDB();

        // CREATE
        if (req.method === 'POST') {
            try {
                const { fields, files } = await parseForm(req);

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
                if (fields.imagePath) {
                    image = Array.isArray(fields.imagePath) ? fields.imagePath[0] : fields.imagePath;
                    console.log('Using imagePath from fields:', image);
                } else {
                    // Otherwise try to upload file directly
                    let file = files.image || files.file;
                    if (Array.isArray(file)) file = file[0];

                    if (file && file.size) {
                        if (file.size > MAX_UPLOAD) {
                            return res.status(400).json({ message: 'Image larger than 4.5 MB' });
                        }
                        image = await uploadToBlob(file);
                    }
                }

                console.log('Creating section with data:', { page, heading, text, image });
                const doc = await Section.create({ page, heading, text, image });
                console.log('Section created:', doc);
                return res.status(201).json(doc);
            } catch (e) {
                console.error('SECTION_POST error', e);
                // Log the fields received to help diagnose issues
                console.error('Fields received:', JSON.stringify(fields, null, 2));
                console.error('Files received:', JSON.stringify(Object.keys(files), null, 2));
                return res.status(500).json({
                    message: 'Server error while saving section',
                    error: e.message // Include error message for better debugging
                });
            }
        }

        // READ
        if (req.method === 'GET') {
            // Use the same robust approach for handling the page parameter
            const page = req.query.page ?
                (Array.isArray(req.query.page) ? req.query.page[0] : req.query.page).toString().toLowerCase()
                : 'index';

            try {
                const list = await Section.find({ page }).sort({ createdAt: 1 }).lean();
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
            // Get ID from URL or query parameter
            let id = req.url.split('/').pop();

            // If ID is not in URL path, try query parameter
            if (!id || id === 'sections') {
                id = req.query.id;
            }

            if (!id) {
                return res.status(400).json({ message: 'ID parameter required' });
            }

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