const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    page: {
        type: String,
        required: function() {
            return !this.isContentOverride;
        }
    },          // 'index', 'about-us', etc. - only required for non-override sections
    heading: String,
    text: String,
    image: String,                                  // Vercel?blob URL
    order: Number,                                  // sort order
    position: { type: String, default: 'bottom' },  // 'top', 'middle', 'bottom'

    // ★ NEW: Add fields for the optional button
    buttonLabel: { type: String, default: '' },     // Button text
    buttonUrl:   { type: String, default: '' },     // Button destination URL

    // ★ NEW: Add fields for navigation integration
    navCategory: { type: String, default: 'about' }, // 'tutors', 'parents', 'about'
    showInNav: { type: Boolean, default: false },    // Whether to show in navigation
    navAnchor: { type: String, default: '' },        // URL-friendly anchor for linking

    isFullPage: { type: Boolean, default: false },  // Whether this is a full page template
    slug: String,                                   // URL-friendly identifier for the page
    isPublished: { type: Boolean, default: true },   // Whether the page is live

    // Content Override Fields
    isContentOverride: { type: Boolean, default: false }, // Whether this is a content override
    targetPage: String,                             // Page this override applies to
    targetSelector: String,                         // CSS selector for the element to override
    contentType: {
        type: String,
        enum: ['text', 'html', 'image', 'link'],
        default: 'text'
    },                                             // Type of content being overridden
    overrideType: {
        type: String,
        enum: ['replace', 'append', 'prepend'],
        default: 'replace'
    },                                             // How to apply the override
    originalContent: mongoose.Schema.Types.Mixed,   // Backup of original content
    isActive: { type: Boolean, default: true }     // Whether the override is currently active
}, {
    timestamps: true                                // Adds createdAt and updatedAt
});
module.exports = mongoose.models.Section
    || mongoose.model('Section', schema);
