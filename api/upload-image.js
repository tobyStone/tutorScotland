// api/upload-image.js
const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');
const sharp = require('sharp');

const MAX_UPLOAD = 4 * 1024 * 1024;  // 4MB
const MAX_DIMENSIONS = 2000;  // Max width/height in pixels
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    try {
        const form = formidable({
            keepExtensions: true,
            maxFileSize: MAX_UPLOAD
        });

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });

        const file = files.file || files.image;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.mimetype)) {
            return res.status(415).json({ 
                message: 'Invalid file type. Allowed types: ' + ALLOWED_TYPES.join(', ')
            });
        }

        // Validate file size
        if (file.size > MAX_UPLOAD) {
            return res.status(413).json({ 
                message: `File too large. Maximum size is ${MAX_UPLOAD / 1024 / 1024}MB`
            });
        }

        // Get image dimensions
        const metadata = await sharp(file.filepath).metadata();
        
        // Validate dimensions
        if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
            return res.status(400).json({ 
                message: `Image dimensions too large. Maximum size is ${MAX_DIMENSIONS}x${MAX_DIMENSIONS} pixels`
            });
        }

        // Generate a unique filename
        const timestamp = Date.now();
        const originalName = file.originalFilename || 'image';
        const ext = originalName.split('.').pop().toLowerCase();
        const filename = `${timestamp}-${originalName}`;
        const folder = fields.folder || 'uploads';

        // Upload original image
        const stream = fs.createReadStream(file.filepath);
        const { url } = await put(`${folder}/${filename}`, stream, {
            access: 'public',
            contentType: file.mimetype
        });

        // Generate and upload thumbnail
        const thumbnailBuffer = await sharp(file.filepath)
            .resize(240, 240, {
                fit: 'cover',
                position: 'center'
            })
            .toBuffer();

        const thumbnailUrl = await put(`${folder}/thumbnails/${filename}`, thumbnailBuffer, {
            access: 'public',
            contentType: file.mimetype
        });

        // Clean up temp file
        fs.unlink(file.filepath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        return res.status(200).json({
            url,
            thumb: thumbnailUrl,
            width: metadata.width,
            height: metadata.height,
            type: file.mimetype
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ 
            message: 'Upload failed',
            error: error.message
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
