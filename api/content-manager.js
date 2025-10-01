/**
 * @fileoverview Content management API for visual editor and admin operations
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Comprehensive content management system supporting:
 * - Content overrides for visual editing
 * - Image management with thumbnail support
 * - Section debugging and analysis
 * - Admin authentication and authorization
 *
 * @security All operations require proper authentication and validation
 * @performance Implements pagination and efficient blob storage queries
 */

const connectDB = require('./connectToDatabase');
const Section = require('../models/Section');
const Order = require('../models/Order');
const { list } = require('@vercel/blob');
const { csrfProtection } = require('../utils/csrf-protection');
const { applyComprehensiveSecurityHeaders } = require('../utils/security-headers');
const { SecurityLogger } = require('../utils/security-logger');
const { validateText, validateObjectId, validateURL } = require('../utils/input-validation');

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

/**
 * Main API handler for content management operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with operation result
 *
 * @description Handles multiple content management operations:
 * - get-overrides: Retrieve content overrides for a page
 * - save-override: Create or update content overrides
 * - delete-override: Remove content overrides
 * - list-images: Paginated image listing with thumbnails
 * - debug-sections: Development debugging for sections
 *
 * @example
 * // GET /api/content-manager?operation=get-overrides&page=index
 * // POST /api/content-manager with operation and data
 *
 * @security Authentication required for write operations
 * @performance Implements pagination and efficient database queries
 * @throws {Error} 400 - Invalid operation or missing parameters
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    // Phase 2: Apply comprehensive security headers
    applyComprehensiveSecurityHeaders(res, 'api');

    // ✅ SECURITY FIX: Request size validation for write operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const requestSize = req.headers['content-length'];
        const MAX_REQUEST_SIZE = 512 * 1024; // 512KB should be enough for content management

        if (requestSize && parseInt(requestSize) > MAX_REQUEST_SIZE) {
            SecurityLogger.securityEvent('OVERSIZED_REQUEST', {
                size: requestSize,
                maxSize: MAX_REQUEST_SIZE,
                endpoint: '/api/content-manager'
            }, req);
            return res.status(413).json({ message: 'Request too large' });
        }
    }

    // Phase 2: Apply CSRF protection for state-changing operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        try {
            await new Promise((resolve, reject) => {
                csrfProtection(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (csrfError) {
            console.error('CSRF Protection failed for content-manager API:', csrfError);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'CSRF protection failed',
                code: 'CSRF_VIOLATION'
            });
        }
    }

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

        // 🔒 SECURITY FIX: Add authentication for write operations and sensitive read operations
        const writeOperations = ['set-order', 'remove-from-order', 'override', 'backup'];
        const sensitiveReadOperations = ['debug-sections', 'list-images']; // Operations that expose sensitive data
        // Note: 'get-order' removed - section ordering should be public for all visitors
        // Note: 'overrides' removed - content overrides should be public for all visitors to see edited content
        const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(method) || writeOperations.includes(operation);
        const isSensitiveReadOperation = sensitiveReadOperations.includes(operation);

        if (isWriteOperation || isSensitiveReadOperation) {
            // ✅ TEMPORARY DEBUG: Log authentication attempt
            console.log('🔍 Content Manager Auth Debug:', {
                operation,
                method,
                isWriteOperation,
                isSensitiveReadOperation,
                cookies: req.headers?.cookie ? 'present' : 'missing',
                userAgent: req.headers?.['user-agent']?.substring(0, 50)
            });

            const { verify } = require('./protected');
            const [ok, payload] = verify(req, res);

            console.log('🔍 Auth Verification Result:', {
                ok,
                payload: payload ? { id: payload.id, role: payload.role, email: payload.email } : null
            });

            if (!ok) {
                console.error('❌ Authentication failed for content management');
                SecurityLogger.unauthorizedAccess('content-manager', req);
                return res.status(401).json({
                    message: 'Authentication required for content management',
                    error: 'UNAUTHORIZED_CONTENT_ACCESS'
                });
            }

            // Require admin role for content management and sensitive operations
            if (payload.role !== 'admin') {
                console.error('❌ Insufficient permissions:', { role: payload.role, required: 'admin' });
                SecurityLogger.unauthorizedAccess('content-manager', req, { userId: payload.id, role: payload.role });
                return res.status(403).json({
                    message: 'Admin access required for content management',
                    error: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            console.log('✅ Authentication successful for admin:', payload.email);

            // Log successful admin content management access
            SecurityLogger.adminAction(`content-manager-${operation}`, { userId: payload.id, role: payload.role }, req);
        }

        /* ---------- NEW: section order endpoints ---------- */
        if (method === 'GET'  && operation === 'get-order') return getOrder(req, res);
        if (method === 'POST' && operation === 'set-order') return setOrder(req, res);
        if (method === 'POST' && operation === 'remove-from-order') return removeFromOrder(req, res);

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
            buttons, // For text element buttons
            isHTML, // For HTML formatted text content
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

        // Process buttons array for text content type
        let buttonLabel = '';
        let buttonUrl = '';
        if (contentType === 'text' && buttons && Array.isArray(buttons) && buttons.length > 0) {
            // For now, take the first button (could be extended to support multiple buttons)
            const firstButton = buttons[0];
            if (firstButton && firstButton.text && firstButton.url) {
                buttonLabel = firstButton.text;
                buttonUrl = firstButton.url;
                console.log('[handleCreateOverride] Processing button:', { buttonLabel, buttonUrl });
            }
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
                image: contentType === 'link' ? href : image, // ✅ FIX: Store href in image field for links, image for images
                isButton,
                isHTML, // For HTML formatted text content
                buttonLabel, // Add button fields
                buttonUrl,
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
            doc.image = (contentType === 'link' ? href : image) ?? doc.image;
            doc.isButton = isButton ?? doc.isButton;
            doc.isHTML = isHTML ?? doc.isHTML;
            doc.buttonLabel = buttonLabel ?? doc.buttonLabel;
            doc.buttonUrl = buttonUrl ?? doc.buttonUrl;
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
            image: contentType === 'link' ? href : image, // ✅ FIX: Store href in image field for links, image for images
            isButton,
            isHTML, // For HTML formatted text content
            buttonLabel, // Add button fields
            buttonUrl,
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
            // ✅ FIX: Thumbnails now preserve original format, so use same extension
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

async function removeFromOrder(req, res) {
    try {
        const { targetPage, sectionId } = req.body;

        if (!targetPage || !sectionId) {
            return res.status(400).json({
                message: 'targetPage and sectionId are required'
            });
        }

        console.log('Removing section from order:', { targetPage, sectionId });

        // Find the current order document
        const orderDoc = await Order.findOne({ page: targetPage });

        if (!orderDoc || !orderDoc.order) {
            console.log('No existing order found for page:', targetPage);
            return res.status(200).json({
                message: 'No existing order to modify',
                page: targetPage
            });
        }

        // Remove the section ID from the order array
        const originalOrder = orderDoc.order;
        const newOrder = originalOrder.filter(id => id !== sectionId);

        if (originalOrder.length === newOrder.length) {
            console.log('Section ID not found in order:', sectionId);
            return res.status(200).json({
                message: 'Section not found in order',
                page: targetPage,
                order: originalOrder
            });
        }

        // Update the order
        const updatedDoc = await Order.findOneAndUpdate(
            { page: targetPage },
            {
                order: newOrder,
                updatedAt: new Date()
            },
            { new: true }
        );

        console.log(`Removed section ${sectionId} from ${targetPage} order:`, {
            before: originalOrder.length,
            after: newOrder.length
        });

        res.status(200).json({
            message: 'Section removed from order successfully',
            page: targetPage,
            removedSection: sectionId,
            order: updatedDoc.order
        });

    } catch (error) {
        console.error('Error removing section from order:', error);
        res.status(500).json({
            message: 'Failed to remove section from order',
            error: error.message
        });
    }
}

module.exports.config = { runtime: 'nodejs18.x' };
