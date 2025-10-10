/**
 * Debug script to test tutor search functionality
 */

const mongoose = require('mongoose');

// Connect to database
async function connectToDatabase() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorscotland');
    }
}

// Import Tutor model
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
        description: String,
        regions: [String],
        contact: String,
        tutorType: String
    });
    Tutor = mongoose.model('Tutor', tutorSchema);
}

async function debugTutorSearch() {
    try {
        await connectToDatabase();
        console.log('Connected to database');

        // Get all tutors
        const allTutors = await Tutor.find({}).lean();
        console.log('\n=== ALL TUTORS IN DATABASE ===');
        console.log(JSON.stringify(allTutors, null, 2));

        // Test specific searches
        console.log('\n=== TESTING SPECIFIC SEARCHES ===');

        // Search for cantonese
        const cantoneseSearch = await Tutor.find({
            subjects: { $regex: 'cantonese', $options: 'i' }
        }).lean();
        console.log('\nCantonese search results:', JSON.stringify(cantoneseSearch, null, 2));

        // Search for Fife
        const fifeSearch = await Tutor.find({
            regions: { $regex: 'fife', $options: 'i' }
        }).lean();
        console.log('\nFife search results:', JSON.stringify(fifeSearch, null, 2));

        // Search for __P__
        const costSearch = await Tutor.find({
            costRange: '__P__'
        }).lean();
        console.log('\nCost __P__ search results:', JSON.stringify(costSearch, null, 2));

        // Combined search
        const combinedSearch = await Tutor.find({
            subjects: { $regex: 'cantonese', $options: 'i' },
            regions: { $regex: 'fife', $options: 'i' },
            costRange: '__P__'
        }).lean();
        console.log('\nCombined search results:', JSON.stringify(combinedSearch, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

debugTutorSearch();
