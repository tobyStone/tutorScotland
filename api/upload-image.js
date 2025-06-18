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
const ALLOWED_MIME = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
];
// NEW: Add a mapping for sharp format verification
const ALLOWED_SHARP_FORMATS = ['jpeg', 'png', 'webp', 'gif'];

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

        // ─── NEW: BULLET-PROOF INTEGRITY CHECKS ───────────────────────────────
        // These checks run BEFORE we attempt to read or process the file.

        // CHECK 1: Was the file truncated by Formidable for being too large?
        if (uploadedFile.truncated) {
            console.error(`Upload truncated: File exceeded ${MAX_UPLOAD} bytes.`);
            return res.status(413).json({
                message: `File is too large. The limit is ${MAX_UPLOAD / 1024 / 1024}MB.`
            });
        }

        // CHECK 2: Does the file size on disk match the expected size?
        // This prevents race conditions where we read a file that's still being written.
        const stats = await fsPromises.stat(uploadedFile.filepath);
        if (stats.size !== uploadedFile.size) {
            console.error(`Upload size mismatch: on-disk(${stats.size}) vs expected(${uploadedFile.size}).`);
            return res.status(500).json({
                message: 'Incomplete upload due to a server issue. Please try again.'
            });
        }

        console.log(`✅ File integrity verified: ${uploadedFile.originalFilename} (${stats.size} bytes)`);
        // ──────────────────────────────────────────────────────────────────

        let mime = uploadedFile.mimetype || '';
        if (mime === '' || mime.toLowerCase() === 'application/octet-stream') {
            mime = lookup(uploadedFile.originalFilename) || '';
        }

        if (!ALLOWED_MIME.includes(mime.toLowerCase())) {
            return res.status(415).json({
                message: 'Unsupported image type. Please use JPG, PNG, WebP, or GIF.'
            });
        }
        uploadedFile.mimetype = mime; // Normalise for later put

        // This check is now redundant because of the `uploadedFile.truncated` check,
        // but we'll leave it as a failsafe.
        if (uploadedFile.size > MAX_UPLOAD) {
            return res.status(413).json({
                message: `File too large. Maximum size is ${MAX_UPLOAD / 1024 / 1024}MB`
            });
        }

        // ─── NEW: Sanitized Filename Generation ────────────────────────────
        const originalName = uploadedFile.originalFilename || 'image';
        const clean = originalName.toLowerCase()
            .replace(/\.\w+$/, '') // remove original extension
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        // Derive the extension from the trusted MIME type
        const extension = mime.split('/')[1] || 'jpg';
        const filename = `${Date.now()}-${clean}.${extension}`;
        // ──────────────────────────────────────────────────────────────────

        // Robust folder parsing - handles both 'team' and ['team'] formats
        const folderField = Array.isArray(fields.folder) ? fields.folder[0] : fields.folder;
        const folder = (folderField || 'content-images').trim();

        /* -------------------------------------------------------------
            1️⃣  Read the *fully-verified* temp file into RAM
        ------------------------------------------------------------- */
        const buffer = await fsPromises.readFile(uploadedFile.filepath);

        // CHECK 3: Verify buffer integrity - ensure buffer size matches file size
        if (buffer.length !== uploadedFile.size) {
            console.error(`Buffer size mismatch: buffer(${buffer.length}) vs file(${uploadedFile.size})`);
            // Clean up temp file before exiting
            fs.unlink(uploadedFile.filepath, (err) => {
                if (err) console.error('Error deleting incomplete temp file:', err);
            });
            return res.status(500).json({
                message: 'File read error. Please try uploading again.'
            });
        }

        const img = sharp(buffer, { failOnError: false });

        /* -------------------------------------------------------------
            2️⃣  Metadata check
        ------------------------------------------------------------- */
        let metadata;
        try {
            metadata = await img.metadata();
        } catch (e) {
            console.warn('[upload-image] Sharp metadata failed:', e.message);
            // Delete the invalid temp file before exiting
            fs.unlink(uploadedFile.filepath, (err) => {
                if (err) console.error('Error deleting corrupt temp file:', err);
            });
            return res.status(400).json({
                message: 'Unable to process image – it may be corrupt or not a valid image file.'
            });
        }

        // ─── NEW: Verify Sharp-detected format ──────────────────────────────
        if (!metadata.format || !ALLOWED_SHARP_FORMATS.includes(metadata.format)) {
             fs.unlink(uploadedFile.filepath, ()=>{}); // cleanup
             return res.status(415).json({
                message: `File appears to be a ${metadata.format || 'unknown type'}, not an allowed image.`
             });
        }

        console.log(`✅ Image validated: ${metadata.width}x${metadata.height} ${metadata.format}`);
        // ──────────────────────────────────────────────────────────────────

        if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
            return res.status(400).json({
                message: `Image dimensions too large. Max ${MAX_DIMENSIONS}px each side.`
            });
        }

        /* -------------------------------------------------------------
            3️⃣  Create thumbnail
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

        console.log(`✅ Upload complete: ${url}`);

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
        console.error('[upload-image] Unexpected error:', error);
        return res.status(500).json({
            message: 'Upload failed unexpectedly',
            error: error.message
        });
    }
}

// Pin runtime for Sharp compatibility
module.exports.config = { runtime: 'nodejs18.x' };