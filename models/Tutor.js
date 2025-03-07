// models/Tutor.js
const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,   // e.g., __P__, __P____P__, etc.
    badges: [String],
    imagePath: String,
    description: String,
    postcodes: [String], // e.g., "Online" or Highland postcodes
    contact: String       // NEW: a simple field for email/website address
});

module.exports = mongoose.model('Tutor', tutorSchema);
