#!/usr/bin/env node

/**
 * Database Slug Index Fix Script
 * 
 * This script fixes the slug index issue by:
 * 1. Cleaning up existing problematic slug values
 * 2. Dropping and recreating the slug index properly
 * 3. Ensuring sparse index works correctly
 * 
 * Usage: node scripts/fix-slug-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Import models
const Section = require('../models/Section');

// Use the same connection logic as the API
const connectToDatabase = require('../api/connectToDatabase');

async function fixSlugIndex() {
    console.log('🔧 Starting slug index fix...');
    
    try {
        // Connect to database
        await connectToDatabase();
        console.log('✅ Connected to database');

        // Get the sections collection directly
        const db = mongoose.connection.db;
        const sectionsCollection = db.collection('sections');

        console.log('\n📊 Analyzing current slug data...');

        // Check current slug values
        const slugStats = await sectionsCollection.aggregate([
            {
                $group: {
                    _id: "$slug",
                    count: { $sum: 1 },
                    examples: { $push: { _id: "$_id", page: "$page", heading: "$heading", isFullPage: "$isFullPage" } }
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        console.log('Current slug distribution:');
        slugStats.forEach(stat => {
            console.log(`  "${stat._id}": ${stat.count} documents`);
            if (stat.count > 1) {
                console.log(`    ⚠️  DUPLICATE! Examples:`, stat.examples.slice(0, 3));
            }
        });

        // Get raw documents to see what's actually there
        const problematicDocs = await sectionsCollection.find({
            _id: { $in: [
                new mongoose.Types.ObjectId('6886a2c6983a8b78a4c0edf8'),
                new mongoose.Types.ObjectId('688bf7af778320c9372c3a3f')
            ]}
        }).toArray();

        console.log('\nRaw problematic documents:');
        problematicDocs.forEach(doc => {
            console.log(`  Document ${doc._id}:`);
            console.log(`    slug: ${JSON.stringify(doc.slug)} (type: ${typeof doc.slug})`);
            console.log(`    isFullPage: ${doc.isFullPage}`);
            console.log(`    page: ${doc.page}`);
        });

        console.log('\n🧹 Cleaning up problematic slug values...');

        // Step 1: Remove empty string slugs from standard sections
        const emptyStringUpdate = await sectionsCollection.updateMany(
            { 
                slug: '', 
                $or: [
                    { isFullPage: { $ne: true } },
                    { isFullPage: { $exists: false } }
                ]
            },
            { $unset: { slug: 1 } }
        );
        console.log(`  ✅ Removed empty string slugs from ${emptyStringUpdate.modifiedCount} standard sections`);

        // Step 2: Remove null slugs from standard sections
        const nullUpdate = await sectionsCollection.updateMany(
            {
                slug: null,
                $or: [
                    { isFullPage: { $ne: true } },
                    { isFullPage: { $exists: false } }
                ]
            },
            { $unset: { slug: 1 } }
        );
        console.log(`  ✅ Removed null slugs from ${nullUpdate.modifiedCount} standard sections`);

        // Step 2b: Remove ALL null slug fields (including those that might be causing issues)
        const allNullUpdate = await sectionsCollection.updateMany(
            { slug: null },
            { $unset: { slug: 1 } }
        );
        console.log(`  ✅ Removed ALL null slug fields from ${allNullUpdate.modifiedCount} documents`);

        // Step 2c: Remove string "null" slugs (from logging/debugging)
        const stringNullUpdate = await sectionsCollection.updateMany(
            { slug: "null" },
            { $unset: { slug: 1 } }
        );
        console.log(`  ✅ Removed string "null" slug fields from ${stringNullUpdate.modifiedCount} documents`);

        // Step 2d: Force remove slug field from all standard sections
        const forceRemoveUpdate = await sectionsCollection.updateMany(
            {
                $or: [
                    { isFullPage: { $ne: true } },
                    { isFullPage: { $exists: false } }
                ]
            },
            { $unset: { slug: 1 } }
        );
        console.log(`  ✅ Force removed slug field from ${forceRemoveUpdate.modifiedCount} standard sections`);

        // Step 2e: Direct fix for the specific problematic documents
        const directFix1 = await sectionsCollection.updateOne(
            { _id: new mongoose.Types.ObjectId('6886a2c6983a8b78a4c0edf8') },
            { $unset: { slug: 1 } }
        );
        const directFix2 = await sectionsCollection.updateOne(
            { _id: new mongoose.Types.ObjectId('688bf7af778320c9372c3a3f') },
            { $unset: { slug: 1 } }
        );
        console.log(`  ✅ Direct fix applied to ${directFix1.modifiedCount + directFix2.modifiedCount} specific documents`);

        // Step 3: Check for any remaining duplicate slugs
        const remainingDuplicates = await sectionsCollection.aggregate([
            { $match: { slug: { $exists: true } } },
            {
                $group: {
                    _id: "$slug",
                    count: { $sum: 1 },
                    docs: { $push: { _id: "$_id", page: "$page", isFullPage: "$isFullPage" } }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (remainingDuplicates.length > 0) {
            console.log('\n⚠️  Found remaining duplicate slugs:');
            for (const dup of remainingDuplicates) {
                console.log(`  Slug "${dup._id}": ${dup.count} documents`);
                
                // Keep the first full page, remove slug from others
                const fullPages = dup.docs.filter(doc => doc.isFullPage === true);
                const nonFullPages = dup.docs.filter(doc => doc.isFullPage !== true);
                
                if (fullPages.length > 1) {
                    // Multiple full pages with same slug - keep the first one
                    const toKeep = fullPages[0];
                    const toFix = fullPages.slice(1);
                    console.log(`    Keeping full page ${toKeep._id}, fixing ${toFix.length} others`);
                    
                    for (const doc of toFix) {
                        await sectionsCollection.updateOne(
                            { _id: doc._id },
                            { $set: { slug: `${dup._id}-${doc._id.toString().slice(-6)}` } }
                        );
                    }
                }
                
                // Remove slug from non-full pages
                if (nonFullPages.length > 0) {
                    console.log(`    Removing slug from ${nonFullPages.length} non-full pages`);
                    await sectionsCollection.updateMany(
                        { _id: { $in: nonFullPages.map(doc => doc._id) } },
                        { $unset: { slug: 1 } }
                    );
                }
            }
        }

        console.log('\n🗂️  Recreating slug index...');

        // Step 4: Drop existing slug index if it exists
        try {
            await sectionsCollection.dropIndex('slug_1');
            console.log('  ✅ Dropped existing slug index');
        } catch (error) {
            if (error.code === 27) {
                console.log('  ℹ️  No existing slug index to drop');
            } else {
                console.log('  ⚠️  Error dropping index:', error.message);
            }
        }

        // Step 5: Create new sparse unique index
        await sectionsCollection.createIndex(
            { slug: 1 }, 
            { 
                unique: true, 
                sparse: true,
                name: 'slug_1'
            }
        );
        console.log('  ✅ Created new sparse unique slug index');

        console.log('\n📊 Final verification...');
        
        // Verify the fix worked
        const finalStats = await sectionsCollection.aggregate([
            {
                $group: {
                    _id: "$slug",
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (finalStats.length === 0) {
            console.log('  ✅ No duplicate slugs found - fix successful!');
        } else {
            console.log('  ❌ Still have duplicates:', finalStats);
        }

        // Show index info
        const indexes = await sectionsCollection.indexes();
        const slugIndex = indexes.find(idx => idx.name === 'slug_1');
        if (slugIndex) {
            console.log('  ✅ Slug index configuration:', {
                unique: slugIndex.unique,
                sparse: slugIndex.sparse,
                key: slugIndex.key
            });
        }

        console.log('\n🎉 Slug index fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from database');
    }
}

// Run the fix
if (require.main === module) {
    fixSlugIndex()
        .then(() => {
            console.log('\n✅ All done! You can now create multiple dynamic sections.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Fix failed:', error);
            process.exit(1);
        });
}

module.exports = fixSlugIndex;
