/**
 * CRUD for dynamic “page sections”
 *
 *  • POST   multipart/form?data  ? create   (heading / text / image / page / slot / order)
 *  • GET    /api/sections?page=index        ? list for a page, sorted by order
 *  • DELETE /api/sections?id=<mongoId>      ? delete one
 *
 * One route only – keeps you inside Vercel’s free tier.
 */
const { put } = require('@vercel/blob');
const formidable = require('formidable');
const fs = require('fs');
const mongoose = require('mongoose');
const connectToDatabase = require('./connectToDatabase');

/* ??? one?time schema registration ??????????????????????????????????? */
let Section;
try { Section = mongoose.model('Section'); }
catch {
    const schema = new mongoose.Schema({
        page: { type: String, required: true, lowercase: true },   // index, about?us …
        slot: { type: String, default: 'hero' },                   // hero, footer …
        order: { type: Number, default: 0 },                        // for manual sort
        heading: String,
        text: String,
        image: String,
        createdAt: { type: Date, default: Date.now }
    });
    Section = mongoose.model('Section', schema);
}

/* ??? helper: upload to Vercel Blob ?????????????????????????????????? */
async function uploadToBlob(file, folder = 'sections') {
    const temp = file.filepath || file.path;
    const blob = await put(
        `${folder}/${Date.now()}-${file.originalFilename}`,
        fs.createReadStream(temp),
        { access: 'public', contentType: file.mimetype }
    );
    return blob.url;
}

/* ??? main handler ??????????????????????????????????????????????????? */
module.exports = async (req, res) => {
    await connectToDatabase();

    /* ??????????????? CREATE ??????????????? */
    if (req.method === 'POST') {
        const form = formidable({ multiples: false, keepExtensions: true });
        form.parse(req, async (err, fields, files) => {
            if (err) return res.status(400).json({ message: err.message });

            const page = (fields.page || 'index').toLowerCase();
            const slot = fields.slot || 'hero';
            const order = Number(fields.order ?? 0);
            const heading = (fields.heading || '').trim();
            const text = (fields.text || '').trim();

            if (!heading || !text)
                return res.status(400).json({ message: 'heading and text are required' });

            /* optional image */
            let image = '';
            let file = files.image || files.file;
            if (file) {
                if (Array.isArray(file)) file = file[0];
                if (file.size > 2 * 1024 * 1024)         // 2?MB guard
                    return res.status(400).json({ message: 'Image >?2?MB' });
                try { image = await uploadToBlob(file, 'sections'); }
                catch (e) { console.error(e); return res.status(500).json({ message: 'Upload failed' }); }
            }

            const doc = await Section.create({ page, slot, order, heading, text, image });
            return res.status(201).json(doc);
        });
        return;               // ? multipart callback will reply
    }

    /* ??????????????? READ ??????????????? */
    if (req.method === 'GET') {
        const page = (req.query.page || 'index').toLowerCase();
        const list = await Section.find({ page }).sort({ order: 1, createdAt: 1 }).lean();
        return res.status(200).json(list);
    }

    /* ??????????????? DELETE ??????????????? */
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ message: 'id required' });

        const gone = await Section.findByIdAndDelete(id);
        if (!gone) return res.status(404).json({ message: 'not found' });
        return res.status(204).end();
    }

    /* ??????????????? fallback ??????????????? */
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end('Method Not Allowed');
};

/* tell Vercel we need node18 for formidable */
module.exports.config = { runtime: 'nodejs18.x' };
