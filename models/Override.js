// models/Override.js
// Single source-of-truth for the “overrides” collection

const mongoose = require('mongoose');

const overrideSchema = new mongoose.Schema({
    page: { type: String, required: true },
    targetSelector: { type: String, required: true },
    contentType: { type: String, required: true },
    /* payload fields (make all optional – we just need them present) */
    text: String,
    image: String,
    originalContent: mongoose.Schema.Types.Mixed,
    /* bookkeeping */
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
},
    { collection: 'overrides' }   // ?? force the exact collection name
);

module.exports = mongoose.model('Override', overrideSchema);
