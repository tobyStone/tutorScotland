const connectDB = require('./connectToDatabase');
const Section = require('../models/Section');
const Order = require('../models/Order');
const { list } = require('@vercel/blob');

const ITEMS_PER_PAGE = 20;

module.exports = async (req, res) => {
    try {
        await connectDB();

        const { method, query, body } = req;
        // Allow operation from either query string or body for robustness
        const operation = query.operation || (body && body.operation);
        const { page, selector, type, id } = query;

        // Debug logging while testing
        console.log('Content Manager Request:', {
            method,
            operation,
            query,
            bodyKeys: body ? Object.keys(body) : 'no body'
        });

        /* ---------- NEW: section order endpoints ---------- */
        if (method === 'GET'  && operation === 'get-order') return getOrder(req, res);
        if (method === 'POST' && operation === 'set-order') return setOrder(req, res);

        // GET Operations
        if (method === 'GET') {
            // Scan page for editable elements
            if (operation === 'scan') {
                return handlePageScan(req, res);
            }

            // Get content overrides for a page
            if (operation === 'overrides') {
                return handleGetOverrides(req, res);
            }

            // Get original content backup
            if (operation === 'backup') {
                return handleGetBackup(req, res);
            }

            // List images from blob storage
            if (operation === 'list-images') {
                return handleListImages(req, res);
            }
        }

        // POST Operations
        if (method === 'POST') {
            // Create new content override
            if (operation === 'override') {
                return handleCreateOverride(req, res);
            }
            
            // Backup original content
            if (operation === 'backup') {
                return handleCreateBackup(req, res);
            }
        }

        // PATCH Operations
        if (method === 'PATCH') {
            return handleUpdateOverride(req, res);
        }

        // DELETE Operations
        if (method === 'DELETE') {
            return handleDeleteOverride(req, res);
        }

        return res.status(400).json({ message: 'Invalid operation' });

    } catch (error) {
        console.error('Content Manager Error:', error);
        return res.status(500).json({ 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

// Get content overrides for a specific page
async function handleGetOverrides(req, res) {
    try {
        const { page } = req.query;
        
        if (!page) {
            return res.status(400).json({ message: 'Page parameter required' });
        }

        const overrides = await Section.find({
            isContentOverride: true,
            targetPage: page,
            isActive: { $ne: false }
        }).lean();

        return res.status(200).json(overrides);
    } catch (error) {
        console.error('Get Overrides Error:', error);
        return res.status(500).json({ message: 'Error fetching overrides' });
    }
}

// Create new content override
async function handleCreateOverride(req, res) {
    try {
        console.log('Creating override with payload:', req.body);

        const {
            targetPage,
            targetSelector,
            contentType,
            heading,
            text,
            image,
            originalContent,
            overrideType = 'replace',
            isButton = false
        } = req.body;

        if (!targetPage || !targetSelector || !contentType) {
            return res.status(400).json({ 
                message: 'targetPage, targetSelector, and contentType are required' 
            });
        }

        // Validate content type
        const allowedTypes = ['text', 'html', 'image', 'link', 'list', 'button'];
        if (!allowedTypes.includes(contentType)) {
            return res.status(400).json({ 
                message: 'Unsupported content type. Allowed types: ' + allowedTypes.join(', ')
            });
        }

        // Normalize content type (list stored as html, button as link)
        const normalizedType = contentType === 'list' ? 'html' : contentType;

        // Check if override already exists
        const existingOverride = await Section.findOne({
            isContentOverride: true,
            targetPage,
            targetSelector
        });

        if (existingOverride) {
            // Update existing override
            existingOverride.page = targetPage; // Satisfy schema requirement
            existingOverride.heading = heading;
            existingOverride.text = text;
            existingOverride.image = image;
            existingOverride.contentType = normalizedType;
            existingOverride.overrideType = overrideType;
            existingOverride.isActive = true;
            existingOverride.isButton = isButton;
            existingOverride.updatedAt = new Date();

            await existingOverride.save();
            return res.status(200).json(existingOverride);
        } else {
            // Create new override
            const newOverride = new Section({
                page: targetPage, // Satisfy schema requirement
                isContentOverride: true,
                targetPage,
                targetSelector,
                contentType: normalizedType,
                heading,
                text,
                image,
                isButton,
                originalContent,
                overrideType,
                isActive: true,
                isPublished: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await newOverride.save();
            return res.status(201).json(newOverride);
        }
    } catch (error) {
        console.error('Create Override Error:', error);
        return res.status(500).json({ message: 'Error creating override' });
    }
}

// Update existing content override
async function handleUpdateOverride(req, res) {
    try {
        const { id } = req.query;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Override ID required' });
        }

        // Ensure isButton is explicitly handled if present in updateData
        if ('isButton' in updateData) {
            updateData.isButton = Boolean(updateData.isButton);
        }

        const override = await Section.findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true }
        );

        if (!override) {
            return res.status(404).json({ message: 'Override not found' });
        }

        return res.status(200).json(override);
    } catch (error) {
        console.error('Update Override Error:', error);
        return res.status(500).json({ message: 'Error updating override' });
    }
}

// Delete content override (restore original)
async function handleDeleteOverride(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ message: 'Override ID required' });
        }

        const override = await Section.findByIdAndDelete(id);

        if (!override) {
            return res.status(404).json({ message: 'Override not found' });
        }

        return res.status(200).json({ message: 'Override deleted successfully' });
    } catch (error) {
        console.error('Delete Override Error:', error);
        return res.status(500).json({ message: 'Error deleting override' });
    }
}

// Scan page for editable elements (placeholder for now)
async function handlePageScan(req, res) {
    try {
        const { page } = req.query;
        
        if (!page) {
            return res.status(400).json({ message: 'Page parameter required' });
        }

        // This would typically analyze the HTML structure
        // For now, return common selectors for your site
        const editableElements = getCommonEditableElements(page);
        
        return res.status(200).json(editableElements);
    } catch (error) {
        console.error('Page Scan Error:', error);
        return res.status(500).json({ message: 'Error scanning page' });
    }
}

// Get common editable elements for different pages
function getCommonEditableElements(page) {
    const commonElements = [
        { selector: 'h1', type: 'text', description: 'Main Heading' },
        { selector: 'h2', type: 'text', description: 'Section Headings' },
        { selector: 'p', type: 'html', description: 'Paragraphs' },
        { selector: 'a', type: 'link', description: 'Links' },
        { selector: 'img', type: 'image', description: 'Images' }
    ];

    // Page-specific elements
    if (page === 'index.html') {
        return [
            ...commonElements,
            { selector: '.mission-statement', type: 'text', description: 'Mission Statement' },
            { selector: '.hero-content h1', type: 'text', description: 'Hero Title' },
            { selector: '.hero-content p', type: 'html', description: 'Hero Description' },
            { selector: '.two-col-content h2', type: 'text', description: 'Section Titles' }
        ];
    }

    return commonElements;
}

// Backup original content (placeholder)
async function handleGetBackup(req, res) {
    try {
        const { page, selector } = req.query;
        
        // This would store original content before first override
        // For now, return empty
        return res.status(200).json({ originalContent: null });
    } catch (error) {
        console.error('Get Backup Error:', error);
        return res.status(500).json({ message: 'Error getting backup' });
    }
}

async function handleCreateBackup(req, res) {
    try {
        // Store original content before making changes
        // Implementation would depend on your backup strategy
        return res.status(200).json({ message: 'Backup created' });
    } catch (error) {
        console.error('Create Backup Error:', error);
        return res.status(500).json({ message: 'Error creating backup' });
    }
}

// List images from blob storage
async function handleListImages(req, res) {
    try {
        const clean = (v) => (!v || v === "undefined" || v === "null") ? "" : String(v);

        const { page = 1 } = req.query;
        const search = clean(req.query.search);
        const sort   = clean(req.query.sort) || 'newest';
        const pageNum = parseInt(page, 10);
        const limit = parseInt(req.query.perPage || ITEMS_PER_PAGE, 10); // Allow perPage override
        const offset = (pageNum - 1) * limit;

        // Use Vercel Blob list function
        const { blobs } = await list({
            limit : 1000,
            prefix: 'content-images/'          // always the top folder
        });

        // 1) drop any file that *is already* a thumbnail
        let files = blobs.filter(b => !b.pathname.startsWith('content-images/thumbnails/'));

        // 2) search by simple substring on the filename (case-insensitive)
        if (search) {
            files = files.filter(b =>
                b.pathname.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Apply sorting
        switch (sort) {
            case 'oldest':
                files.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
                break;
            case 'name':
                files.sort((a, b) => a.pathname.localeCompare(b.pathname));
                break;
            case 'newest':
            default:
                files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
                break;
        }

        // Apply pagination manually
        const paginatedFiles = files.slice(offset, offset + limit);

        const total = files.length || 0;
        const images = paginatedFiles.map(blob => {
            const thumb = blob.url.replace(
                '/content-images/',
                '/content-images/thumbnails/'
            );
            return {
                name : blob.pathname.split('/').pop(),
                url  : blob.url,
                thumb,                            // always points to companion thumb
                uploadedAt: blob.uploadedAt,
                size: blob.size
            };
        });

        return res.status(200).json({
            images,
            total,
            perPage: ITEMS_PER_PAGE,
            currentPage: pageNum,
            totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
        });

    } catch (error) {
        console.error('List Images Error:', error);
        return res.status(500).json({ message: 'Error listing images' });
    }
}

// Ensure this runs as a Node.js lambda in Vercel
// Section order management functions
async function getOrder(req, res) {
    try {
        const { page } = req.query;
        if (!page) {
            return res.status(400).json({ message: 'page parameter required' });
        }

        console.log('Getting section order for page:', page);
        const doc = await Order.findOne({ page }).lean();

        return res.status(200).json(doc || { page, order: [] });
    } catch (error) {
        console.error('Get Order Error:', error);
        return res.status(500).json({ message: 'Error retrieving section order' });
    }
}

async function setOrder(req, res) {
    try {
        const { targetPage, order } = req.body;

        if (!targetPage || !Array.isArray(order)) {
            return res.status(400).json({
                message: 'targetPage and order array are required'
            });
        }

        console.log('Setting section order for page:', targetPage, 'Order:', order);

        // Validate that order contains only strings (section IDs)
        if (!order.every(id => typeof id === 'string' && id.trim().length > 0)) {
            return res.status(400).json({
                message: 'Order array must contain valid section ID strings'
            });
        }

        const doc = await Order.findOneAndUpdate(
            { page: targetPage },
            {
                order: order.map(id => id.trim()), // Clean whitespace
                updatedAt: new Date()
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log('Section order saved successfully:', doc);
        return res.status(200).json(doc);
    } catch (error) {
        console.error('Set Order Error:', error);
        return res.status(500).json({ message: 'Error saving section order' });
    }
}

module.exports.config = { runtime: 'nodejs18.x' };
