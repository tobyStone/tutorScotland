// updateDatabase.js
const connectToDatabase = require('./api/connectToDatabase');
const Tutor = require('./models/Tutor'); // references the new Tutor schema

async function updateDatabase() {
    try {
        await connectToDatabase();
        // Remove the imageUrl field from all Tutor documents
        const result = await Tutor.updateMany({}, { $unset: { imageUrl: "" } });
        console.log('Update result:', result);
        process.exit(0);
    } catch (error) {
        console.error('Error updating database:', error);
        process.exit(1);
    }
}

updateDatabase();
