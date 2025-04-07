const mongoose = require('mongoose');
const connectToDatabase = require('./connectToDatabase');

// Define Tutor Schema
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,
    badges: [String],
    imagePath: String,
    postcodes: [String],
    contact: String // Add contact field for email or website
});

async function seedTutors() {
    try {
        await connectToDatabase();
        
        // Create the Tutor model
        const Tutor = mongoose.model('Tutor', tutorSchema);
        
        // Clear existing tutors
        await Tutor.deleteMany({});
        
        // Create sample tutors
        const tutors = [
            {
                name: "Jane Smith",
                subjects: ["Mathematics", "Physics"],
                costRange: "__P____P__",
                badges: ["Qualified Teacher", "Enhanced DBS"],
                imagePath: "/images/tutor0.jpg",
                postcodes: ["Online", "EH1", "EH2"],
                contact: "jane.smith@example.com"
            },
            {
                name: "John Doe",
                subjects: ["English", "Literature"],
                costRange: "__P____P____P__",
                badges: ["Qualified Teacher", "Enhanced DBS", "5+ Years Experience"],
                imagePath: "/images/tutor0.jpg",
                postcodes: ["Online"],
                contact: "https://johndoe-tutor.example.com"
            },
            {
                name: "Sarah Johnson",
                subjects: ["Chemistry", "Biology"],
                costRange: "__P____P____P____P__",
                badges: ["PhD", "Enhanced DBS", "10+ Years Experience"],
                imagePath: "/images/tutor0.jpg",
                postcodes: ["Online", "EH3", "EH4"],
                contact: "sarah.johnson@example.com"
            },
            {
                name: "Michael Brown",
                subjects: ["Computer Science", "Mathematics"],
                costRange: "__P____P____P__",
                badges: ["Industry Professional", "Enhanced DBS"],
                imagePath: "/images/tutor0.jpg",
                postcodes: ["Online", "EH10"],
                contact: "https://michaelbrown-tech.example.com"
            },
            {
                name: "Emily Wilson",
                subjects: ["French", "Spanish", "German"],
                costRange: "__P____P__",
                badges: ["Native Speaker", "Enhanced DBS", "TEFL Certified"],
                imagePath: "/images/tutor0.jpg",
                postcodes: ["Online", "EH6"],
                contact: "emily.wilson@example.com"
            },
            {
                name: "David Clark",
                subjects: ["History", "Politics"],
                costRange: "__P____P____P____P____P__",
                badges: ["PhD", "University Lecturer", "Enhanced DBS"],
                imagePath: "/images/tutor0.jpg",
                postcodes: ["Online"],
                contact: "https://davidclark-history.example.com"
            }
        ];
        
        // Insert the tutors
        await Tutor.insertMany(tutors);
        
        console.log('Sample tutors created successfully!');
        
        // Close the connection
        mongoose.connection.close();
    } catch (error) {
        console.error('Error seeding tutors:', error);
        mongoose.connection.close();
    }
}

// Run the seeding function
seedTutors();
