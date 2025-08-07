/**
 * /api/video-sections - Video Section Management API
 * Handles CRUD operations for video sections that integrate with Google Cloud Storage
 * Uses the existing Section model with layout: 'video' and videoUrl field
 */
const connectToDatabase = require('./connectToDatabase');
const Section = require('../models/Section');

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

        const totalVideos = staticVideos.length + blobVideos.length;
        console.log(`Found ${totalVideos} videos: ${staticVideos.length} static, ${blobVideos.length} blob`);

        return res.status(200).json({
            staticVideos,
            blobVideos,
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
        const { page, heading, videoUrl, position, order, buttonLabel, buttonUrl } = req.body;

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

        // Create the video section
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
 * Body: { id }
 */
async function handleDeleteVideoSection(req, res) {
    try {
        const { id } = req.body;

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
