// api/blog-writer.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');
const multer = require('multer');

// Example: store uploaded files in /tmp or a custom folder
// In production, you'd typically store them in a permanent location or a cloud service.
const upload = multer({ dest: '/tmp' });

module.exports = async (req, res) => {
    // Connect to DB once per Vercel invocation
    await connectToDatabase();

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // This wraps the request in Multer's single-file upload handler
    upload.single('blogImage')(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(500).send('Error uploading file');
        }

        try {
            // Destructure the fields from req.body
            const {
                title,
                author,
                category,
                excerpt,
                publishDate,
                content
            } = req.body;


            // Convert category to an array if it isn't already one.
            // (This way, if the form returns a string, we store [string] in the DB.)
            const categories = Array.isArray(category) ? category : [category];

            // If publishDate is provided, parse it. If not, default to now or omit.
            let publishDateObj;
            if (publishDate) {
                publishDateObj = new Date(publishDate);
                if (isNaN(publishDateObj)) {
                    // If invalid date, handle as you wish; e.g. skip or use current date
                    publishDateObj = new Date();
                }
            } else {
                publishDateObj = new Date();
            }

            // If a file was uploaded, get its path
            let imagePath = '';
            if (req.file) {
                imagePath = req.file.path; // e.g. "/tmp/abc123"
                // In real life, you might rename/move it or upload to S3/Cloudinary, then store that final URL
            }

            // Create the new Blog doc
            const newBlog = new Blog({
                title,
                author,
                category,      // <--- store the category
                excerpt,
                content,
                publishDate: publishDateObj,
                imagePath
            });

            // Save to MongoDB
            await newBlog.save();

            return res.status(200).send('Blog entry created!');
        } catch (err) {
            console.error('Error creating blog:', err);
            return res.status(500).send('Server error');
        }
    });
};
