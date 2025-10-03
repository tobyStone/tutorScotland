/**
 * @fileoverview Section model for dynamic content and visual editor overrides
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Comprehensive model supporting:
 * - Dynamic sections for content management
 * - Visual editor content overrides
 * - Team member management
 * - Navigation and SEO features
 * - Multiple layout types (standard, team, list, testimonials, video)
 */

const mongoose = require('mongoose');

// Define team member sub-schema
const teamMemberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: ''
    },
    quote: {
        type: String,
        default: ''
    },
    image: String
}, { _id: false });

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
    position: {
        type: String,
        default: function() {
            // Only set default for dynamic sections, not content overrides
            return this.isContentOverride ? undefined : 'bottom';
        }
    },  // 'top', 'middle', 'bottom' - only for dynamic sections

    // ★ NEW: Add fields for the optional button
    buttonLabel: { type: String, default: '' },     // Button text
    buttonUrl:   { type: String, default: '' },     // Button destination URL

    // ✅ NEW: Add fields for visual editor block IDs
    headingBlockId: { type: String, default: '' },   // UUID for heading element
    contentBlockId: { type: String, default: '' },   // UUID for content/text element
    imageBlockId: { type: String, default: '' },     // UUID for image element
    buttonBlockId: { type: String, default: '' },    // UUID for button element

    // ★ NEW: Add fields for navigation integration
    navCategory: { type: String, default: 'about' }, // 'tutors', 'parents', 'about'
    showInNav: { type: Boolean, default: false },    // Whether to show in navigation
    navAnchor: { type: String, default: '' },        // URL-friendly anchor for linking

    // ★ NEW: Add fields for layout types
    layout: {
        type: String,
        default: 'standard'
        // Note: No validation here to ensure backward compatibility
        // Validation happens at the application layer in the API
    },   // 'standard' | 'team' | 'list' | 'testimonial' | 'video'

    // ★ NEW: Add field for video URL (Google Cloud Storage)
    videoUrl: {
        type: String,
        required: false,
        validate: {
            validator: function(v) {
                // Only validate if videoUrl is provided and layout is video
                if (!v || this.layout !== 'video') return true;

                // Check if it's a static video URL
                const staticPattern = /^\/videos\/[^\/]+\.(mp4|webm|ogg)$/i;
                if (staticPattern.test(v)) return true;

                // Check if it's a Vercel Blob URL
                const blobPattern = /^https:\/\/[^\/]+\.public\.blob\.vercel-storage\.com\/.*\.(mp4|webm|ogg)$/i;
                if (blobPattern.test(v)) return true;

                // Check if it's a Google Cloud Storage URL (for backward compatibility)
                const googleCloudPattern = /^https:\/\/storage\.googleapis\.com\/[^\/]+\/.*\.(mp4|webm|ogg)$/i;
                if (googleCloudPattern.test(v)) return true;

                return false;
            },
            message: 'Video URL must be a static video (/videos/...), Vercel Blob URL, or Google Cloud Storage video URL (mp4, webm, or ogg)'
        }
    },
    team: {
        type: [teamMemberSchema],
        default: [],
        validate: {
            validator: arr => arr.every(m => m.name && m.bio),
            message: 'Each team member must include name & bio'
        }
    },

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
    isButton: { type: Boolean, default: false },   // Whether link should be styled as button
    isHTML: { type: Boolean, default: false },     // Whether text content contains HTML formatting
    originalContent: mongoose.Schema.Types.Mixed,   // Backup of original content
    isActive: { type: Boolean, default: true }     // Whether the override is currently active
}, {
    timestamps: true                                // Adds createdAt and updatedAt
});

// Add unique index for content overrides
schema.index(
  { targetPage: 1, targetSelector: 1, isContentOverride: 1 },
  { unique: true, partialFilterExpression: { isContentOverride: true } }
);

module.exports = mongoose.models.Section
    || mongoose.model('Section', schema);
