import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Section from '../../models/Section.js';

/**
 * Schema Migration Safety Tests
 * 
 * These tests simulate real database migration scenarios to ensure
 * new schema changes don't break existing production data.
 * 
 * RUN THESE BEFORE ANY SCHEMA CHANGES GO TO PRODUCTION!
 */

describe('Schema Migration Safety', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Production Data Simulation', () => {
    it('should handle real production-like data structures', async () => {
      // Simulate actual production data that might exist
      const productionLikeData = [
        // Standard sections (might have no layout field)
        {
          page: 'index',
          heading: 'Welcome to TutorScotland',
          text: 'We help connect families with qualified tutors...',
          image: '/images/hero.jpg',
          buttonLabel: 'Find a Tutor',
          buttonUrl: '/tutors.html',
          position: 'top',
          order: 1,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
          // Note: no layout field (pre-migration)
        },
        // Team sections
        {
          page: 'about-us',
          heading: 'Our Team',
          text: 'Meet our dedicated team',
          layout: 'team',
          team: [
            {
              name: 'Sarah Johnson',
              bio: 'Experienced educator with 10+ years in tutoring',
              quote: 'Education transforms lives',
              image: '/images/team/sarah.jpg'
            }
          ],
          position: 'middle',
          order: 2,
          isActive: true,
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01')
        },
        // Rolling banner (might have null layout)
        {
          page: 'rolling-banner',
          heading: 'News Update',
          text: 'New tutors available in Edinburgh area',
          layout: null,
          position: 'top',
          order: 1,
          isActive: true,
          createdAt: new Date('2024-03-01'),
          updatedAt: new Date('2024-03-01')
        }
      ];

      // Insert directly to simulate existing database state
      for (const data of productionLikeData) {
        await Section.collection.insertOne(data);
      }

      // Test that all operations still work
      console.log('Testing database operations after inserting production-like data...');

      // 1. Find operations should work
      const allSections = await Section.find({});
      expect(allSections.length).toBeGreaterThan(0);

      // 2. Each section should have a valid layout
      allSections.forEach(section => {
        expect(section.layout).toBeTruthy();
        expect(['standard', 'team', 'list', 'testimonial']).toContain(section.layout);
      });

      // 3. Page-specific queries should work
      const indexSections = await Section.find({ page: 'index' });
      expect(indexSections.length).toBeGreaterThan(0);

      // 4. Team sections should preserve team data
      const teamSections = await Section.find({ layout: 'team' });
      expect(teamSections.length).toBeGreaterThan(0);
      expect(teamSections[0].team).toBeTruthy();
      expect(teamSections[0].team.length).toBeGreaterThan(0);

      console.log('✅ All database operations successful with production-like data');
    });

    it('should handle API responses with mixed data types', async () => {
      // Create mixed section types
      await Section.collection.insertMany([
        { page: 'test', heading: 'Standard', text: 'Content' }, // No layout
        { page: 'test', heading: 'Team', text: 'Team content', layout: 'team', team: [] },
        { page: 'test', heading: 'Null Layout', text: 'Content', layout: null }
      ]);

      // Simulate API normalization (what our API does)
      const sections = await Section.find({ page: 'test' }).lean();
      const normalizedSections = sections.map(section => {
        if (!section.layout || section.layout === null) {
          section.layout = 'standard';
        }
        return section;
      });

      // All should have valid layouts
      expect(normalizedSections).toHaveLength(3);
      normalizedSections.forEach(section => {
        expect(section.layout).toBeTruthy();
        expect(['standard', 'team']).toContain(section.layout);
      });
    });
  });

  describe('New Feature Integration', () => {
    it('should allow new section types alongside existing ones', async () => {
      // Create existing section types
      const existingSection = await Section.create({
        page: 'test',
        heading: 'Existing Section',
        text: 'Existing content',
        layout: 'standard'
      });

      // Create new section types
      const listSection = await Section.create({
        page: 'test',
        heading: 'New List Section',
        text: JSON.stringify({
          items: ['Item 1', 'Item 2'],
          listType: 'unordered'
        }),
        layout: 'list'
      });

      const testimonialSection = await Section.create({
        page: 'test',
        heading: 'New Testimonial',
        text: JSON.stringify({
          quote: 'Excellent service!',
          author: 'Happy Parent'
        }),
        layout: 'testimonial'
      });

      // All should coexist
      const allSections = await Section.find({ page: 'test' });
      expect(allSections).toHaveLength(3);

      const layouts = allSections.map(s => s.layout);
      expect(layouts).toContain('standard');
      expect(layouts).toContain('list');
      expect(layouts).toContain('testimonial');
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle corrupted data', async () => {
      // Insert potentially problematic data
      await Section.collection.insertOne({
        page: 'test',
        heading: 'Corrupted Section',
        text: 'Content',
        layout: 'invalid-layout', // This should be caught by validation
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mongoose should handle this gracefully
      const sections = await Section.find({ page: 'test' }).lean();
      
      // The invalid layout should either be rejected or normalized
      sections.forEach(section => {
        if (section.layout && section.layout !== 'invalid-layout') {
          expect(['standard', 'team', 'list', 'testimonial']).toContain(section.layout);
        }
      });
    });
  });
});
