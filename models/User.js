/**
 * @fileoverview User model for authentication and role management
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Mongoose model for user accounts with role-based access control
 */

// models/user.js
const mongoose = require('mongoose');

/**
 * User account schema definition
 * @typedef {Object} User
 * @property {string} name - User's full name
 * @property {string} email - Unique email address for login
 * @property {string} password - Hashed password using bcrypt
 * @property {string} role - User role: 'parent', 'admin', 'tutor', 'blogwriter'
 */

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    // Now includes 'tutor' in the enum
    role: { type: String, enum: ['parent', 'admin', 'tutor', 'blogwriter'], required: true }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
