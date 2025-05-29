const connectDB = require('./connectToDatabase');
const Section = require('../models/Section');

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
            overrideType = 'replace'
        } = req.body;

        if (!targetPage || !targetSelector || !contentType) {
            return res.status(400).json({ 
                message: 'targetPage, targetSelector, and contentType are required' 
            });
        }

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
            existingOverride.contentType = contentType;
            existingOverride.overrideType = overrideType;
            existingOverride.isActive = true;
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
                contentType,
                heading,
                text,
                image,
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

// Ensure this runs as a Node.js lambda in Vercel
module.exports.config = { runtime: 'nodejs18.x' };
