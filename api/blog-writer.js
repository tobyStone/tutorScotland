/**
 * @fileoverview Blog management API for Tutors Alliance Scotland content creation
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Comprehensive blog management system supporting CRUD operations,
 * SEO optimization, content migration, and admin authentication. Handles blog
 * creation, editing, deletion, and metadata management with automatic slug generation.
 *
 * @security Requires admin authentication for all write operations
 * @performance Implements automatic reading time calculation and SEO metadata generation
 */

// api/blog-writer.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');
const jwt = require('jsonwebtoken');
const { validateText, validateObjectId } = require('../utils/input-validation');
const { applyComprehensiveSecurityHeaders } = require('../utils/security-headers');
const { csrfProtection } = require('../utils/csrf-protection');
const fs = require('fs');
const path = require('path');

/**
 * Validate blog post data
 * @param {Object} blogData - Blog data to validate
 * @returns {Object} Validation result
 */
function validateBlogData(blogData) {
    const errors = [];
    const sanitized = {};

    // Validate title
    const titleValidation = validateText(blogData.title, {
        required: true,
        minLength: 1,
        maxLength: 200,
        fieldName: 'title'
    });
    if (!titleValidation.valid) {
        errors.push(titleValidation.error);
    } else {
        sanitized.title = titleValidation.sanitized;
    }

    // Validate content
    const contentValidation = validateText(blogData.content, {
        required: true,
        minLength: 1,
        maxLength: 50000,
        allowHTML: true,
        fieldName: 'content'
    });
    if (!contentValidation.valid) {
        errors.push(contentValidation.error);
    } else {
        sanitized.content = contentValidation.sanitized;
    }

    // Validate excerpt
    const excerptValidation = validateText(blogData.excerpt, {
        required: true,
        minLength: 1,
        maxLength: 500,
        fieldName: 'excerpt'
    });
    if (!excerptValidation.valid) {
        errors.push(excerptValidation.error);
    } else {
        sanitized.excerpt = excerptValidation.sanitized;
    }

    // Validate author
    const authorValidation = validateText(blogData.author, {
        required: true,
        minLength: 1,
        maxLength: 100,
        fieldName: 'author'
    });
    if (!authorValidation.valid) {
        errors.push(authorValidation.error);
    } else {
        sanitized.author = authorValidation.sanitized;
    }

    // Validate optional fields
    if (blogData.category) {
        const categoryValidation = validateText(blogData.category, {
            maxLength: 50,
            fieldName: 'category'
        });
        if (!categoryValidation.valid) {
            errors.push(categoryValidation.error);
        } else {
            sanitized.category = categoryValidation.sanitized;
        }
    }

    if (blogData.tags) {
        const tagsValidation = validateText(blogData.tags, {
            maxLength: 200,
            fieldName: 'tags'
        });
        if (!tagsValidation.valid) {
            errors.push(tagsValidation.error);
        } else {
            sanitized.tags = tagsValidation.sanitized;
        }
    }

    if (blogData.imagePath) {
        const imageValidation = validateText(blogData.imagePath, {
            maxLength: 500,
            fieldName: 'imagePath'
        });
        if (!imageValidation.valid) {
            errors.push(imageValidation.error);
        } else {
            sanitized.imagePath = imageValidation.sanitized;
        }
    }

    // Validate editId if present
    if (blogData.editId) {
        const idValidation = validateObjectId(blogData.editId);
        if (!idValidation.valid) {
            errors.push('Invalid blog ID format');
        } else {
            sanitized.editId = idValidation.sanitized;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized
    };
}

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

/**
 * Main API handler for blog management operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with operation result
 *
 * @description Handles comprehensive blog management including:
 * - GET: Retrieve blogs with filtering, pagination, and search
 * - POST: Create new blog posts with SEO optimization
 * - PUT: Update existing blog posts with validation
 * - DELETE: Remove blog posts with admin authentication
 *
 * @example
 * // GET /api/blog-writer?operation=list&page=1&limit=10
 * // POST /api/blog-writer with blog data
 * // PUT /api/blog-writer with id and updated data
 * // DELETE /api/blog-writer?id=blogId
 *
 * @security Admin authentication required for write operations
 * @performance Implements pagination and efficient database queries
 * @throws {Error} 401 - Invalid or missing authentication token
 * @throws {Error} 400 - Invalid input data or validation errors
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    // ✅ CRITICAL SECURITY FIX: Apply comprehensive security headers
    applyComprehensiveSecurityHeaders(res);

    console.log('Blog writer API called with method:', req.method);
    console.log('Request headers:', req.headers);

    // 🔒 SECURITY: Handle GET requests for HTML serving with authentication
    if (req.method === 'GET') {
        // Check if this is a request for HTML (browser page load) vs JSON (AJAX)
        const acceptHeader = req.headers.accept || '';
        const secFetchDest = req.headers['sec-fetch-dest'] || '';

        // Serve HTML only for browser page loads, not AJAX requests
        if (acceptHeader.includes('text/html') || secFetchDest === 'document') {
            try {
                // Extract JWT from cookies
                const token = req.cookies?.token;

                if (!token) {
                    console.log('No token found, redirecting to login');
                    res.writeHead(302, { 'Location': '/login.html?role=blogwriter' });
                    return res.end();
                }

                // Verify JWT and check role
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.role !== 'blogwriter') {
                    console.log('Invalid role for blog writer access:', decoded.role);
                    res.writeHead(302, { 'Location': '/login.html?role=blogwriter' });
                    return res.end();
                }

                // Serve the authenticated blog writer dashboard
                const templatePath = path.join(process.cwd(), 'templates', 'blog-writer-dashboard.html');
                const html = fs.readFileSync(templatePath, 'utf8');

                res.setHeader('Content-Type', 'text/html');
                return res.status(200).send(html);

            } catch (error) {
                console.error('Authentication error:', error);
                res.writeHead(302, { 'Location': '/login.html?role=blogwriter' });
                return res.end();
            }
        }

        // For AJAX requests (JSON), fall through to the authentication and JSON logic below
    }

    // ✅ CRITICAL SECURITY FIX: CSRF protection for state-changing operations
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        try {
            await new Promise((resolve, reject) => {
                csrfProtection(req, res, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.log('CSRF validation failed:', error.message);
            return res.status(403).json({
                message: 'CSRF token validation failed',
                error: error.message
            });
        }
    }

    // ✅ SECURITY FIX: Request size validation for write operations
    if (['POST', 'PUT'].includes(req.method)) {
        const requestSize = req.headers['content-length'];
        const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB should be enough for blog content

        if (requestSize && parseInt(requestSize) > MAX_REQUEST_SIZE) {
            console.error(`Request too large: ${requestSize} bytes (max: ${MAX_REQUEST_SIZE})`);
            return res.status(413).json({ message: 'Request too large' });
        }
    }

    // Allow POST, GET, PUT, and DELETE requests
    if (!['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', ['POST', 'GET', 'PUT', 'DELETE']);
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

            // Check if migration is requested
            if (req.query.migrate === 'true') {
                console.log('Running migration to add default values to existing blogs');
                try {
                    const blogsToUpdate = await Blog.find({
                        $or: [
                            { metaDescription: { $exists: false } },
                            { slug: { $exists: false } },
                            { tags: { $exists: false } },
                            { featured: { $exists: false } },
                            { status: { $exists: false } },
                            { focusKeyword: { $exists: false } },
                            { readingTime: { $exists: false } }
                        ]
                    });

                    console.log(`Found ${blogsToUpdate.length} blogs to migrate`);

                    for (const blog of blogsToUpdate) {
                        const updateData = {};

                        // Add missing fields with defaults
                        if (!blog.metaDescription) {
                            const fallback = blog.excerpt || blog.content.replace(/<[^>]*>/g, '').substring(0, 160);
                            updateData.metaDescription = fallback.length > 160 ? fallback.substring(0, 160) + '...' : fallback;
                        }

                        if (!blog.slug) {
                            const generatedSlug = blog.title
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, '')
                                .replace(/\s+/g, '-')
                                .replace(/-+/g, '-')
                                .replace(/^-|-$/g, '');

                            // Ensure uniqueness
                            let uniqueSlug = generatedSlug;
                            let counter = 1;
                            while (await Blog.findOne({ slug: uniqueSlug, _id: { $ne: blog._id } })) {
                                uniqueSlug = `${generatedSlug}-${counter}`;
                                counter++;
                            }
                            updateData.slug = uniqueSlug;
                        }

                        if (!blog.tags) updateData.tags = [];
                        if (blog.featured === undefined) updateData.featured = false;
                        if (!blog.status) updateData.status = 'published';
                        if (!blog.focusKeyword) updateData.focusKeyword = '';
                        if (!blog.readingTime) {
                            const cleanContent = blog.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                            const wordCount = cleanContent.split(/\s+/).length;
                            updateData.readingTime = Math.ceil(wordCount / 200);
                        }

                        if (Object.keys(updateData).length > 0) {
                            await Blog.findByIdAndUpdate(blog._id, updateData);
                            console.log(`Updated blog: ${blog.title}`);
                        }
                    }

                    return res.status(200).json({
                        message: `Migration completed. Updated ${blogsToUpdate.length} blogs.`,
                        updated: blogsToUpdate.length
                    });
                } catch (error) {
                    console.error('Migration error:', error);
                    return res.status(500).json({
                        message: 'Migration failed',
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

        // ✅ SECURITY FIX: Comprehensive input validation
        const validationResult = validateBlogData(req.body);
        if (!validationResult.valid) {
            console.log('Blog validation failed:', validationResult.errors);
            return res.status(400).json({
                message: "Invalid input data",
                errors: validationResult.errors
            });
        }

        // Use sanitized data
        const {
            title,
            author,
            content,
            excerpt,
            category: rawCategory,
            tags,
            imagePath
        } = validationResult.sanitized;

        // Extract additional fields that don't need validation
        const {
            slug,
            status,
            metaDescription,
            focusKeyword,
            featured,
            publishDate
        } = req.body;

        // Process category field
        let categoryArray = [];
        if (rawCategory === 'general') {
            categoryArray = ['parent', 'tutor'];
        } else if (rawCategory === 'parent' || rawCategory === 'tutor') {
            categoryArray = [rawCategory];
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

        // Generate slug if not provided
        let processedSlug = slug;
        if (!processedSlug) {
            processedSlug = title
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }

        // Ensure slug uniqueness
        let uniqueSlug = processedSlug;
        let counter = 1;
        while (await Blog.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${processedSlug}-${counter}`;
            counter++;
        }

        // Calculate reading time (average 200 words per minute)
        const wordCount = cleanContent.split(/\s+/).length;
        const readingTime = Math.ceil(wordCount / 200);

        // Create a new Blog post with enhanced SEO metadata
        const newBlog = new Blog({
            title,
            author: author || 'Tutors Alliance Scotland',
            slug: uniqueSlug,
            content,
            imagePath: imagePath || '',
            excerpt: excerpt || cleanContent.substring(0, 150) + (cleanContent.length > 150 ? '...' : ''),
            metaDescription: metaDescription || excerpt || cleanContent.substring(0, 160) + (cleanContent.length > 160 ? '...' : ''),
            focusKeyword: focusKeyword || '',
            tags: Array.isArray(tags) ? tags : [],
            featured: featured || false,
            status: status || 'published',
            readingTime: readingTime,
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
        title, author, slug, category, status, excerpt, metaDescription, focusKeyword,
        tags, featured, publishDate, content, imagePath, removeImage
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

    // Calculate reading time (average 200 words per minute)
    const wordCount = cleanContent.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    const updateData = {
        title,
        author: author || 'Tutors Alliance Scotland',
        content,
        excerpt: excerpt || cleanContent.substring(0, 150) + (cleanContent.length > 150 ? '...' : ''),
        metaDescription: metaDescription || excerpt || cleanContent.substring(0, 160) + (cleanContent.length > 160 ? '...' : ''),
        focusKeyword: focusKeyword || '',
        tags: Array.isArray(tags) ? tags : [],
        featured: featured || false,
        status: status || 'published',
        readingTime: readingTime,
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        category: categoryArray,
        updatedAt: new Date()
    };

    // Handle slug updates (only if provided and different)
    if (slug) {
        updateData.slug = slug;
    }

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
