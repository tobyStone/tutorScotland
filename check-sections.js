const connectDB = require('./api/connectToDatabase');
const Section = require('./models/Section');

async function checkSections() {
  try {
    await connectDB();
    
    console.log('=== ALL SECTIONS FOR INDEX PAGE ===');
    const allSections = await Section.find({ page: 'index' }).lean();
    console.log('Total sections found:', allSections.length);
    allSections.forEach(s => {
      console.log(`- ${s.heading || 'No heading'} | isContentOverride: ${s.isContentOverride} | isFullPage: ${s.isFullPage} | isPublished: ${s.isPublished}`);
    });
    
    console.log('\n=== CONTENT OVERRIDES ===');
    const overrides = await Section.find({ isContentOverride: true }).lean();
    console.log('Total content overrides:', overrides.length);
    overrides.forEach(o => {
      console.log(`- ${o.heading || 'No heading'} | targetPage: ${o.targetPage} | targetSelector: ${o.targetSelector}`);
    });
    
    console.log('\n=== SECTIONS THAT SHOULD SHOW ON INDEX ===');
    const validSections = await Section.find({
      page: 'index',
      isFullPage: { $ne: true },
      isContentOverride: { $ne: true }
    }).lean();
    console.log('Valid sections for index:', validSections.length);
    validSections.forEach(s => {
      console.log(`- ${s.heading || 'No heading'} | position: ${s.position}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSections();
