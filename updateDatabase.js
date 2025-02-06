// updateDatabase.js
const mongoose = require('mongoose');
const connectToDatabase = require('./api/connectToDatabase');
const Tutor = require('./models/Tutor'); // Assuming you export your Tutor model from a separate file

async function updateDatabase() {
    try {
        await connectToDatabase();
        // Example: Update a tutor’s cost range
        const result = await Tutor.updateOne({ name: 'John Doe' }, { costRange: 3 });
        console.log('Update result:', result);
        process.exit(0);
    } catch (error) {
        console.error('Error updating database:', error);
        process.exit(1);
    }
}

updateDatabase();
