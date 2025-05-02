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
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
