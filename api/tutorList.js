// api/tutorList.js
const connectToDatabase = require('./connectToDatabase');
const mongoose = require('mongoose');

let Tutor;
try {
    Tutor = mongoose.model('Tutor');
} catch {
    const tutorSchema = new mongoose.Schema({
        name: String,
        subjects: [String],
        costRange: String,
        badges: [String],
        imagePath: String,
        postcodes: [String]
    });
    Tutor = mongoose.model('Tutor', tutorSchema);
}

module.exports = async (req, res) => {
    await connectToDatabase();
    const tutors = await Tutor.find({}, 'name subjects -_id').lean();
    // e.g. returns an array of { name: 'Alice', subjects: ['Math', 'English'] }

    return res.status(200).json(tutors);
};
