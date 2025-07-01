#!/usr/bin/env node

/**
 * Migration script to add block IDs to existing sections in the database
 * This ensures that all existing dynamic sections have stable block IDs for visual editor persistence
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Import the Section model and database connection
const Section = require('../models/Section');
const connectDB = require('../api/connectToDatabase');

async function migrateSectionBlockIds() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await connectDB();
        console.log('✅ Connected to MongoDB');

        // Find all sections that don't have block IDs
        const sectionsToUpdate = await Section.find({
            $or: [
                { headingBlockId: { $exists: false } },
                { headingBlockId: '' },
                { contentBlockId: { $exists: false } },
                { contentBlockId: '' }
            ]
        });

        console.log(`📊 Found ${sectionsToUpdate.length} sections that need block IDs`);

        if (sectionsToUpdate.length === 0) {
            console.log('✅ All sections already have block IDs. No migration needed.');
            return;
        }

        let updated = 0;
        for (const section of sectionsToUpdate) {
            const updateData = {};

            // Add heading block ID if missing
            if (!section.headingBlockId) {
                updateData.headingBlockId = uuidv4();
            }

            // Add content block ID if missing
            if (!section.contentBlockId) {
                updateData.contentBlockId = uuidv4();
            }

            // Add image block ID if section has image but no block ID
            if (section.image && !section.imageBlockId) {
                updateData.imageBlockId = uuidv4();
            }

            // Add button block ID if section has button but no block ID
            if (section.buttonLabel && section.buttonUrl && !section.buttonBlockId) {
                updateData.buttonBlockId = uuidv4();
            }

            if (Object.keys(updateData).length > 0) {
                await Section.findByIdAndUpdate(section._id, updateData);
                updated++;
                console.log(`✅ Updated section "${section.heading}" (${section.page}) with block IDs:`, Object.keys(updateData));
            }
        }

        console.log(`🎉 Migration completed! Updated ${updated} sections with block IDs.`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    migrateSectionBlockIds()
        .then(() => {
            console.log('✅ Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateSectionBlockIds };
