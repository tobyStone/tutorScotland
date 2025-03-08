// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    // Now includes 'tutor' in the enum
    role: { type: String, enum: ['parent', 'admin', 'tutor'], required: true }
});

module.exports = mongoose.model('User', userSchema);
