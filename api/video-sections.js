/**
 * /api/video-sections - Video Section Management API
 * Handles CRUD operations for video sections that integrate with Google Cloud Storage
 * Uses the existing Section model with layout: 'video' and videoUrl field
 */
const { formidable } = require('formidable');
const connectToDatabase = require('./connectToDatabase');
const Section = require('../models/Section');

// Convert formidable's callback to a promise
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({
            keepExtensions: true,
            multiples: false,
            maxFileSize: 50 * 1024 * 1024 // 50MB limit
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error('Form parsing error:', err);
                return reject(err);
            }

            // Convert arrays to single values (formidable returns arrays)
            const cleanFields = {};
            for (const [key, value] of Object.entries(fields)) {
                cleanFields[key] = Array.isArray(value) ? value[0] : value;
            }

            resolve({ fields: cleanFields, files });
        });
    });
};

module.exports = async (req, res) => {
    try {
        await connectToDatabase();

        const { method } = req;
        
        const { operation } = req.query;

        switch (method) {
            case 'GET':
                if (operation === 'list-videos') {
                    return handleListVideos(req, res);
                }
                if (operation === 'debug-gcs') {
                    return handleDebugGCS(req, res);
                }
                return handleGetVideoSections(req, res);
            case 'POST':
                return handleCreateVideoSection(req, res);
            case 'PUT':
                return handleUpdateVideoSection(req, res);
            case 'DELETE':
                return handleDeleteVideoSection(req, res);
            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).json({ message: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Video Sections API error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * DEBUG - Test Google Cloud Storage connection
 * Query params: ?operation=debug-gcs
 */
async function handleDebugGCS(req, res) {
    try {
        const { Storage } = require('@google-cloud/storage');

        let storage;
        let configUsed = 'none';

        // Test configuration methods
        if (process.env.GCP_PROJECT_ID && process.env.GCS_SA_KEY) {
            try {
                const credentials = JSON.parse(process.env.GCS_SA_KEY);
                storage = new Storage({
                    projectId: process.env.GCP_PROJECT_ID,
                    credentials: credentials
                });
                configUsed = 'GCP_PROJECT_ID + GCS_SA_KEY';
            } catch (error) {
                return res.status(500).json({
                    error: 'Failed to parse GCS_SA_KEY',
                    message: error.message
                });
            }
        }

        if (!storage) {
            return res.status(500).json({
                error: 'No valid Google Cloud configuration found',
                envVars: {
                    hasGcpProjectId: !!process.env.GCP_PROJECT_ID,
                    hasGcsSaKey: !!process.env.GCS_SA_KEY,
                    hasGcsBucketName: !!process.env.GCS_BUCKET_NAME
                }
            });
        }

        const bucketName = process.env.GCS_BUCKET_NAME || 'tutor-scotland-videos';
        const bucket = storage.bucket(bucketName);

        // Skip bucket existence check (requires storage.buckets.get permission)
        // Try to list files directly
        const [allFiles] = await bucket.getFiles({ maxResults: 50 });

        const fileList = allFiles.map(file => ({
            name: file.name,
            size: file.metadata.size,
            contentType: file.metadata.contentType,
            timeCreated: file.metadata.timeCreated
        }));

        return res.status(200).json({
            success: true,
            configUsed,
            bucketName,
            totalFiles: allFiles.length,
            files: fileList
        });

    } catch (error) {
        return res.status(500).json({
            error: 'Debug GCS failed',
            message: error.message,
            stack: error.stack
        });
    }
}

/**
 * GET - List all available videos (static + blob)
 * Query params: ?operation=list-videos
 */
async function handleListVideos(req, res) {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        const { list } = require('@vercel/blob');

        console.log('Listing all available videos...');

        // Get static videos from public/videos directory
        let staticVideos = [];
        try {
            const videosDir = path.join(process.cwd(), 'public', 'videos');
            const files = await fs.readdir(videosDir);

            staticVideos = files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.mp4', '.webm', '.ogg'].includes(ext);
                })
                .map(file => ({
                    name: file,
                    url: `/videos/${file}`,
                    type: 'static',
                    size: null, // We could get file size if needed
                    lastModified: null
                }));
        } catch (error) {
            console.warn('Could not read static videos directory:', error.message);
            // Directory might not exist yet, that's okay
        }

        // Get blob videos from Vercel Blob storage
        let blobVideos = [];
        try {
            const { blobs } = await list({
                prefix: 'video-content/',
                limit: 100
            });

            blobVideos = blobs
                .filter(blob => {
                    const ext = blob.pathname.split('.').pop().toLowerCase();
                    return ['mp4', 'webm', 'ogg'].includes(ext);
                })
                .map(blob => ({
                    name: blob.pathname.split('/').pop(),
                    url: blob.url,
                    type: 'blob',
                    size: blob.size,
                    lastModified: blob.uploadedAt
                }));
        } catch (error) {
            console.warn('Could not list blob videos:', error.message);
            // Blob storage might not be configured or empty
        }

        // Get Google Cloud videos (using tech team's recommended configuration)
        let googleCloudVideos = [];
        try {
            // Initialize Google Cloud Storage with consistent configuration
            let storage;
            const { Storage } = require('@google-cloud/storage');

            // Primary method: Use tech team's recommended environment variables
            if (process.env.GCP_PROJECT_ID && process.env.GCS_SA_KEY) {
                const credentials = JSON.parse(process.env.GCS_SA_KEY);
                storage = new Storage({
                    projectId: process.env.GCP_PROJECT_ID,
                    credentials: credentials
                });
            }
            // Fallback methods for backward compatibility
            else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
                const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
                storage = new Storage({
                    projectId: credentials.project_id,
                    credentials: credentials
                });
            } else if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
                storage = new Storage({
                    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
                    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || './google-cloud-key.json'
                });
            }

            if (storage) {
                const bucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_BUCKET || 'tutor-scotland-videos';
                const bucket = storage.bucket(bucketName);

                // Try multiple prefixes to find videos in different folder structures
                const prefixes = ['video-content/', 'maths_incoding/video-content/'];
                let allFiles = [];

                for (const prefix of prefixes) {
                    try {
                        const [files] = await bucket.getFiles({
                            prefix: prefix,
                            maxResults: 100
                        });
                        allFiles = allFiles.concat(files);
                    } catch (error) {
                        console.warn(`Could not list files with prefix ${prefix}:`, error.message);
                    }
                }

                googleCloudVideos = allFiles
                    .filter(file => {
                        const ext = file.name.split('.').pop().toLowerCase();
                        return ['mp4', 'webm', 'ogg'].includes(ext);
                    })
                    .map(file => ({
                        name: file.name.split('/').pop(),
                        url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
                        type: 'google-cloud',
                        size: file.metadata.size ? parseInt(file.metadata.size) : null,
                        lastModified: file.metadata.timeCreated
                    }));
            }
        } catch (error) {
            console.warn('Could not list Google Cloud videos:', error.message);
            console.warn('Google Cloud config check:', {
                hasGcpProjectId: !!process.env.GCP_PROJECT_ID,
                hasGcsSaKey: !!process.env.GCS_SA_KEY,
                hasLegacyCredentials: !!process.env.GOOGLE_CLOUD_CREDENTIALS,
                hasLegacyProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
                bucketName: process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_BUCKET || 'tutor-scotland-videos'
            });
            // Google Cloud might not be configured
        }

        const totalVideos = staticVideos.length + blobVideos.length + googleCloudVideos.length;
        console.log(`Found ${totalVideos} videos: ${staticVideos.length} static, ${blobVideos.length} blob, ${googleCloudVideos.length} google-cloud`);

        return res.status(200).json({
            staticVideos,
            blobVideos,
            googleCloudVideos,
            totalCount: totalVideos
        });
    } catch (error) {
        console.error('List videos error:', error);
        return res.status(500).json({
            message: 'Error listing videos',
            error: error.message
        });
    }
}

/**
 * GET - Fetch video sections
 * Query params: ?page=homepage (optional)
 */
async function handleGetVideoSections(req, res) {
    try {
        const { page } = req.query;
        
        let query = { layout: 'video' };
        if (page) {
            query.page = page;
        }

        const videoSections = await Section.find(query)
            .sort({ order: 1, createdAt: -1 })
            .lean();

        console.log(`Found ${videoSections.length} video sections for page: ${page || 'all'}`);
        
        return res.status(200).json(videoSections);
    } catch (error) {
        console.error('GET video sections error:', error);
        return res.status(500).json({ 
            message: 'Error fetching video sections',
            error: error.message 
        });
    }
}

/**
 * POST - Create new video section
 * Body: { page, heading, videoUrl, position?, order?, buttonLabel?, buttonUrl? }
 */
async function handleCreateVideoSection(req, res) {
    try {
        // Parse form data
        const { fields } = await parseForm(req);
        const { page, heading, videoUrl, position, order, buttonLabel, buttonUrl, editId } = fields;

        // Validate required fields
        if (!page || !heading || !videoUrl) {
            return res.status(400).json({ 
                message: 'Missing required fields: page, heading, and videoUrl are required' 
            });
        }

        // Validate video URL format
        if (!isValidVideoUrl(videoUrl)) {
            return res.status(400).json({
                message: 'Invalid video URL. Must be a static video (/videos/...), Vercel Blob URL, or Google Cloud Storage URL ending in .mp4, .webm, or .ogg'
            });
        }

        // Handle update if editId is provided
        if (editId) {
            const updateData = {
                page,
                heading,
                videoUrl,
                layout: 'video',
                position: position || 'bottom',
                order: order || 0,
                buttonLabel: buttonLabel || '',
                buttonUrl: buttonUrl || ''
            };

            const updatedSection = await Section.findByIdAndUpdate(editId, updateData, { new: true });

            if (!updatedSection) {
                return res.status(404).json({ message: 'Video section not found' });
            }

            console.log('Updated video section:', updatedSection._id);

            return res.status(200).json({
                message: 'Video section updated successfully',
                section: updatedSection
            });
        }

        // Create new video section
        const videoSection = new Section({
            page,
            heading,
            videoUrl,
            layout: 'video',
            position: position || 'bottom',
            order: order || 0,
            buttonLabel: buttonLabel || '',
            buttonUrl: buttonUrl || '',
            // Generate block IDs for visual editor integration
            headingBlockId: generateBlockId(),
            videoBlockId: generateBlockId(),
            buttonBlockId: buttonLabel ? generateBlockId() : ''
        });

        const savedSection = await videoSection.save();

        console.log('Created video section:', savedSection._id);

        return res.status(201).json({
            message: 'Video section created successfully',
            section: savedSection
        });
    } catch (error) {
        console.error('POST video section error:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation error',
                errors: Object.values(error.errors).map(e => e.message)
            });
        }
        
        return res.status(500).json({ 
            message: 'Error creating video section',
            error: error.message 
        });
    }
}

/**
 * PUT - Update existing video section
 * Body: { id, heading?, videoUrl?, position?, order?, buttonLabel?, buttonUrl? }
 */
async function handleUpdateVideoSection(req, res) {
    try {
        const { id, heading, videoUrl, position, order, buttonLabel, buttonUrl } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Section ID is required' });
        }

        // Find the existing section
        const existingSection = await Section.findById(id);
        if (!existingSection) {
            return res.status(404).json({ message: 'Video section not found' });
        }

        if (existingSection.layout !== 'video') {
            return res.status(400).json({ message: 'Section is not a video section' });
        }

        // Validate video URL if provided
        if (videoUrl && !isValidVideoUrl(videoUrl)) {
            return res.status(400).json({
                message: 'Invalid video URL. Must be a static video (/videos/...), Vercel Blob URL, or Google Cloud Storage URL ending in .mp4, .webm, or .ogg'
            });
        }

        // Update fields
        const updateData = {};
        if (heading !== undefined) updateData.heading = heading;
        if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
        if (position !== undefined) updateData.position = position;
        if (order !== undefined) updateData.order = order;
        if (buttonLabel !== undefined) updateData.buttonLabel = buttonLabel;
        if (buttonUrl !== undefined) updateData.buttonUrl = buttonUrl;

        // Generate button block ID if button is being added
        if (buttonLabel && !existingSection.buttonBlockId) {
            updateData.buttonBlockId = generateBlockId();
        }

        const updatedSection = await Section.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        console.log('Updated video section:', updatedSection._id);
        
        return res.status(200).json({
            message: 'Video section updated successfully',
            section: updatedSection
        });
    } catch (error) {
        console.error('PUT video section error:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation error',
                errors: Object.values(error.errors).map(e => e.message)
            });
        }
        
        return res.status(500).json({ 
            message: 'Error updating video section',
            error: error.message 
        });
    }
}

/**
 * DELETE - Remove video section
 * Query: ?id=sectionId
 */
async function handleDeleteVideoSection(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ message: 'Section ID is required' });
        }

        const deletedSection = await Section.findByIdAndDelete(id);
        
        if (!deletedSection) {
            return res.status(404).json({ message: 'Video section not found' });
        }

        if (deletedSection.layout !== 'video') {
            return res.status(400).json({ message: 'Section is not a video section' });
        }

        console.log('Deleted video section:', deletedSection._id);
        
        return res.status(200).json({
            message: 'Video section deleted successfully',
            deletedSection: {
                id: deletedSection._id,
                heading: deletedSection.heading,
                page: deletedSection.page
            }
        });
    } catch (error) {
        console.error('DELETE video section error:', error);
        return res.status(500).json({ 
            message: 'Error deleting video section',
            error: error.message 
        });
    }
}

/**
 * Validate video URL (static, Vercel Blob, or Google Cloud Storage)
 */
function isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Check if it's a static video URL
    const staticPattern = /^\/videos\/[^\/]+\.(mp4|webm|ogg)$/i;
    if (staticPattern.test(url)) return true;

    // Check if it's a Vercel Blob URL
    const blobPattern = /^https:\/\/[^\/]+\.public\.blob\.vercel-storage\.com\/.*\.(mp4|webm|ogg)$/i;
    if (blobPattern.test(url)) return true;

    // Check if it's a Google Cloud Storage URL (for backward compatibility)
    const googleCloudPattern = /^https:\/\/storage\.googleapis\.com\/[^\/]+\/.*\.(mp4|webm|ogg)$/i;
    if (googleCloudPattern.test(url)) return true;

    return false;
}

/**
 * Generate a unique block ID for visual editor integration
 */
function generateBlockId() {
    return 'video-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
