// seedDatabase.js
const mongoose = require('mongoose');
const connectToDatabase = require('./api/connectToDatabase');
const Tutor = require('./models/Tutor'); // <-- Import the Tutor model

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
    // Replaces each '£' with '__P__'
    return costRange.replace(/£/g, '__P__');
}

async function seedDatabase() {
    try {
        await connectToDatabase();
        // Clear existing Tutor data
        await Tutor.deleteMany({});

        const tutors = [
            {
                name: 'John Doe',
                subjects: ['Mathematics'],
                costRange: convertCostRange("££"),
                badges: ['PVG Registered', 'Fully Qualified Teacher', 'Safeguarding Passed'],
                imagePath: '/images/mathsTutor.PNG',
                description: "An experienced mathematics teacher with over 10 years of experience in tutoring students at all levels.",
                postcodes: ["Online", "IV1", "IV2", "IV3", "IV4", "IV5", "IV6", "IV7", "IV8", "IV9", "IV10"],
                contact: "john.doe@example.com"
            },
            {
                name: 'Jane Smith',
                subjects: ['English', 'Mathematics'],
                costRange: convertCostRange("£££"),
                badges: ['PVG Registered', 'Safeguarding Passed'],
                imagePath: '/images/englishTutor.PNG',
                description: "Passionate about literacy and numeracy, Jane has helped countless students improve their skills in English and Maths.",
                postcodes: ["Online"],
                contact: "jane.smith@example.com"
            },
            {
                name: 'Robert Brown',
                subjects: ['Mathematics'],
                costRange: convertCostRange("£"),
                badges: ['Fully Qualified Teacher'],
                imagePath: '/images/mathsTutor2.PNG',
                description: "A retired maths professor who enjoys helping students build confidence in problem-solving.",
                postcodes: ["Online", "IV11", "IV12", "IV13", "IV14", "IV15", "IV16", "IV17", "IV18", "IV19"],
                contact: "robert.brown@example.com"
            },
            {
                name: 'Emily White',
                subjects: ['English'],
                costRange: convertCostRange("££"),
                badges: ['PVG Registered', 'Safeguarding Passed'],
                imagePath: '/images/englishTutor2.PNG',
                description: "A dedicated English teacher with a focus on creative writing and literature.",
                postcodes: ["Online"],
                contact: "emily.white@example.com"
            },
            {
                name: 'Gloria Wilson',
                subjects: ['Mathematics'],
                costRange: convertCostRange("£££"),
                badges: ['Fully Qualified Teacher', 'Tutoring for 15+ years'],
                imagePath: '/images/mathsTutor3.PNG',
                description: "Specializing in advanced mathematics, Gloria has helped students ace their exams for over a decade.",
                postcodes: ["Online", "IV20", "IV21", "IV22", "IV23", "IV24", "IV25", "IV26", "IV27", "IV28"],
                contact: "gloria.wilson@example.com"
            },
            {
                name: 'Red Green',
                subjects: ['English', 'Mathematics'],
                costRange: convertCostRange("££££"),
                badges: ['PVG Registered', 'Certified Exam Marker'],
                imagePath: '/images/englishTutor3.PNG',
                description: "A passionate educator, Red specialises in exam preparation and academic writing.",
                postcodes: ["Online"],
                contact: "red.green@example.com"
            },
            {
                name: 'Michael Clarke',
                subjects: ['Mathematics'],
                costRange: convertCostRange("££"),
                badges: ['Fully Qualified Teacher', 'Former University Lecturer'],
                imagePath: '/images/mathsTutor4.PNG',
                description: "With a background in academia, Michael provides in-depth lessons tailored for university-level students.",
                postcodes: ["Online", "IV32", "IV36", "PH19", "PH20", "PH21", "PH22", "PH23", "PH24", "PH25", "PH26"],
                contact: "michael.clarke@example.com"
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
