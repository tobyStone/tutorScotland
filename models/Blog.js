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
        maxlength: 160 // Google's recommended limit
    },
    slug: {
        type: String,
        unique: true,
        sparse: true // allows null values but ensures uniqueness when present
    },
    tags: [String], // Array of tags for categorization
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
    socialImage: String, // Custom image for social sharing
    socialTitle: String, // Custom title for social sharing
    socialDescription: String, // Custom description for social sharing
    // SEO fields
    focusKeyword: String, // Primary keyword for SEO
    readingTime: Number, // Estimated reading time in minutes
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
