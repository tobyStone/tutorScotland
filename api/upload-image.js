// api/upload-image.js
const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');
const sharp = require('sharp');
const { lookup } = require('mime-types');

const MAX_UPLOAD = 4 * 1024 * 1024;  // 4MB
const MAX_DIMENSIONS = 2000;  // Max width/height in pixels


module.exports = async (req, res) => {

      /* ?? DEBUG: log the first thing that happens ??????????????????????????? */
        +  console.log('UPLOAD-DEBUG ? hit function');
      console.log('UPLOAD-DEBUG ? method:', req.method);
      console.log('UPLOAD-DEBUG ? content-type:', req.headers['content-type']);
      console.log('UPLOAD-DEBUG ? user-agent:', req.headers['user-agent']);
      /* ?????????????????????????????????????????????????????????????????????? */

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
        if (!uploadedFile) return res.status(400).json({ message:'No file' });

        let mime = uploadedFile.mimetype || '';
        if (mime === '' || mime.toLowerCase() === 'application/octet-stream') {
          // ② Guess from filename if browser supplied no clue
          mime = lookup(uploadedFile.originalFilename) || '';
        }

        if (!mime.startsWith('image/')) {
          console.log('UPLOAD-DEBUG ► reject, mime=', mime);
          return res.status(415).json({
            message: `Unsupported file type. Detected: ${mime || 'unknown'}`
          });
        }
        uploadedFile.mimetype = mime;     // ③ Normalise for later `put`

        // Validate file size
        if (uploadedFile.size > MAX_UPLOAD) {
            return res.status(413).json({ 
                message: `File too large. Maximum size is ${MAX_UPLOAD / 1024 / 1024}MB`
            });
        }

        // Get image dimensions
        const metadata = await sharp(uploadedFile.filepath).metadata();
        
        // Validate dimensions
        if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
            return res.status(400).json({ 
                message: `Image dimensions too large. The Maximum size is ${MAX_DIMENSIONS}x${MAX_DIMENSIONS} pixels`
            });
        }

        // Generate a unique filename
        const timestamp = Date.now();
        const originalName = uploadedFile.originalFilename || 'image';
        const ext = originalName.split('.').pop().toLowerCase();
        const clean = originalName.toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with hyphens
            .replace(/[^a-z0-9-.]/g, '')    // Remove special characters
            .replace(/-+/g, '-')            // Replace multiple hyphens with single
            .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
        const filename = `${timestamp}-${clean}`;
        const folder = fields.folder || 'content-images';

        // Generate and upload thumbnail
        const thumbnailBuffer = await sharp(uploadedFile.filepath)
            .resize(240, 240, {
                fit: 'cover',
                position: 'center'          // Fixed US spelling for Sharp
            })
            .toBuffer();

        const putOpts = { access: 'public', contentType: uploadedFile.mimetype, overwrite: true };

        // Upload original image
        const stream = fs.createReadStream(uploadedFile.filepath);
        const { url } = await put(`${folder}/${filename}`, stream, putOpts);

        // Generate and upload thumbnail
        const thumbnailUrl = await put(`${folder}/thumbnails/${filename}`, thumbnailBuffer, putOpts);

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
            message: 'Upload failed',
            error: error.message
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
