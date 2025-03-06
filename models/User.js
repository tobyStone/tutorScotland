// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['parent', 'tutor', 'admin'], required: true }
});

module.exports = mongoose.model('User', userSchema);
