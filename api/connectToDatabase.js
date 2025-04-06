// connectToDatabase.js
const mongoose = require('mongoose');
const { put } = require('@vercel/blob');

let cachedDb = null;

module.exports = {
    connectToDatabase: async function() {
        if (cachedDb) {
            return cachedDb;
        }

        const connection = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        cachedDb = connection;
        return cachedDb;
    },

    uploadImage: async function(file, folder) {
        if (!file || !file.buffer) return '';
        
        try {
            const filename = `${folder}/${Date.now()}-${file.originalname}`;
            const blob = await put(filename, file.buffer, {
                access: 'public',
                addRandomSuffix: true
            });
            
            return blob.url;
        } catch (error) {
            console.error('Error uploading to Vercel Blob:', error);
            throw error;
        }
    }
};
