/**
 * @fileoverview Blog model for Tutors Alliance Scotland content management
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Mongoose model for blog posts with comprehensive SEO and metadata support
 */

// models/Blog.js
const mongoose = require('mongoose');

/**
 * Blog post schema definition
 * @typedef {Object} Blog
 * @property {string} title - Blog post title
 * @property {string} author - Author name (defaults to 'Tutors Alliance Scotland')
 * @property {string} content - HTML content of the blog post
 * @property {string} imagePath - Path to featured image
 * @property {string} excerpt - Short description/summary
 * @property {Date} publishDate - Publication date
 * @property {string[]} category - Categories: 'tutor' or 'parent'
 * @property {string} metaDescription - SEO meta description (max 160 chars)
 * @property {string} slug - URL-friendly unique identifier
 * @property {string[]} tags - Array of tags for categorization
 * @property {boolean} featured - Whether post is featured
 * @property {string} status - Publication status: 'draft', 'published', 'archived'
 * @property {string} focusKeyword - Primary SEO keyword
 * @property {number} readingTime - Estimated reading time in minutes
 * @property {Date} createdAt - Auto-generated creation timestamp
 * @property {Date} updatedAt - Auto-generated update timestamp
 */

const blogSchema = new mongoose.Schema({
    title: String,
    author: String,
    content: String,
    imagePath: String,
    excerpt: String,
    publishDate: Date,
    category: [{
        type: String,
        enum: ['tutor', 'parent']
    }],
    // SEO and metadata fields
    metaDescription: {
        type: String,
        maxlength: 160, // Google's recommended limit
        default: ''
    },
    slug: {
        type: String,
        unique: true,
        sparse: true, // allows null values but ensures uniqueness when present
        default: null
    },
    tags: {
        type: [String], // Array of tags for categorization here
        default: []
    },
    featured: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'published'
    },
    // Social media metadata
    socialImage: {
        type: String,
        default: ''
    }, // Custom image for social sharing
    socialTitle: {
        type: String,
        default: ''
    }, // Custom title for social sharing
    socialDescription: {
        type: String,
        default: ''
    }, // Custom description for social sharing
    // SEO fields
    focusKeyword: {
        type: String,
        default: ''
    }, // Primary keyword for SEO
    readingTime: {
        type: Number,
        default: 1
    }, // Estimated reading time in minutes
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
