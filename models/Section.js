const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    page: { type: String, required: true },          // 'index', 'about-us', �
    heading: String,
    text: String,
    image: String,                                  // Vercel?blob URL
    order: Number,                                  // sort order
    isFullPage: { type: Boolean, default: false },  // Whether this is a full page template
    slug: String,                                   // URL-friendly identifier for the page
    isPublished: { type: Boolean, default: true }   // Whether the page is live
}, {
    timestamps: true                                // Adds createdAt and updatedAt
});
module.exports = mongoose.models.Section
    || mongoose.model('Section', schema);
