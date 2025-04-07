// api/blog-writer.js
const connectToDatabase = require('./db');
const uploadImage = require('./uploadImage');
const Blog = require('../models/Blog');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

module.exports = async (req, res) => {
    try {
        // Connect to DB once per Vercel invocation
        await connectToDatabase();

        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        // This wraps the request in Multer's single-file upload handler
        upload.single('blogImage')(req, res, async (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ 
                    message: err.message || 'Error uploading file',
                    error: err
                });
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

                let categoryArray = [];
                if (category === 'general') {
                    categoryArray = ['primary', 'secondary'];
                } else {
                    categoryArray = [category];
                }

                let publishDateObj = publishDate ? new Date(publishDate) : new Date();
                if (isNaN(publishDateObj)) {
                    publishDateObj = new Date();
                }

                // Upload image to Vercel Blob if present
                let imageUrl = '';
                if (req.file) {
                    try {
                        imageUrl = await uploadImage(req.file, 'blog-images');
                    } catch (uploadError) {
                        console.error('Image upload error:', uploadError);
                        return res.status(500).json({ 
                            message: "Error uploading image to Blob storage",
                            error: uploadError.message
                        });
                    }
                }

                // Create the new Blog doc
                const newBlog = new Blog({
                    title,
                    author,
                    category: categoryArray,
                    excerpt,
                    content,
                    publishDate: publishDateObj,
                    imageUrl
                });

                // Save to MongoDB
                await newBlog.save();

                return res.status(200).json({
                    message: 'Blog entry created!',
                    blog: newBlog
                });
            } catch (err) {
                console.error('Error creating blog:', err);
                return res.status(500).json({ 
                    message: 'Server error',
                    error: err.message
                });
            }
        });
    } catch (err) {
        console.error('Database connection error:', err);
        return res.status(500).json({ 
            message: 'Database connection error',
            error: err.message
        });
    }
};
