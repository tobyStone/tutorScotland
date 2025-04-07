// connectToDatabase.js

const mongoose = require('mongoose');
const { getDbConnectionString } = require('./config');

let cachedDb = null;

async function connectToDatabase() {
    // If already connected, reuse it
    if (cachedDb) return cachedDb;

    // Use the connection string from config.js
    const dbUri = getDbConnectionString();

    // Connect once, store in cachedDb
    await mongoose.connect(dbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    cachedDb = mongoose.connection;
    return cachedDb;
}

module.exports = {
    connectToDatabase
};
