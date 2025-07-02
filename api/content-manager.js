const connectDB = require('./connectToDatabase');
const Section = require('../models/Section');
const Order = require('../models/Order');
const { list } = require('@vercel/blob');

const ITEMS_PER_PAGE = 20;

/**
 * RECOMMENDED: Create a compound unique index in MongoDB to prevent duplicate overrides:
 *
 * db.sections.createIndex(
 *   { targetPage: 1, targetSelector: 1 },
 *   { unique: true, partialFilterExpression: { isContentOverride: true } }
 * );
 *
 * This protects against race conditions when multiple editors save the same element.
 */

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

            // Debug sections (show all sections with their types)
            if (operation === 'debug-sections') {
                return handleDebugSections(req, res);
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
        }).sort({ createdAt: 1 }).lean();

        console.log(`[handleGetOverrides] Found ${overrides.length} overrides for page "${page}"`);
        overrides.forEach((ov, i) => {
            console.log(`[handleGetOverrides] Override ${i}: selector="${ov.targetSelector}" (length: ${ov.targetSelector?.length})`);
        });

        return res.status(200).json(overrides);
    } catch (error) {
        console.error('Get Overrides Error:', error);
        return res.status(500).json({ message: 'Error fetching overrides' });
    }
}


/* ------------------------------------------------------------------ *
 *  handleCreateOrUpdateOverride                                       *
 *  � called for POST ?operation=override                              *
 *    � WITHOUT  ?id  ? create new override                            *
 *    � WITH     ?id  ? update existing override                       *
 * ------------------------------------------------------------------ */
async function handleCreateOverride(req, res) {
    try {
        const { id } = req.query; // Present on UPDATE
        const {
            targetPage,
            targetSelector,
            contentType,
            text,
            image, // For images
            href,  // For links
            isButton, // For link styling
            originalContent,
            overrideType = 'replace',
        } = req.body;

        // Enhanced debugging
        console.log('[handleCreateOverride] Full request body:', JSON.stringify(req.body, null, 2));
        console.log('[handleCreateOverride] Query params:', req.query);

        if (!targetSelector || (!id && (!targetPage || !contentType))) {
            console.log('[handleCreateOverride] Validation failed:', {
                targetSelector: !!targetSelector,
                id: !!id,
                targetPage: !!targetPage,
                contentType: !!contentType
            });
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        /* ----------------------------- *
         * 2) UPDATE (id present)        *
         * ----------------------------- */
        if (id) {
            console.log('[handleOverride] UPDATE ?', id);

            // Explicitly define the fields that are allowed to be updated.
            // CRITICAL: We DO NOT include originalContent here to make it immutable.
            const updateData = {
                text,
                image: image || href, // Use href for links, image for images
                isButton,
                targetSelector, // Still allow selector migration if needed
                updatedAt: new Date()
            };

            // Remove any undefined properties so we don't overwrite fields with null.
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            const updated = await Section.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true } // Return the modified document
            ).lean();

            if (!updated) {
                return res.status(404).json({ message: `Override ${id} not found` });
            }
            return res.status(200).json(updated);
        }

        /* ----------------------------- *
         * 3) CREATE (no id)             *
         * ----------------------------- */
        console.log('[handleOverride] CREATE ?', targetSelector);

        // This de-duplication is a failsafe; a new element should have a new selector.
        let doc = await Section.findOne({
            targetPage,
            targetSelector,
            isContentOverride: true,
        });

        if (doc) {
            console.log('[handleOverride] De-duplication: Found existing doc, updating it.');
            doc.text = text ?? doc.text;
            doc.image = (image || href) ?? doc.image;
            doc.isButton = isButton ?? doc.isButton;
            // Do NOT touch originalContent
            doc.updatedAt = new Date();
            await doc.save();
            return res.status(200).json(doc.toObject());
        }

        // Truly new document, save originalContent for the first and only time.
        doc = new Section({
            page: targetPage,
            targetPage,
            targetSelector,
            contentType,
            text,
            image: image || href,
            isButton,
            originalContent, // Saved only on creation
            overrideType,
            isContentOverride: true,
            isActive: true,
            isPublished: true,
        });

        await doc.save();
        return res.status(201).json(doc.toObject());

    } catch (err) {
        console.error('handleOverride error:', err);
        console.error('handleOverride error stack:', err.stack);
        console.error('handleOverride request body:', JSON.stringify(req.body, null, 2));
        return res.status(500).json({ message: 'Error saving override', error: err.message });
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

// Delete content override
async function handleDeleteOverride(req, res) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ message: 'ID parameter required' });
        }

        console.log('Deleting content override with ID:', id);

        const deleted = await Section.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ message: 'Override not found' });
        }

        console.log('Successfully deleted override:', deleted.targetSelector);
        return res.status(204).end();
    } catch (error) {
        console.error('Delete Override Error:', error);
        return res.status(500).json({ message: 'Error deleting override' });
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
        const folderRaw = clean(req.query.folder) || 'content-images';
        const prefix = folderRaw.endsWith('/') ? folderRaw : `${folderRaw}/`;
        
        const { blobs } = await list({ limit: 1000, prefix });

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

        // Get list of existing thumbnails for fallback detection
        const { blobs: thumbBlobs } = await list({ limit: 1000, prefix: `${prefix}thumbnails/` });
        const existingThumbs = new Set(thumbBlobs.map(b => b.pathname));

        const images = paginatedFiles.map(blob => {
            const thumbPath = blob.pathname.replace(`${prefix}`, `${prefix}thumbnails/`);
            const thumb = blob.url.replace(`${prefix}`, `${prefix}thumbnails/`);
            const hasThumb = existingThumbs.has(thumbPath);

            return {
                name : blob.pathname.split('/').pop(),
                url  : blob.url,
                thumb: hasThumb ? thumb : blob.url,  // Use original if no thumbnail
                uploadedAt: blob.uploadedAt,
                size: blob.size,
                hasThumb                             // Flag for client-side logic
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

// Debug function to show all sections with their classification
async function handleDebugSections(req, res) {
    try {
        await connectDB();

        // Get all sections from the database
        const allSections = await Section.find({}).lean();

        // Classify sections
        const classified = allSections.map(section => ({
            _id: section._id,
            page: section.page,
            heading: section.heading,
            text: section.text?.substring(0, 100) + (section.text?.length > 100 ? '...' : ''),
            isContentOverride: !!section.isContentOverride,
            isFullPage: !!section.isFullPage,
            targetPage: section.targetPage,
            targetSelector: section.targetSelector,
            contentType: section.contentType,
            createdAt: section.createdAt,
            classification: section.isContentOverride ? 'CONTENT_OVERRIDE' :
                          section.isFullPage ? 'FULL_PAGE' : 'DYNAMIC_SECTION'
        }));

        // Group by classification
        const grouped = {
            contentOverrides: classified.filter(s => s.classification === 'CONTENT_OVERRIDE'),
            fullPages: classified.filter(s => s.classification === 'FULL_PAGE'),
            dynamicSections: classified.filter(s => s.classification === 'DYNAMIC_SECTION')
        };

        return res.status(200).json({
            total: allSections.length,
            breakdown: {
                contentOverrides: grouped.contentOverrides.length,
                fullPages: grouped.fullPages.length,
                dynamicSections: grouped.dynamicSections.length
            },
            sections: grouped
        });

    } catch (error) {
        console.error('Debug Sections Error:', error);
        return res.status(500).json({ message: 'Error debugging sections' });
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
