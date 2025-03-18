// api/blog-writer.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');
const multer = require('multer');
const upload = multer({ dest: '/tmp' }); // or a custom folder

module.exports = async (req, res) => {
    await connectToDatabase();

    // Only allow POST
    if (req.method === 'POST') {
        // We'll wrap this in a Multer handler for the image
        upload.single('blogImage')(req, res, async (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(500).send('Error uploading file');
            }

            try {
                const { title, content } = req.body;

                // In a real app, you'd move the uploaded file somewhere permanent
                // or upload to a cloud (Cloudinary, S3, etc.) and get the final URL.
                // For now, let's store the local path:
                const imagePath = req.file ? req.file.path : '';

                const newBlog = new Blog({
                    title,
                    content,
                    imagePath
                });
                await newBlog.save();

                return res.status(200).send('Blog entry created!');
            } catch (err) {
                console.error('Error creating blog:', err);
                return res.status(500).send('Server error');
            }
        });
    } else {
        return res.status(405).send('Method Not Allowed');
    }
};
