// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    // Now includes 'tutor' in the enum
    role: { type: String, enum: ['parent', 'admin', 'tutor', 'blogwriter'], required: true }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
