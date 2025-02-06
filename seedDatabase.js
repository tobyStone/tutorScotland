// seedDatabase.js
const mongoose = require('mongoose');
const connectToDatabase = require('./api/connectToDatabase');


// Define a Tutor schema
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String, // 1 to 5 representing the number of pound signs
    badges: [String],
    imageUrl: String,
    postcodes: String
});

const Tutor = mongoose.model('Tutor', tutorSchema);

async function seedDatabase() {
    try {
        await connectToDatabase();
        // Clear existing data
        await Tutor.deleteMany({});

        const tutors = [
            {
                name: 'John Doe',
                subjects: ['Mathematics'],
                costRange: "££",
                badges: ['PVG Registered', 'Fully Qualified Teacher', 'Safeguarding Passed'],
                imageUrl: './public/images/mathsTutor.PNG',
                postcodes: 'John teaches online or in.'
            },
            {
                name: 'Jane Smith',
                subjects: ['English', 'Mathematics'],
                costRange: "£££",
                badges: ['PVG Registered', 'Safeguarding Passed'],
                imageUrl: './public/images/englishTutor.PNG',
                postcodes: 'Jane teaches online.'
            },
            {
                name: 'Robert Brown',
                subjects: ['Geography'],
                costRange: "£",
                badges: ['Fully Qualified Teacher'],
                imageUrl: './public/images/geographyTutor.PNG',
                postcodes: 'Robert teaches online or in.'
            }
        ];

        await Tutor.insertMany(tutors);
        console.log('Database seeded successfully.');
        await mongoose.connection.close(); // Ensure connection is closed
        console.log('Database connection closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
