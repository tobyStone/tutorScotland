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

    // Allow POST, GET, and DELETE requests
    if (!['POST', 'GET', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', ['POST', 'GET', 'DELETE']);
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

        // Handle GET request - List all blogs or get a specific blog
        if (req.method === 'GET') {
            console.log('Processing GET request');

            // Check if a specific blog ID is requested
            if (req.query.id) {
                const blogId = req.query.id;
                console.log(`Fetching blog with ID: ${blogId}`);

                try {
                    const blog = await Blog.findById(blogId);
                    if (!blog) {
                        return res.status(404).json({ message: 'Blog post not found' });
                    }
                    return res.status(200).json(blog);
                } catch (error) {
                    console.error(`Error fetching blog with ID ${blogId}:`, error);
                    return res.status(500).json({
                        message: 'Error fetching blog post',
                        error: error.message
                    });
                }
            }

            // Return all blogs, sorted by newest first
            console.log('Fetching all blog posts');
            const blogs = await Blog.find().sort({ createdAt: -1 });
            return res.status(200).json(blogs);
        }

        // Handle DELETE request - Delete a blog post
        if (req.method === 'DELETE') {
            console.log('Processing DELETE request');

            // Check if blog ID is provided
            if (!req.query.id) {
                return res.status(400).json({ message: 'Blog ID is required for deletion' });
            }

            const blogId = req.query.id;
            console.log(`Attempting to delete blog with ID: ${blogId}`);

            try {
                const result = await Blog.findByIdAndDelete(blogId);
                if (!result) {
                    return res.status(404).json({ message: 'Blog post not found' });
                }
                console.log(`Blog post with ID ${blogId} deleted successfully`);
                return res.status(200).json({
                    message: 'Blog post deleted successfully',
                    deletedBlog: result
                });
            } catch (error) {
                console.error(`Error deleting blog with ID ${blogId}:`, error);
                return res.status(500).json({
                    message: 'Error deleting blog post',
                    error: error.message
                });
            }
        }

        // Handle PUT request - Update existing blog
        if (req.method === 'PUT') {
            console.log('Processing PUT request for blog update');
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ message: 'Blog ID is required for update.' });
            }

            const updateData = buildUpdatePayload(req.body);

            try {
                const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, { new: true });

                if (!updatedBlog) {
                    return res.status(404).json({ message: 'Blog post not found for update.' });
                }

                console.log('Blog updated successfully:', updatedBlog._id);
                return res.status(200).json({
                    message: "Blog post updated successfully",
                    blog: updatedBlog
                });
            } catch (error) {
                console.error('Error updating blog:', error);
                return res.status(500).json({
                    message: 'Error updating blog post',
                    error: error.message
                });
            }
        }

        // For POST requests, continue with blog creation or update fallback
        console.log('Processing POST request');

        // Check for update fallback (editId in body)
        const { editId } = req.body;
        if (editId) {
            console.log('POST request with editId - processing as update fallback');
            const updateData = buildUpdatePayload(req.body);

            try {
                const updatedBlog = await Blog.findByIdAndUpdate(editId, updateData, { new: true });

                if (!updatedBlog) {
                    return res.status(404).json({ message: 'Blog post not found for update.' });
                }

                console.log('Blog updated successfully via POST fallback:', updatedBlog._id);
                return res.status(200).json({
                    message: "Blog post updated successfully",
                    blog: updatedBlog
                });
            } catch (error) {
                console.error('Error updating blog via POST fallback:', error);
                return res.status(500).json({
                    message: 'Error updating blog post',
                    error: error.message
                });
            }
        }

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

        // Process content for SEO
        const cleanContent = content
            .replace(/<[^>]*>/g, '') // Remove any HTML tags
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();

        // Create excerpt if not provided
        const processedExcerpt = excerpt || cleanContent.substring(0, 150) + (cleanContent.length > 150 ? '...' : '');

        // Create a new Blog post with enhanced SEO metadata
        const newBlog = new Blog({
            title,
            author: author || 'Tutors Alliance Scotland',
            content,
            imagePath: imagePath || '',
            excerpt: processedExcerpt,
            publishDate: publishDate ? new Date(publishDate) : new Date(),
            category: categoryArray
        });

        // Save the blog post to the database
        console.log('Saving blog post to database...');
        const savedBlog = await newBlog.save();
        console.log('Blog post saved successfully:', savedBlog);

        // Generate SEO-friendly metadata for the response
        const seoMetadata = {
            title: savedBlog.title,
            description: savedBlog.excerpt,
            author: savedBlog.author,
            publishDate: savedBlog.publishDate,
            url: `https://tutorsalliancescotland.co.uk/blog?id=${savedBlog._id}`,
            image: savedBlog.imagePath || "https://tutorsalliancescotland.co.uk/images/defaultBlog.png",
            schema: {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "mainEntityOfPage": {
                    "@type": "WebPage",
                    "@id": `https://tutorsalliancescotland.co.uk/blog?id=${savedBlog._id}`
                },
                "headline": savedBlog.title,
                "description": savedBlog.excerpt,
                "image": savedBlog.imagePath || "https://tutorsalliancescotland.co.uk/images/defaultBlog.png",
                "author": {
                    "@type": "Person",
                    "name": savedBlog.author
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "Tutors Alliance Scotland",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://tutorsalliancescotland.co.uk/images/bannerShield2.png"
                    }
                },
                "datePublished": savedBlog.publishDate.toISOString(),
                "dateModified": savedBlog.createdAt.toISOString()
            }
        };

        return res.status(201).json({
            message: "Blog post created successfully",
            blog: savedBlog,
            seo: seoMetadata
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

// Shared helper function to build update payload
function buildUpdatePayload(body) {
    const {
        title, author, category, excerpt, publishDate, content, imagePath, removeImage
    } = body;

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

    // Process content for SEO
    const cleanContent = content
        .replace(/<[^>]*>/g, '') // Remove any HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

    const updateData = {
        title,
        author: author || 'Tutors Alliance Scotland',
        content,
        excerpt: excerpt || cleanContent.substring(0, 150) + (cleanContent.length > 150 ? '...' : ''),
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        category: categoryArray,
        updatedAt: new Date()
    };

    // Only update imagePath if a new one was provided
    if (imagePath) {
        updateData.imagePath = imagePath;
    }

    // Clear imagePath if removal is requested
    if (removeImage === 'true' || removeImage === true) {
        updateData.imagePath = '';
    }

    return updateData;
}

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
