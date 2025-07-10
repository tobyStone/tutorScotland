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

            console.log('DEBUG: Page API called with slug:', slug);
            console.log('DEBUG: Full query params:', req.query);

            if (!slug) {
                console.log('DEBUG: No slug provided');
                return res.status(400).json({ message: 'Slug parameter is required' });
            }

            try {
                console.log('DEBUG: Searching for page with criteria:', {
                    isFullPage: true,
                    slug: slug,
                    isPublished: true
                });

                const page = await Section.findOne({
                    isFullPage: true,
                    slug: slug,
                    isPublished: true
                }).lean();

                console.log('DEBUG: Database query result:', page ? 'Found page' : 'No page found');
                if (page) {
                    console.log('DEBUG: Page data:', {
                        id: page._id,
                        heading: page.heading,
                        slug: page.slug,
                        isPublished: page.isPublished,
                        isFullPage: page.isFullPage
                    });
                }

                if (!page) {
                    // Let's also check if there are any pages with this slug but different criteria
                    const anyPageWithSlug = await Section.findOne({ slug: slug }).lean();
                    console.log('DEBUG: Any page with this slug (ignoring other criteria):', anyPageWithSlug ? 'Found' : 'Not found');
                    if (anyPageWithSlug) {
                        console.log('DEBUG: Found page but criteria mismatch:', {
                            isFullPage: anyPageWithSlug.isFullPage,
                            isPublished: anyPageWithSlug.isPublished
                        });
                    }

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
