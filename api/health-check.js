/**
 * Health check endpoint to diagnose production issues
 */
const connectDB = require('./connectToDatabase');
const Section = require('../models/Section');

module.exports = async (req, res) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        nodeVersion: process.version,
        checks: {}
    };

    try {
        // 1. Database Connection Test
        try {
            await connectDB();
            diagnostics.checks.database = { status: 'connected', message: 'Database connection successful' };
        } catch (error) {
            diagnostics.checks.database = { status: 'failed', error: error.message };
        }

        // 2. Model Loading Test
        try {
            const modelTest = new Section({ page: 'test', heading: 'test', text: 'test' });
            diagnostics.checks.model = { status: 'loaded', message: 'Section model loaded successfully' };
        } catch (error) {
            diagnostics.checks.model = { status: 'failed', error: error.message };
        }

        // 3. Database Query Test
        try {
            const count = await Section.countDocuments();
            diagnostics.checks.query = { status: 'success', count, message: `Found ${count} sections in database` };
        } catch (error) {
            diagnostics.checks.query = { status: 'failed', error: error.message };
        }

        // 4. Schema Validation Test
        try {
            const sampleSection = await Section.findOne().lean();
            if (sampleSection) {
                diagnostics.checks.schema = { 
                    status: 'found', 
                    hasLayout: 'layout' in sampleSection,
                    layoutValue: sampleSection.layout,
                    sampleFields: Object.keys(sampleSection)
                };
            } else {
                diagnostics.checks.schema = { status: 'no_data', message: 'No sections found to test schema' };
            }
        } catch (error) {
            diagnostics.checks.schema = { status: 'failed', error: error.message };
        }

        // 5. Environment Variables Test
        diagnostics.checks.env = {
            hasMongoUsername: !!process.env.MONGODB_USERNAME,
            hasMongoPassword: !!process.env.MONGODB_PASSWORD,
            hasVercelBlob: !!process.env.BLOB_READ_WRITE_TOKEN
        };

        return res.status(200).json(diagnostics);
    } catch (error) {
        diagnostics.checks.general = { status: 'failed', error: error.message, stack: error.stack };
        return res.status(500).json(diagnostics);
    }
};

module.exports.config = { runtime: 'nodejs18.x' };
