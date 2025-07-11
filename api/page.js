/**
 * /api/page - API endpoint for custom pages
 * Handles fetching page content by slug
 */
const Section = require('../models/Section');
const connectDB = require('./connectToDatabase');

module.exports = async (req, res) => {
    try {
        await connectDB();

        // GET - Fetch a page by slug
        if (req.method === 'GET') {
            const slug = req.query.slug;

            if (!slug) {
                return res.status(400).json({ message: 'Slug parameter is required' });
            }

            try {
                const page = await Section.findOne({
                    isFullPage: true,
                    slug: slug,
                    isPublished: true
                }).lean();

                if (!page) {
                    return res.status(404).json({ message: 'Page not found' });
                }

                return res.status(200).json(page);
            } catch (e) {
                console.error('PAGE_GET error', e);
                return res.status(500).json({
                    message: 'Error retrieving page',
                    error: e.message
                });
            }
        }

        // Fallback
        res.setHeader('Allow', ['GET']);
        return res.status(405).end('Method Not Allowed');
    } catch (error) {
        console.error('Page API error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
