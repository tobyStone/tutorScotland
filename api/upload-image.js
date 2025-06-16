// api/upload-image.js
const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');
const { lookup } = require('mime-types');

// ────────────────────────────────────────────────
// Sharp tweaks – turn the cache off and keep
// concurrency low in a server-less environment
// (prevents file-descriptor starvation)
const sharp = require('sharp');
sharp.cache(false);
sharp.concurrency(2);
const fsPromises = require('fs/promises');
// ────────────────────────────────────────────────

const MAX_UPLOAD = 4 * 1024 * 1024;  // 4MB
const MAX_DIMENSIONS = 2000;  // Max width/height in pixels

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

        const fileObj = (files.file || files.image);
        const uploadedFile = Array.isArray(fileObj) ? fileObj[0] : fileObj;
        if (!uploadedFile) {
            return res.status(400).json({ message: 'No file provided' });
        }

        let mime = uploadedFile.mimetype || '';
        if (mime === '' || mime.toLowerCase() === 'application/octet-stream') {
            mime = lookup(uploadedFile.originalFilename) || '';
        }

        if (!mime.startsWith('image/')) {
            return res.status(415).json({
                message: `Unsupported file type. Detected: ${mime || 'unknown'}`
            });
        }
        uploadedFile.mimetype = mime; // Normalise for later `put`

        if (uploadedFile.size > MAX_UPLOAD) {
            return res.status(413).json({
                message: `File too large. Maximum size is ${MAX_UPLOAD / 1024 / 1024}MB`
            });
        }

        // Generate a unique filename (This must happen before the upload logic)
        const timestamp = Date.now();
        const originalName = uploadedFile.originalFilename || 'image';
        const clean = originalName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-.]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const filename = `${timestamp}-${clean}`;
        const folder = (fields.folder && String(fields.folder[0])) || 'content-images';

        /* -------------------------------------------------------------
            1️⃣  Read the *fully-flushed* temp file into RAM once
                (eliminates Sharp ↔︎ FS timing issues)
        ------------------------------------------------------------- */
        const buffer = await fsPromises.readFile(uploadedFile.filepath);
        const img = sharp(buffer, { failOnError: false });

        /* -------------------------------------------------------------
            2️⃣  Metadata check. If libspng still screams, re-encode
                on the fly and try again (rare, but guards the edge)
        ------------------------------------------------------------- */
        let metadata;
        try {
            metadata = await img.metadata();
        } catch (e) {
            console.warn('Metadata read failed, attempting safe re-encode.', e.message);
            const tmp = await img.png().toBuffer(); // safe re-encode
            metadata = await sharp(tmp).metadata(); // retry
        }

        if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
            return res.status(400).json({
                message: `Image dimensions too large. Max ${MAX_DIMENSIONS}px each side`
            });
        }

        /* -------------------------------------------------------------
            3️⃣  Create thumbnail *from the same buffer*
        ------------------------------------------------------------- */
        const thumbnailBuffer = await img
            .resize(240, 240, { fit: 'cover', position: 'center' })
            .toBuffer();

        const putOpts = { access: 'public', contentType: uploadedFile.mimetype, overwrite: true };
        const mainKey = `${folder}/${filename}`;
        const thumbKey = `${folder}/thumbnails/${filename}`;

        // Upload original + thumb directly from buffers
        const { url } = await put(mainKey, buffer, putOpts);
        const { url: thumbnailUrl } = await put(thumbKey, thumbnailBuffer, putOpts);

        // Clean up temp file
        fs.unlink(uploadedFile.filepath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        return res.status(200).json({
            url,
            thumb: thumbnailUrl,
            width: metadata.width,
            height: metadata.height,
            type: uploadedFile.mimetype
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({
            message: 'Upload has unfortunately failed',
            error: error.message
        });
    }
}

// Pin runtime for Sharp compatibility
module.exports.config = { runtime: 'nodejs18.x' };