// api/blog-writer.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');
const jwt = require('jsonwebtoken');

// Helper function to extract and verify token
function verifyToken(req) {
    try {
        // Parse cookies if they haven't been parsed yet
        if (!req.cookies) {
            const cookieHeader = req.headers.cookie;
            if (!cookieHeader) {
                console.log('No cookie header found');
                return [false, "No authentication token found"];
            }

            // Manually parse cookies
            const cookies = {};
            cookieHeader.split(';').forEach(cookie => {
                const parts = cookie.split('=');
                const name = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                cookies[name] = value;
            });
            req.cookies = cookies;
        }

        // Get the token from cookies
        const token = req.cookies.token;

        // Check if token exists
        if (!token) {
            console.log('No token found in cookies:', req.cookies);
            return [false, "No authentication token found"];
        }

        // Check if JWT_SECRET is set
        const SECRET = process.env.JWT_SECRET;
        if (!SECRET) {
            console.log('JWT_SECRET is not set');
            return [false, "Server configuration error: JWT_SECRET missing"];
        }

        // Verify the token
        const decoded = jwt.verify(token, SECRET);
        console.log('Token verified successfully:', decoded);
        return [true, decoded];
    } catch (error) {
        console.error('Token verification error:', error.message);
        return [false, `Invalid authentication token: ${error.message}`];
    }
}

module.exports = async (req, res) => {
    console.log('Blog writer API called with method:', req.method);
    console.log('Request headers:', req.headers);

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    // Verify authentication
    const [ok, payloadOrMsg] = verifyToken(req);
    if (!ok) {
        console.log('Authentication failed:', payloadOrMsg);
        return res.status(401).json({ message: payloadOrMsg });
    }

    // Check if user is a blog writer or admin
    const userRole = (payloadOrMsg.role || '').toLowerCase();
    if (userRole !== 'blogwriter' && userRole !== 'admin') {
        console.log('Access denied: User role is', userRole);
        return res.status(403).json({ message: "Access denied: Blog writers and admins only" });
    }

    try {
        console.log('Connecting to database...');
        await connectToDatabase();
        console.log('Database connected successfully');

        // Log the request body for debugging
        console.log('Request body:', req.body);

        // Extract fields from request body
        const {
            title,
            author,
            category,
            excerpt,
            publishDate,
            content,
            imagePath
        } = req.body;

        // Validate required fields
        if (!title || !content) {
            console.log('Missing required fields:', { title, content });
            return res.status(400).json({
                message: "Missing required fields: title and content are required"
            });
        }

        // Process category field
        let categoryArray = [];
        if (category === 'general') {
            categoryArray = ['parent', 'tutor'];
        } else if (category === 'parent' || category === 'tutor') {
            categoryArray = [category];
        } else {
            // Default to general if category is invalid
            categoryArray = ['parent', 'tutor'];
        }

        // Create new Blog post
        console.log('Creating new blog post with data:', {
            title,
            author,
            category: categoryArray,
            excerpt,
            publishDate: publishDate ? new Date(publishDate) : new Date(),
            content,
            imagePath: imagePath || ''
        });

        // Validate content format
        if (content.length < 10) {
            return res.status(400).json({
                message: "Content is too short. Please provide more detailed content."
            });
        }

        const newBlog = new Blog({
            title,
            author: author || 'Tutors Alliance Scotland',
            content,
            imagePath: imagePath || '',
            excerpt: excerpt || content.substring(0, 150) + '...',
            publishDate: publishDate ? new Date(publishDate) : new Date(),
            category: categoryArray
        });

        // Save the blog post to the database
        console.log('Saving blog post to database...');
        const savedBlog = await newBlog.save();
        console.log('Blog post saved successfully:', savedBlog);

        return res.status(201).json({
            message: "Blog post created successfully",
            blog: savedBlog
        });
    } catch (error) {
        console.error("Error creating blog post:", error);

        // Provide more detailed error information
        let errorMessage = "Server error";
        if (error.name === 'ValidationError') {
            errorMessage = "Validation error: " + Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.name === 'MongoServerError' && error.code === 11000) {
            errorMessage = "Duplicate key error: This blog post may already exist";
        }

        return res.status(500).json({
            message: errorMessage,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
