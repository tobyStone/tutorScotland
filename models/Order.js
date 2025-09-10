/**
 * @fileoverview Order model for section ordering and page layout management
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Mongoose model for managing the display order of sections on pages
 */

const mongoose = require('mongoose');

/**
 * Section order schema definition
 * @typedef {Object} Order
 * @property {string} page - Page identifier (unique, indexed)
 * @property {string[]} order - Array of section IDs in display order
 * @property {Date} updatedAt - Auto-generated update timestamp
 */

const orderSchema = new mongoose.Schema({
    page: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    order: { 
        type: [String], 
        default: [] 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Add index for better query performance
orderSchema.index({ page: 1, updatedAt: -1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
