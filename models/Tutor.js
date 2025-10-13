/**
 * @fileoverview Tutor model for Tutors Alliance Scotland directory
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Mongoose model for tutor profiles in the directory system
 */

// models/Tutor.js
const mongoose = require('mongoose');

/**
 * Tutor profile schema definition
 * @typedef {Object} Tutor
 * @property {string} name - Tutor's full name
 * @property {string[]} subjects - Array of subjects taught
 * @property {string} costRange - Cost range using __P__ notation (e.g., "__P__", "__P____P__")
 * @property {string[]} badges - Array of qualification badges
 * @property {string} imagePath - Path to tutor's profile image
 * @property {string} description - Detailed description of tutor's experience
 * @property {string[]} regions - Array of regions served (e.g., "Edinburgh & Lothians", "Online")
 * @property {string} contact - Contact information (email/website)
 * @property {string} tutorType - Type of tutor: "Inspiring Tutor (student teacher)", "Newly Qualified Tutor (teacher up to 3 yrs)", "Accredited Tutor (teacher over 3 years)", "Tutoring Business", "Tutoring Agency", or custom
 */

const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,   // e.g., __P__, __P____P__, etc.
    badges: [String],
    imagePath: String,
    description: String,
    regions: [String], // e.g., "Highlands", "Edinburgh & Lothians", "Online"
    contact: String,      // NEW: a simple field for email/website address
    tutorType: String     // NEW: Type of tutor (Inspiring Tutor, Newly Qualified, Accredited, Business, Agency, or custom)
});

module.exports = mongoose.models.Tutor || mongoose.model('Tutor', tutorSchema);
