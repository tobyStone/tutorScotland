// api/blog-writer.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');

module.exports = async (req, res) => {
    try {
        // Connect to DB once per Vercel invocation
        await connectToDatabase();

        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        try {
            // Destructure the fields from req.body
            const {
                title,
                author,
                category,
                excerpt,
                publishDate,
                content,
                imagePath = ''
            } = req.body;

            let categoryArray = [];
            if (category === 'general') {
                categoryArray = ['parent', 'tutor'];
            } else {
                categoryArray = [category];
            }

            let publishDateObj = publishDate ? new Date(publishDate) : new Date();
            if (isNaN(publishDateObj)) {
                publishDateObj = new Date();
            }

            // Create the new Blog doc
            const newBlog = new Blog({
                title,
                author,
                category: categoryArray,
                excerpt,
                content,
                imagePath,
                publishDate: publishDateObj,
                imagePath
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
    } catch (err) {
        console.error('Database connection error:', err);
        return res.status(500).json({
            message: 'Database connection error',
            error: err.message
        });
    }
};