// connectToDatabase.js

const mongoose = require('mongoose');
const { putObject } = require('@vercel/blob');
// Or if your version of @vercel/blob is older, you might import { put } instead

let cachedDb = null;

async function connectToDatabase() {
    // Reuse DB connection if we've already made it
    if (cachedDb) return cachedDb;

    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // We can store the ready connection in cachedDb for next time
    cachedDb = mongoose.connection;
    return cachedDb;
}

async function uploadImage(file, folder) {
    // If there’s no file or no buffer from Multer, return an empty string
    if (!file || !file.buffer) return '';

    try {
        const fileName = `${folder}/${Date.now()}-${file.originalname}`;
        const mimeType = file.mimetype;

        // putObject is the function from @vercel/blob 
        // that actually uploads your file’s Buffer to Vercel Blob
        const result = await putObject({
            path: fileName,              // e.g. "tutor-images/1680896623-myPic.png"
            data: file.buffer,           // from Multer memoryStorage
            contentType: mimeType,       // e.g. "image/png"
            access: 'public',            // or "private"
            token: process.env.BLOB_READ_WRITE_TOKEN // the env var with the blob token
        });

        // result.url is your new image’s public URL on Vercel Blob
        return result.url;
    } catch (error) {
        console.error('Error uploading to Vercel Blob:', error);
        throw error;
    }
}

// Export both as properties on the same module
module.exports = {
    connectToDatabase,
    uploadImage
};
