/**
 * /api/sections   — create, list, delete dynamic page sections
 * Uses Vercel Blob for images and MongoDB (Mongoose) for meta.
 */
import { put } from '@vercel/blob';
import { formidable } from 'formidable';
import fs from 'fs';
import mongoose from 'mongoose';
import connectToDB from './connectToDatabase';

const MAX_UPLOAD = 4.5 * 1024 * 1024;          // 4.5?MB

/* ??? once?only model ???????????????????????????????????????????????? */
let Section;
try { Section = mongoose.model('Section'); }
catch {
    const schema = new mongoose.Schema({
        page: { type: String, required: true, lowercase: true },
        heading: { type: String, required: true },
        text: { type: String, required: true },
        image: String,
        createdAt: { type: Date, default: Date.now }
    });
    Section = mongoose.model('Section', schema);
}

/* ??? tiny helper: upload to Blob ???????????????????????????????????? */
async function upload(file) {
    const stream = fs.createReadStream(file.filepath || file.path);
    const key = `sections/${Date.now()}-${file.originalFilename}`;
    const { url } = await put(key, stream,
        { access: 'public', contentType: file.mimetype });
    return url;
}

/* ??? main handler ??????????????????????????????????????????????????? */
export default async (req, res) => {
    await connectToDB();

    /* ?? CREATE ??????????????????????????????????????????????????????? */
    if (req.method === 'POST') {
        const form = formidable({ multiples: false, keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) return res.status(400).json({ message: err.message });

            const page = (fields.page || 'index').toLowerCase().trim();
            const heading = (fields.heading || '').trim();
            const text = (fields.text || '').trim();
            if (!heading || !text)
                return res.status(400).json({ message: 'Heading and text required' });

            try {
                /* optional image */
                let image = '';
                let file = files.image || files.file;
                if (file && Array.isArray(file)) file = file[0];

                if (file && file.size) {
                    if (file.size > MAX_UPLOAD)
                        return res.status(400).json({ message: 'Image larger than 4.5?MB' });
                    image = await upload(file);
                }

                const doc = await Section.create({ page, heading, text, image });
                return res.status(201).json(doc);
            } catch (e) {
                console.error('SECTION POST fail:', e);
                return res.status(500)
                    .json({ message: 'Server error while saving section' });
            }
        });
        return;                                   // multipart response sent
    }

    /* ?? READ (list) ??????????????????????????????????????????????????? */
    if (req.method === 'GET') {
        const page = (req.query.page || 'index').toLowerCase();
        const list = await Section.find({ page }).sort({ createdAt: 1 }).lean();
        return res.status(200).json(list);
    }

    /* ?? DELETE ??????????????????????????????????????????????????????? */
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ message: 'id query?param required' });
        try {
            const gone = await Section.findByIdAndDelete(id);
            if (!gone) return res.status(404).json({ message: 'Not found' });
            return res.status(204).end();
        } catch (e) {
            console.error('SECTION DELETE fail:', e);
            return res.status(500).json({ message: 'Delete failed' });
        }
    }

    /* fallback */
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end('Method Not Allowed');
};

export const config = { runtime: 'nodejs18.x' };
