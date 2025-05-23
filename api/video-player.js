// video-player.js - API for video hosting and playback with Google Cloud Storage
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

// Initialize Google Cloud Storage
let storage;
try {
    // Check if credentials are provided as environment variables
    if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_CREDENTIALS) {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            credentials
        });
    } else {
        // Fall back to application default credentials
        storage = new Storage();
    }
} catch (error) {
    console.error('Error initializing Google Cloud Storage:', error);
}

// Configuration
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'tutor-scotland-videos';
const URL_EXPIRATION = 60 * 60 * 1000; // URL expires after 1 hour

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request (preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle GET request - list videos or get signed URL
    if (req.method === 'GET') {
        const videoId = req.query.videoId;

        // If videoId is provided, generate a signed URL for that video
        if (videoId) {
            try {
                const file = storage.bucket(BUCKET_NAME).file(videoId);

                // Check if file exists
                const [exists] = await file.exists();
                if (!exists) {
                    return res.status(404).json({ error: 'Video not found' });
                }

                // Generate signed URL
                const [signedUrl] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + URL_EXPIRATION
                });

                return res.status(200).json({ url: signedUrl });
            } catch (error) {
                console.error('Error generating signed URL:', error);
                return res.status(500).json({ error: 'Failed to generate video URL' });
            }
        }

        // If no videoId, list all videos in the bucket
        try {
            const [files] = await storage.bucket(BUCKET_NAME).getFiles();

            const videos = files.map(file => ({
                id: file.name,
                name: file.name.replace(/\.[^/.]+$/, "").replace(/-/g, " "), // Remove extension and replace hyphens with spaces
                contentType: file.metadata.contentType,
                size: file.metadata.size,
                updated: file.metadata.updated
            }));

            return res.status(200).json({ videos });
        } catch (error) {
            console.error('Error listing videos:', error);
            return res.status(500).json({ error: 'Failed to list videos' });
        }
    }

    // Handle POST request - upload a new video
    if (req.method === 'POST') {
        // This would typically use a multipart form upload
        // For serverless functions, direct upload to GCS with signed URL is recommended
        // This endpoint can generate a signed URL for uploading

        const fileName = req.body.fileName;
        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        try {
            const file = storage.bucket(BUCKET_NAME).file(fileName);

            // Generate signed URL for uploading
            const [uploadUrl] = await file.getSignedUrl({
                action: 'write',
                expires: Date.now() + URL_EXPIRATION,
                contentType: req.body.contentType || 'video/mp4'
            });

            return res.status(200).json({ uploadUrl });
        } catch (error) {
            console.error('Error generating upload URL:', error);
            return res.status(500).json({ error: 'Failed to generate upload URL' });
        }
    }

    // Handle unsupported methods
    return res.status(405).json({ error: 'Method not allowed' });
};
