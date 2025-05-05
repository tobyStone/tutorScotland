/**
 * /api/sections  – create / list / delete dynamic sections
 * Images go to Vercel Blob, meta to MongoDB.
 */
const { put } = require('@vercel/blob');
const formidable = require('formidable');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('./connectToDatabase');

const MAX_UPLOAD = 4.5 * 1024 * 1024;    // 4?½?MB

/* ?? once?only model ??????????????????????????????????????????????? */
let Section;
try { Section = mongoose.model('Section'); }
catch {
    Section = mongoose.model('Section', new mongoose.Schema({
        page: { type: String, required: true, lowercase: true },
        heading: { type: String, required: true },
        text: { type: String, required: true },
        image: String,
        createdAt: { type: Date, default: Date.now }
    }));
}

/* ?? helper: Vercel Blob upload ??????????????????????????????????? */
async function uploadToBlob(file) {
    console.log('??  uploading image', file.originalFilename, file.size);
    const stream = fs.createReadStream(file.filepath || file.path);
    const key = `sections/${Date.now()}-${file.originalFilename}`;
    const { url } = await put(key, stream,
        { access: 'public', contentType: file.mimetype });
    console.log('? uploaded ?', url);
    return url;
}

/* ?? helper: create formidable instance that works on v2 / v3 ????? */
function makeForm(opts = {}) {
    if (typeof formidable === 'function') return formidable(opts);   // v2.x
    const { IncomingForm } = formidable;                             // v3+
    return new IncomingForm(opts);
}

/* ?? main handler ????????????????????????????????????????????????? */
module.exports = async (req, res) => {
    await connectDB();

    /* ---------- CREATE ---------- */
    if (req.method === 'POST') {
        const form = makeForm({ keepExtensions: true, multiples: false });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('? parse error', err);
                return res.status(400).json({ message: err.message });
            }

            const page = (fields.page || 'index').toLowerCase().trim();
            const heading = (fields.heading || '').trim();
            const text = (fields.text || '').trim();
            if (!heading || !text)
                return res.status(400).json({ message: 'Heading and text required' });

            try {
                /* optional image */
                let image = '';
                let file = files.image || files.file;
                if (Array.isArray(file)) file = file[0];

                if (file && file.size) {
                    if (file.size > MAX_UPLOAD)
                        return res.status(400).json({ message: 'Image larger than 4.5?MB' });
                    image = await uploadToBlob(file);
                }

                const doc = await Section.create({ page, heading, text, image });
                return res.status(201).json(doc);
            } catch (e) {
                console.error('? SECTION?POST error', e);
                return res.status(500).json({ message: 'Server error while saving section' });
            }
        });
        return;                                           // multipart callback ends
    }

    /* ---------- READ ---------- */
    if (req.method === 'GET') {
        const page = (req.query.page || 'index').toLowerCase();
        const list = await Section.find({ page }).sort({ createdAt: 1 }).lean();
        return res.status(200).json(list);
    }

    /* ---------- DELETE ---------- */
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ message: 'id query?param required' });

        try {
            const gone = await Section.findByIdAndDelete(id);
            if (!gone) return res.status(404).json({ message: 'Not found' });
            return res.status(204).end();
        } catch (e) {
            console.error('? SECTION?DELETE error', e);
            return res.status(500).json({ message: 'Delete failed' });
        }
    }

    /* ---------- fallback ---------- */
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end('Method Not Allowed');
};

module.exports.config = { runtime: 'nodejs' };
