// connectToDatabase.js
const mongoose = require('mongoose');
const config = require('../index/config');

let isConnected = false;

async function connectToDatabase() {
    if (isConnected) {
        console.log("Using existing database connection.");
        return mongoose.connection;
    }

    const dbUri = config.getDbConnectionString();
    try {
        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        console.log("Database connected successfully.");
        return mongoose.connection;
    } catch (error) {
        console.error("Error connecting to database:", error);
        throw new Error("Failed to connect to database");
    }
}

module.exports = connectToDatabase;
