const connectToDatabase = require('./connectToDatabase');
const mongoose = require('mongoose');

// Define Tutor Schema (Ensure consistency with your database)
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,
    badges: [String],
    imagePath: String,
    postcodes: [String]
});

let Tutor;
try {
    Tutor = mongoose.model('Tutor');
} catch {
    Tutor = mongoose.model('Tutor', tutorSchema);
}

module.exports = async (req, res) => {
    await connectToDatabase();

    try {
        const tutors = await Tutor.find({}, '-description'); // Exclude 'description'
        return res.status(200).json(tutors);
    } catch (error) {
        console.error("Error fetching tutors:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
