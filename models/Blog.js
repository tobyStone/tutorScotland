// models/Blog.js
const mongoose = require('mongoose');

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
        type: [String], // Array of tags for categorization
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
