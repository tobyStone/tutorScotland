// api/upload-image.js
const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    try {
        console.log('Upload-image API called');
        console.log('Content-Type:', req.headers['content-type']);

        // 1. Parse multipart/form-data with better error handling
        const form = formidable({
            multiples: false,
            keepExtensions: true,
            maxFileSize: 4.5 * 1024 * 1024, // 4.5MB limit
            maxFields: 10,
            maxFieldsSize: 2 * 1024 * 1024 // 2MB for text fields
        });

        const parseForm = () => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Form parsing timeout'));
                }, 30000); // 30 second timeout

                form.parse(req, (err, fields, files) => {
                    clearTimeout(timeout);
                    if (err) {
                        console.error('Form parsing error:', err);
                        return reject(err);
                    }
                    console.log('Form parsed successfully:', {
                        fieldCount: Object.keys(fields).length,
                        fileCount: Object.keys(files).length
                    });
                    resolve({ fields, files });
                });
            });
        };

        const { fields, files } = await parseForm();

        let file = files.file;                       // <input name="file">
        if (!file) return res.status(400).json({ message: 'No file found' });
        if (Array.isArray(file)) file = file[0];     // safety for future multiples=true

        // Formidable v2+ => file.filepath
        const tempPath = file.filepath || file.path;
        if (!tempPath) {
            return res.status(400).json({ message: 'Temp file path missing' });
        }

        // Get folder from fields
        const folder = fields.folder ?
            (Array.isArray(fields.folder) ? fields.folder[0] : fields.folder) : 'misc';

        console.log('Uploading file:', file.originalFilename, 'to folder:', folder);

        // 2. Push the stream to Vercel Blob
        const blob = await put(
            `${folder}/${Date.now()}-${file.originalFilename}`,
            fs.createReadStream(tempPath),
            {
                access: 'public',                      // anonymous GETs
                contentType: file.mimetype,
            },
        );

        console.log('Upload successful:', blob.url);
        // 3. Reply with the new public URL
        return res.status(200).json({ url: blob.url });
    } catch (e) {
        console.error('Upload error:', e);
        console.error('Error stack:', e.stack);
        return res.status(500).json({
            message: 'Upload failed',
            error: e.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Tell Vercel we need the Node runtime (so formidable works)
module.exports.config = { runtime: 'nodejs18.x' };
