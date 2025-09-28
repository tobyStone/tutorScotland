/**
 * @fileoverview Fix script to convert content overrides back to regular dynamic sections
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2025-01-01
 * 
 * @description This script identifies content overrides that should be regular sections
 * and converts them back to proper dynamic sections. This fixes the issue where
 * sections moved between pages were incorrectly created as content overrides.
 */

const connectToDatabase = require('./api/connectToDatabase');
const Section = require('./models/Section');

/**
 * Convert content overrides back to regular dynamic sections
 */
async function fixContentOverridesToSections() {
    try {
        console.log('🔧 Starting content override to section conversion...');
        console.log('📡 Connecting to database...');

        await connectToDatabase();
        console.log('✅ Database connected successfully');
        
        // Find content overrides that look like they should be regular sections
        const contentOverrides = await Section.find({
            isContentOverride: true,
            text: { $exists: true, $ne: '' },
            $or: [
                { text: { $regex: /.{50,}/ } }, // Substantial content (50+ chars)
                { buttonLabel: { $exists: true, $ne: '' } }, // Has button
                { image: { $exists: true, $ne: '' } } // Has image
            ]
        });
        
        console.log(`📋 Found ${contentOverrides.length} content overrides to analyze`);
        
        let convertedCount = 0;
        
        for (const override of contentOverrides) {
            console.log(`\n🔍 Analyzing override: ${override._id}`);
            console.log(`   Target Page: ${override.targetPage}`);
            console.log(`   Content: ${override.text?.substring(0, 100)}...`);
            console.log(`   Has Button: ${!!override.buttonLabel}`);
            console.log(`   Has Image: ${!!override.image}`);
            
            // Check if this looks like a section that was moved between pages
            const shouldConvert = (
                override.text && override.text.length > 50 && // Substantial content
                override.targetPage && // Has target page
                (override.buttonLabel || override.image || override.text.length > 200) // Has additional content
            );
            
            if (shouldConvert) {
                console.log(`   ✅ Converting to regular section...`);
                
                // Convert to regular section
                const updateData = {
                    // Set as regular section
                    isContentOverride: false,
                    page: override.targetPage, // Use targetPage as the page
                    layout: 'standard',
                    position: 'bottom', // Default position
                    isPublished: true,
                    
                    // Clear override-specific fields
                    $unset: {
                        targetPage: 1,
                        targetSelector: 1,
                        contentType: 1,
                        overrideType: 1,
                        isButton: 1,
                        originalContent: 1,
                        isActive: 1
                    }
                };
                
                await Section.findByIdAndUpdate(override._id, updateData);
                convertedCount++;
                
                console.log(`   ✅ Converted successfully!`);
            } else {
                console.log(`   ⏭️  Skipping (doesn't meet conversion criteria)`);
            }
        }
        
        console.log(`\n🎉 Conversion complete!`);
        console.log(`   📊 Analyzed: ${contentOverrides.length} overrides`);
        console.log(`   ✅ Converted: ${convertedCount} to regular sections`);
        console.log(`   ⏭️  Skipped: ${contentOverrides.length - convertedCount} overrides`);
        
        if (convertedCount > 0) {
            console.log(`\n📝 Next steps:`);
            console.log(`   1. Refresh your admin dashboard`);
            console.log(`   2. Check the "Existing sections" table for your converted sections`);
            console.log(`   3. Visit the target pages to see the sections appear`);
        }
        
    } catch (error) {
        console.error('❌ Error during conversion:', error);
        throw error;
    }
}

// Run the fix if called directly
if (require.main === module) {
    fixContentOverridesToSections()
        .then(() => {
            console.log('✅ Fix completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Fix failed:', error);
            process.exit(1);
        });
}

module.exports = { fixContentOverridesToSections };
