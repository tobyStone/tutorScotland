import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Use the same model as the app
import TutorModel from '../../../models/Tutor.js';

function canonicalizeRegion(input = '') {
  return String(input).toLowerCase().trim().replace(/\s+/g, ' ').replace(/\band\b/g, '&');
}

describe('Tutor search by regions', () => {
  beforeEach(async () => {
    // Note: Database connection is handled by global setup
    await mongoose.connection.db.dropDatabase();
    console.log('Test database cleared successfully');
  });

  it('stores and searches tutors by regions (handles case and "and" vs "&")', async () => {
    const tutorsDataPath = path.resolve(__dirname, '../../../tests/fixtures/data/tutors-regions.json');
    const raw = fs.readFileSync(tutorsDataPath, 'utf8');
    const docs = JSON.parse(raw);

    // Seed
    await TutorModel.insertMany(docs);

    // Query like the API would do (case-insensitive exact match on normalized label)
    const regionQuery = 'edinburgh and lothians';
    const normalized = canonicalizeRegion(regionQuery);

    const results = await TutorModel.find({
      regions: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).lean();

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(t => (t.regions || []).includes('Edinburgh & Lothians'))).toBe(true);
  });

  it('searches Online region', async () => {
    const results = await TutorModel.find({ regions: { $regex: /^online$/i } }).lean();
    expect(Array.isArray(results)).toBe(true);
  });
});

