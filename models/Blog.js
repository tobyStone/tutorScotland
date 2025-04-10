// models/Blog.js
const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: String,
    content: String,
    imagePath: String,
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
