// api/upload-image.js
const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    // 1. Parse multipart/form-data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(400).json({ message: err.message });

        const file = files.file;                     // <input name="file">
        if (!file) return res.status(400).json({ message: 'No file found' });

        try {
            // 2. Push the stream to Vercel Blob
            const blob = await put(
                `${fields.folder || 'misc'}/${Date.now()}-${file.originalFilename}`,
                fs.createReadStream(file.filepath),
                {
                    access: 'public',                      // anonymous GETs
                    contentType: file.mimetype,
                },
            );

            // 3. Reply with the new public URL
            return res.status(200).json({ url: blob.url });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ message: 'Upload failed', error: e.message });
        }
    });
};

// Tell Vercel we need the Node runtime (so formidable works)
module.exports.config = { runtime: 'nodejs18.x' };
