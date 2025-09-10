/**
 * @fileoverview Video sections management API with Google Cloud integration
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Video section management system supporting:
 * - Video section CRUD operations
 * - Google Cloud Storage integration
 * - Video URL validation and processing
 * - Integration with existing Section model
 *
 * @security Admin authentication required for write operations
 * @performance Implements efficient video processing and storage
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

        // 🔒 SECURITY FIX: Add authentication for write operations
        if (['POST', 'PUT', 'DELETE'].includes(method)) {
            const { verify } = require('./protected');
            const [ok, payload] = verify(req, res);
            if (!ok) {
                console.warn('🚨 SECURITY: Unauthorized video sections management attempt from IP:', req.ip || req.connection.remoteAddress);
                return res.status(401).json({
                    message: 'Authentication required for video sections management',
                    error: 'UNAUTHORIZED_VIDEO_ACCESS'
                });
            }

            // Require admin role for video sections management
            if (payload.role !== 'admin') {
                console.warn(`🚨 SECURITY: User role '${payload.role}' attempted video sections management. User ID: ${payload.id}`);
                return res.status(403).json({
                    message: 'Admin access required for video sections management',
                    error: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            console.log(`✅ Authenticated video sections management by admin ${payload.id}`);
        }

        const { operation } = req.query;

        switch (method) {
            case 'GET':
                if (operation === 'list-videos') {
                    return handleListVideos(req, res);
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
            console.log('🌩️ Attempting to list Google Cloud videos...');

            // Initialize Google Cloud Storage with consistent configuration
            let storage;
            const { Storage } = require('@google-cloud/storage');

            // Primary method: Use tech team's recommended environment variables
            if (process.env.GCP_PROJECT_ID && process.env.GCS_SA_KEY) {
                const credentials = JSON.parse(process.env.GCS_SA_KEY);
                const projectId = process.env.GCP_PROJECT_ID.replace(/['"]/g, ''); // Remove any quotes
                console.log(`🔑 Using GCP Project ID: ${projectId}`);
                console.log(`🔑 Service Account Email: ${credentials.client_email}`);

                storage = new Storage({
                    projectId: projectId,
                    credentials: credentials
                });
            }
            // Fallback methods for backward compatibility
            else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
                console.log('🔄 Using fallback GOOGLE_CLOUD_CREDENTIALS');
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
                const bucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_BUCKET || 'maths_incoding';
                console.log(`🪣 Using bucket: ${bucketName}`);
                const bucket = storage.bucket(bucketName);

                // Try multiple prefixes to find videos in different folder structures
                const prefixes = ['video-content/'];
                let allFiles = [];

                for (const prefix of prefixes) {
                    try {
                        console.log(`📂 Listing files with prefix: ${prefix}`);
                        const [files] = await bucket.getFiles({
                            prefix: prefix,
                            maxResults: 100
                        });
                        console.log(`📁 Found ${files.length} files with prefix ${prefix}`);
                        allFiles = allFiles.concat(files);
                    } catch (error) {
                        console.error(`❌ Could not list files with prefix ${prefix}:`, error.message);
                        console.error(`❌ Error details:`, error);
                    }
                }

                console.log(`📊 Total files found: ${allFiles.length}`);

                googleCloudVideos = allFiles
                    .filter(file => {
                        const ext = file.name.split('.').pop().toLowerCase();
                        const isVideo = ['mp4', 'webm', 'ogg'].includes(ext);
                        console.log(`🎬 File: ${file.name}, Extension: ${ext}, Is Video: ${isVideo}`);
                        return isVideo;
                    })
                    .map(file => ({
                        name: file.name.split('/').pop(),
                        url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
                        type: 'google-cloud',
                        size: file.metadata.size ? parseInt(file.metadata.size) : null,
                        lastModified: file.metadata.timeCreated
                    }));

                console.log(`🎥 Google Cloud videos found: ${googleCloudVideos.length}`);
                if (googleCloudVideos.length > 0) {
                    googleCloudVideos.forEach(video => {
                        console.log(`  - ${video.name} (${video.size} bytes)`);
                    });
                } else {
                    console.log('📝 No Google Cloud videos found - this may be due to:');
                    console.log('   1. No videos uploaded yet');
                    console.log('   2. Service account lacks "Storage Object Viewer" role');
                    console.log('   3. Videos stored in different folder structure');
                }
            } else {
                console.log('❌ No Google Cloud Storage instance available');
            }
        } catch (error) {
            console.error('❌ Error listing Google Cloud videos:', error.message);
            console.error('❌ Full error details:', error);
            // Google Cloud might not be configured or permissions issue
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
