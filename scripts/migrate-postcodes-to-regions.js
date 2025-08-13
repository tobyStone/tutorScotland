// scripts/migrate-postcodes-to-regions.js
// One-off migration: derive regions[] from existing postcodes[] for all tutors
// Safe to run multiple times (idempotent). Does not remove postcodes field.

const path = require('path');
const mongoose = require('mongoose');
const connectToDatabase = require('../api/connectToDatabase');

function normalize(str = '') {
  return String(str || '').trim();
}

// Region list (keep in sync with UI and API expectations)
const REGIONS = [
  'Aberdeen & Aberdeenshire',
  'Dundee & Angus',
  'Fife',
  'Perth & Kinross',
  'Edinburgh & Lothians',
  'Glasgow & West',
  'Stirling & Falkirk',
  'Lanarkshire',
  'Ayrshire',
  'Dumfries & Galloway',
  'Scottish Borders',
  'Highlands',
  'Moray',
  'Argyll & Bute',
  'Orkney',
  'Shetland',
  'Western Isles',
  'Caithness & Sutherland',
  'Online'
];

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function mapPostcodeToRegion(raw) {
  if (!raw) return null;
  const s = normalize(raw).toUpperCase();

  // Online passthrough
  if (s === 'ONLINE') return 'Online';

  // Try to detect Orkney KW15..KW17 (common Orkney outward codes)
  if (/^KW1[5-7]/.test(s)) return 'Orkney';

  // Extract leading letters for area code (G, EH, AB, etc.)
  const lettersMatch = s.match(/^[A-Z]{1,2}/);
  const letters = lettersMatch ? lettersMatch[0] : '';

  switch (letters) {
    case 'AB':
      return 'Aberdeen & Aberdeenshire';
    case 'DD':
      return 'Dundee & Angus';
    case 'KY':
      return 'Fife';
    case 'PH':
      // Broadly map PH to Perth & Kinross
      return 'Perth & Kinross';
    case 'EH':
      return 'Edinburgh & Lothians';
    case 'G':
      return 'Glasgow & West';
    case 'FK':
      return 'Stirling & Falkirk';
    case 'ML':
      return 'Lanarkshire';
    case 'KA':
      return 'Ayrshire';
    case 'DG':
      return 'Dumfries & Galloway';
    case 'TD':
      return 'Scottish Borders';
    case 'IV':
      return 'Highlands';
    case 'HS':
      return 'Western Isles';
    case 'KW':
      // Defaults to Caithness & Sutherland when not KW15-17
      return 'Caithness & Sutherland';
    case 'ZE':
      return 'Shetland';
    case 'PA':
      return 'Argyll & Bute';
    default:
      return null; // unknown prefix – skip
  }
}

function deriveRegionsFromPostcodes(postcodes = []) {
  const regions = [];
  for (const pc of Array.isArray(postcodes) ? postcodes : [postcodes]) {
    const mapped = mapPostcodeToRegion(pc);
    if (mapped) regions.push(mapped);
  }
  return uniq(regions);
}

async function run() {
  try {
    await connectToDatabase();
    const col = mongoose.connection.db.collection('tutors');

    const cursor = col.find({}, { projection: { _id: 1, postcodes: 1, regions: 1 } });
    let updatedCount = 0;
    let total = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      total++;

      const existingRegions = Array.isArray(doc.regions) ? doc.regions.filter(Boolean) : [];
      const derived = deriveRegionsFromPostcodes(doc.postcodes || []);

      // Merge existing + derived, ensure unique
      const merged = uniq([...(existingRegions || []), ...derived]);

      // If "Online" appears in postcodes and not yet included, add it
      const hadOnline = (Array.isArray(doc.postcodes) ? doc.postcodes : []).some(p => String(p).trim().toLowerCase() === 'online');
      if (hadOnline && !merged.includes('Online')) merged.push('Online');

      // If nothing to update, skip
      if (!merged.length) continue;

      // Optional: Constrain to known regions only
      const sanitized = merged.filter(r => REGIONS.includes(r));

      // Skip if equal to existing
      if (JSON.stringify(existingRegions.sort()) === JSON.stringify(sanitized.slice().sort())) continue;

      await col.updateOne({ _id: doc._id }, { $set: { regions: sanitized } });
      updatedCount++;
    }

    console.log(`Migration complete. Tutors scanned: ${total}, tutors updated: ${updatedCount}`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
}

if (require.main === module) {
  run();
}

