// seedDatabase.js
const mongoose = require('mongoose');
const connectToDatabase = require('./api/connectToDatabase');

// Define a Tutor schema
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String, // Placeholder will be used here (e.g., __P__, __P____P__, etc.)
    badges: [String],
    imageUrl: String,
    imagePath: String,
    description: String,
    postcodes: [String] // List of specific Highland postcodes if they teach in-person
});

const Tutor = mongoose.model('Tutor', tutorSchema);

// List of Scottish Highland postcodes
const highlandPostcodes = [
    "IV1", "IV2", "IV3", "IV4", "IV5", "IV6", "IV7", "IV8", "IV9", "IV10",
    "IV11", "IV12", "IV13", "IV14", "IV15", "IV16", "IV17", "IV18", "IV19",
    "IV20", "IV21", "IV22", "IV23", "IV24", "IV25", "IV26", "IV27", "IV28",
    "IV29", "IV30", "IV31", "IV32", "IV36", "PH19", "PH20", "PH21", "PH22",
    "PH23", "PH24", "PH25", "PH26"
];

// Function to randomly pick 2-3 postcodes from the list
function getRandomPostcodes() {
    return highlandPostcodes.sort(() => 0.5 - Math.random()).slice(0, 3);
}

// Helper function to convert cost range to placeholder format
function convertCostRange(costRange) {
    return costRange.replace(/£/g, '__P__'); // Replace each £ with __P__
}

async function seedDatabase() {
    try {
        await connectToDatabase();
        // Clear existing data
        await Tutor.deleteMany({});

        const tutors = [
            {
                name: 'John Doe',
                subjects: ['Mathematics'],
                costRange: convertCostRange("££"),
                badges: ['PVG Registered', 'Fully Qualified Teacher', 'Safeguarding Passed'],
                imageUrl: './public/images/mathsTutor.PNG',
                imagePath: '/images/mathsTutor.PNG',
                description: "An experienced mathematics teacher with over 10 years of experience in tutoring students at all levels.",
                postcodes: ["Online", "IV1", "IV2", "IV3", "IV4", "IV5", "IV6", "IV7", "IV8", "IV9", "IV10"]
            },
            {
                name: 'Jane Smith',
                subjects: ['English', 'Mathematics'],
                costRange: convertCostRange("£££"),
                badges: ['PVG Registered', 'Safeguarding Passed'],
                imageUrl: './public/images/englishTutor.PNG',
                imagePath: '/images/englishTutor.PNG',
                description: "Passionate about literacy and numeracy, Jane has helped countless students improve their skills in English and Maths.",
                postcodes: ["Online"]
            },
            {
                name: 'Robert Brown',
                subjects: ['Mathematics'],
                costRange: convertCostRange("£"),
                badges: ['Fully Qualified Teacher'],
                imageUrl: './public/images/mathsTutor2.PNG',
                imagePath: '/images/mathsTutor2.PNG',
                description: "A retired maths professor who enjoys helping students build confidence in problem-solving.",
                postcodes: ["Online", "IV11", "IV12", "IV13", "IV14", "IV15", "IV16", "IV17", "IV18", "IV19"]
            },
            {
                name: 'Emily White',
                subjects: ['English'],
                costRange: convertCostRange("££"),
                badges: ['PVG Registered', 'Safeguarding Passed'],
                imageUrl: './public/images/englishTutor.PNG',
                imagePath: '/images/englishTutor2.PNG',
                description: "A dedicated English teacher with a focus on creative writing and literature.",
                postcodes: ["Online"]
            },
            {
                name: 'Gloria Wilson',
                subjects: ['Mathematics'],
                costRange: convertCostRange("£££"),
                badges: ['Fully Qualified Teacher', 'Tutoring for 15+ years'],
                imageUrl: './public/images/mathsTutor.PNG',
                imagePath: '/images/mathsTutor3.PNG',
                description: "Specializing in advanced mathematics, Gloria has helped students ace their exams for over a decade.",
                postcodes: ["Online", "IV20", "IV21", "IV22", "IV23", "IV24", "IV25", "IV26", "IV27", "IV28"]
            },
            {
                name: 'Red Green',
                subjects: ['English', 'Mathematics'],
                costRange: convertCostRange("££££"),
                badges: ['PVG Registered', 'Certified Exam Marker'],
                imageUrl: './public/images/englishTutor.PNG',
                imagePath: '/images/englishTutor3.PNG',
                description: "A passionate educator, Red specialises in exam preparation and academic writing.",
                postcodes: ["Online"]
            },
            {
                name: 'Michael Clarke',
                subjects: ['Mathematics'],
                costRange: convertCostRange("££"),
                badges: ['Fully Qualified Teacher', 'Former University Lecturer'],
                imageUrl: './public/images/mathsTutor4.PNG',
                imagePath: '/images/mathsTutor4.PNG',
                description: "With a background in academia, Michael provides in-depth lessons tailored for university-level students.",
                postcodes: ["Online", "IV32", "IV36", "PH19", "PH20", "PH21", "PH22", "PH23", "PH24", "PH25", "PH26"]
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
