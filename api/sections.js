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

                const page = (fields.page || 'index').toLowerCase().trim();
                const heading = (fields.heading || '').trim();
                const text = (fields.text || '').trim();

                if (!heading || !text) {
                    return res.status(400).json({ message: 'Heading and text required' });
                }

                // Optional image
                let image = '';
                let file = files.image || files.file;
                if (Array.isArray(file)) file = file[0];

                if (file && file.size) {
                    if (file.size > MAX_UPLOAD) {
                        return res.status(400).json({ message: 'Image larger than 4.5 MB' });
                    }
                    image = await uploadToBlob(file);
                }

                const doc = await Section.create({ page, heading, text, image });
                return res.status(201).json(doc);
            } catch (e) {
                console.error('SECTION_POST error', e);
                return res.status(500).json({ message: 'Server error while saving section' });
            }
        }

        // READ
        if (req.method === 'GET') {
            const page = (req.query.page || 'index').toLowerCase();
            const list = await Section.find({ page }).sort({ createdAt: 1 }).lean();
            return res.status(200).json(list);
        }

        // DELETE
        if (req.method === 'DELETE') {
            const id = req.url.split('/').pop();
            if (!id) return res.status(400).json({ message: 'ID parameter required' });

            try {
                const gone = await Section.findByIdAndDelete(id);
                if (!gone) return res.status(404).json({ message: 'Not found' });
                return res.status(204).end();
            } catch (e) {
                console.error('SECTION_DELETE error', e);
                return res.status(500).json({ message: 'Delete failed' });
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