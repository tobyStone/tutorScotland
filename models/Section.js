const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    page: { type: String, required: true },          // 'index', 'about-us', …
    heading: String,
    text: String,
    image: String,                                  // Vercel?blob URL
    order: Number                                   // sort order
});
module.exports = mongoose.models.Section
    || mongoose.model('Section', schema);
