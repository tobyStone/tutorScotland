/**
 * @fileoverview One-time migration script to fix position casing in database
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2025-01-14
 *
 * @description Migrates all lowercase position values to canonical camelCase format
 * - Scans all Section documents in the database
 * - Remaps lowercase dynamicsectionsN to dynamicSectionsN
 * - Remaps legacy top/middle/bottom to new position names
 * - Provides dry-run mode for safety
 *
 * @usage
 * Dry run (preview changes): node scripts/migrate-position-casing.js
 * Apply changes: node scripts/migrate-position-casing.js --apply
 */

const Section = require('../models/Section');
const connectDB = require('../api/connectToDatabase');

// Position normalization map - must match api/sections.js
const POSITION_NORMALIZATION_MAP = {
    'top': 'dynamicSections1',
    'middle': 'dynamicSections3',
    'bottom': 'dynamicSections7',
    'dynamicsectionstop': 'dynamicSections1',
    'dynamicsectionsmiddle': 'dynamicSections3',
    'dynamicsections': 'dynamicSections7',
    // Handle lowercase variants
    'dynamicsections1': 'dynamicSections1',
    'dynamicsections2': 'dynamicSections2',
    'dynamicsections3': 'dynamicSections3',
    'dynamicsections4': 'dynamicSections4',
    'dynamicsections5': 'dynamicSections5',
    'dynamicsections6': 'dynamicSections6',
    'dynamicsections7': 'dynamicSections7'
};

const VALID_POSITIONS = [
    'dynamicSections1',
    'dynamicSections2',
    'dynamicSections3',
    'dynamicSections4',
    'dynamicSections5',
    'dynamicSections6',
    'dynamicSections7'
];

/**
 * Normalize position value to canonical camelCase format
 */
function normalizePosition(position) {
    if (!position || typeof position !== 'string') {
        return 'dynamicSections7';
    }

    const trimmed = position.trim();
    
    // Already canonical
    if (VALID_POSITIONS.includes(trimmed)) {
        return trimmed;
    }

    // Try normalization map
    const lowercase = trimmed.toLowerCase();
    if (POSITION_NORMALIZATION_MAP[lowercase]) {
        return POSITION_NORMALIZATION_MAP[lowercase];
    }

    // Default fallback
    return 'dynamicSections7';
}

/**
 * Main migration function
 */
async function migratePositionCasing() {
    const isDryRun = !process.argv.includes('--apply');
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Position Casing Migration Script                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made to the database');
        console.log('   Run with --apply flag to apply changes');
    } else {
        console.log('⚠️  APPLY MODE - Changes will be written to the database');
    }
    console.log('');

    try {
        // Connect to database
        console.log('📡 Connecting to database...');
        await connectDB();
        console.log('✅ Connected to database');
        console.log('');

        // Find all sections
        console.log('🔍 Scanning all sections...');
        const allSections = await Section.find({}).lean();
        console.log(`📊 Found ${allSections.length} total sections`);
        console.log('');

        // Analyze sections that need migration
        const sectionsToMigrate = [];
        const positionStats = {};

        for (const section of allSections) {
            const currentPosition = section.position || 'undefined';
            const normalizedPosition = normalizePosition(currentPosition);

            // Track statistics
            if (!positionStats[currentPosition]) {
                positionStats[currentPosition] = 0;
            }
            positionStats[currentPosition]++;

            // Check if migration needed
            if (currentPosition !== normalizedPosition) {
                sectionsToMigrate.push({
                    _id: section._id,
                    page: section.page,
                    heading: section.heading,
                    currentPosition,
                    normalizedPosition
                });
            }
        }

        // Display statistics
        console.log('📊 Current Position Distribution:');
        console.log('─────────────────────────────────────────────────────────────');
        Object.entries(positionStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([pos, count]) => {
                const needsMigration = pos !== normalizePosition(pos);
                const marker = needsMigration ? '⚠️ ' : '✅ ';
                console.log(`${marker} ${pos.padEnd(25)} : ${count} sections`);
            });
        console.log('');

        // Display sections that need migration
        if (sectionsToMigrate.length === 0) {
            console.log('✅ No sections need migration - all positions are already canonical!');
            return;
        }

        console.log(`⚠️  ${sectionsToMigrate.length} sections need migration:`);
        console.log('─────────────────────────────────────────────────────────────');
        
        sectionsToMigrate.forEach((section, index) => {
            console.log(`${index + 1}. [${section.page}] "${section.heading}"`);
            console.log(`   ${section.currentPosition} → ${section.normalizedPosition}`);
        });
        console.log('');

        // Apply migrations if not dry run
        if (!isDryRun) {
            console.log('🔄 Applying migrations...');
            let successCount = 0;
            let errorCount = 0;

            for (const section of sectionsToMigrate) {
                try {
                    await Section.updateOne(
                        { _id: section._id },
                        { $set: { position: section.normalizedPosition } }
                    );
                    successCount++;
                    console.log(`✅ Migrated: [${section.page}] "${section.heading}"`);
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Failed: [${section.page}] "${section.heading}"`, error.message);
                }
            }

            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`✅ Successfully migrated: ${successCount} sections`);
            if (errorCount > 0) {
                console.log(`❌ Failed: ${errorCount} sections`);
            }
            console.log('═══════════════════════════════════════════════════════════');
        } else {
            console.log('💡 To apply these changes, run:');
            console.log('   node scripts/migrate-position-casing.js --apply');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        process.exit(0);
    }
}

// Run migration
migratePositionCasing();

