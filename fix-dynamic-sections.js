const connectDB = require('./api/connectToDatabase');
const Section = require('./models/Section');

async function fixDynamicSections() {
  try {
    await connectDB();
    console.log('Connected to database...');
    
    // Find sections that might be incorrectly marked as content overrides
    // but should be regular dynamic sections
    const suspiciousSections = await Section.find({
      page: 'index',
      isContentOverride: true,
      $or: [
        { targetPage: { $exists: false } },
        { targetSelector: { $exists: false } },
        { targetPage: null },
        { targetSelector: null },
        { targetPage: '' },
        { targetSelector: '' }
      ]
    }).lean();
    
    console.log(`Found ${suspiciousSections.length} sections that might be incorrectly marked as content overrides:`);
    
    if (suspiciousSections.length > 0) {
      suspiciousSections.forEach(s => {
        console.log(`- "${s.heading}" (ID: ${s._id})`);
        console.log(`  targetPage: ${s.targetPage}, targetSelector: ${s.targetSelector}`);
      });
      
      console.log('\nFixing these sections...');
      
      // Fix them by setting isContentOverride to false
      const result = await Section.updateMany(
        {
          page: 'index',
          isContentOverride: true,
          $or: [
            { targetPage: { $exists: false } },
            { targetSelector: { $exists: false } },
            { targetPage: null },
            { targetSelector: null },
            { targetPage: '' },
            { targetSelector: '' }
          ]
        },
        {
          $set: { isContentOverride: false },
          $unset: { targetPage: '', targetSelector: '', contentType: '', overrideType: '', isButton: '', originalContent: '', isActive: '' }
        }
      );
      
      console.log(`Fixed ${result.modifiedCount} sections`);
    }
    
    // Now check what sections should be visible
    console.log('\n=== SECTIONS THAT SHOULD NOW BE VISIBLE ON INDEX ===');
    const validSections = await Section.find({
      page: 'index',
      isFullPage: { $ne: true },
      isContentOverride: { $ne: true }
    }).sort({ position: 1, createdAt: 1 }).lean();
    
    console.log(`Found ${validSections.length} valid sections for index page:`);
    validSections.forEach(s => {
      console.log(`- "${s.heading}" | position: ${s.position} | published: ${s.isPublished !== false}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDynamicSections();
