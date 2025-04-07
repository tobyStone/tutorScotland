// connectToDatabase.js

const mongoose = require('mongoose');
const path = require('path');

// Import config using an absolute path to avoid path resolution issues
let config;
try {
    config = require(path.join(process.cwd(), 'index', 'config'));
} catch (error) {
    // Fallback for Vercel environment
    config = {
        getDbConnectionString: () => {
            const dbName = 'tutorScotland';
            return `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.ntuqn.mongodb.net/${dbName}?retryWrites=true&w=majority`;
        }
    };
}

// Global promise to track connection status
let dbPromise = null;

async function connectToDatabase() {
    // If we already have a connection promise in progress, return it
    if (dbPromise) return dbPromise;

    // Create a new connection promise
    dbPromise = (async () => {
        // Check if we're already connected
        if (mongoose.connection.readyState === 1) {
            return mongoose.connection;
        }

        // Get connection string
        let dbUri;
        try {
            dbUri = config.getDbConnectionString();
        } catch (error) {
            console.error('Error getting DB connection string:', error);
            // Fallback to environment variables directly
            const dbName = 'tutorScotland';
            dbUri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.ntuqn.mongodb.net/${dbName}?retryWrites=true&w=majority`;
        }

        console.log('Connecting to MongoDB...');

        try {
            // Connect to the database
            await mongoose.connect(dbUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
                maxPoolSize: 10, // Maintain up to 10 socket connections
            });

            console.log('Connected to MongoDB');
            return mongoose.connection;
        } catch (error) {
            console.error('MongoDB connection error:', error);
            // Reset the promise so we can try again
            dbPromise = null;
            throw error;
        }
    })();

    return dbPromise;
}

// Export as a function directly
module.exports = connectToDatabase;
