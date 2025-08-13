// models/Tutor.js
const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,   // e.g., __P__, __P____P__, etc.
    badges: [String],
    imagePath: String,
    description: String,
    regions: [String], // e.g., "Highlands", "Edinburgh & Lothians", "Online"
    contact: String       // NEW: a simple field for email/website address
});

module.exports = mongoose.models.Tutor || mongoose.model('Tutor', tutorSchema);
