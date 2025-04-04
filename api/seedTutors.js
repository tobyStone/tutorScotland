const mongoose = require('mongoose');
const connectToDatabase = require('./connectToDatabase');

// Define Tutor Schema
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,
    badges: [String],
    imagePath: String,
    postcodes: [String]
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
                imagePath: "/images/tutor1.jpg",
                postcodes: ["Online", "EH1", "EH2"]
            },
            {
                name: "John Doe",
                subjects: ["English", "Literature"],
                costRange: "__P____P____P__",
                badges: ["Qualified Teacher", "Enhanced DBS", "5+ Years Experience"],
                imagePath: "/images/tutor2.jpg",
                postcodes: ["Online"]
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
