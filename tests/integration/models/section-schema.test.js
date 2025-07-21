import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Section from '../../../models/Section.js';

/**
 * Schema Validation Tests
 * 
 * These tests ensure that database schema changes don't break existing data.
 * This is critical for backward compatibility when adding new features.
 */

describe('Section Schema Validation & Backward Compatibility', () => {
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

  beforeEach(async () => {
    await Section.deleteMany({});
  });

  describe('Layout Field Validation', () => {
    it('should accept valid layout values', async () => {
      const validLayouts = ['standard', 'team', 'list', 'testimonial'];
      
      for (const layout of validLayouts) {
        const section = new Section({
          page: 'test',
          heading: 'Test Section',
          text: 'Test content',
          layout: layout
        });
        
        await expect(section.save()).resolves.toBeTruthy();
        expect(section.layout).toBe(layout);
      }
    });

    it('should reject invalid layout values', async () => {
      const section = new Section({
        page: 'test',
        heading: 'Test Section',
        text: 'Test content',
        layout: 'invalid-layout'
      });
      
      await expect(section.save()).rejects.toThrow();
    });

    it('should handle null/undefined layout values (backward compatibility)', async () => {
      // Test null layout
      const sectionWithNull = new Section({
        page: 'test',
        heading: 'Test Section',
        text: 'Test content',
        layout: null
      });
      
      await expect(sectionWithNull.save()).resolves.toBeTruthy();
      
      // Test undefined layout (default should apply)
      const sectionWithoutLayout = new Section({
        page: 'test',
        heading: 'Test Section 2',
        text: 'Test content'
      });
      
      await expect(sectionWithoutLayout.save()).resolves.toBeTruthy();
      expect(sectionWithoutLayout.layout).toBe('standard');
    });

    it('should handle existing records with no layout field', async () => {
      // Simulate existing database record without layout field
      const existingRecord = await Section.collection.insertOne({
        page: 'test',
        heading: 'Legacy Section',
        text: 'Legacy content',
        createdAt: new Date(),
        updatedAt: new Date()
        // Note: no layout field
      });

      // Retrieve using Mongoose (should not throw error)
      const retrieved = await Section.findById(existingRecord.insertedId);
      expect(retrieved).toBeTruthy();
      expect(retrieved.layout).toBe('standard'); // Should get default
    });
  });

  describe('New Section Type Data Structures', () => {
    it('should handle list section data structure', async () => {
      const listSection = new Section({
        page: 'test',
        heading: 'Test List',
        text: JSON.stringify({
          items: ['Item 1', 'Item 2', 'Item 3'],
          listType: 'unordered',
          description: 'Test description'
        }),
        layout: 'list'
      });

      await expect(listSection.save()).resolves.toBeTruthy();
      
      const parsed = JSON.parse(listSection.text);
      expect(parsed.items).toHaveLength(3);
      expect(parsed.listType).toBe('unordered');
    });

    it('should handle testimonial section data structure', async () => {
      const testimonialSection = new Section({
        page: 'test',
        heading: 'Test Testimonial',
        text: JSON.stringify({
          quote: 'Great service!',
          author: 'John Doe',
          role: 'Parent',
          company: 'Edinburgh',
          rating: 5
        }),
        layout: 'testimonial'
      });

      await expect(testimonialSection.save()).resolves.toBeTruthy();
      
      const parsed = JSON.parse(testimonialSection.text);
      expect(parsed.quote).toBe('Great service!');
      expect(parsed.author).toBe('John Doe');
      expect(parsed.rating).toBe(5);
    });
  });

  describe('API Backward Compatibility', () => {
    it('should normalize layout field in API responses', async () => {
      // Create a record with null layout directly in database
      await Section.collection.insertOne({
        page: 'test',
        heading: 'Legacy Section',
        text: 'Legacy content',
        layout: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Simulate API normalization
      const sections = await Section.find({ page: 'test' }).lean();
      const normalizedSections = sections.map(section => {
        if (!section.layout || section.layout === null) {
          section.layout = 'standard';
        }
        return section;
      });

      expect(normalizedSections).toHaveLength(1);
      expect(normalizedSections[0].layout).toBe('standard');
    });
  });

  describe('Migration Safety', () => {
    it('should not break when querying existing records after schema changes', async () => {
      // Create records that simulate pre-migration state
      const legacyRecords = [
        { page: 'index', heading: 'Old Section 1', text: 'Content 1' },
        { page: 'index', heading: 'Old Section 2', text: 'Content 2', layout: null },
        { page: 'about', heading: 'Team Section', text: 'Team content', layout: 'team' }
      ];

      for (const record of legacyRecords) {
        await Section.collection.insertOne({
          ...record,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // This should not throw errors
      const allSections = await Section.find({});
      expect(allSections).toHaveLength(3);

      // All should have valid layout values
      allSections.forEach(section => {
        expect(['standard', 'team', 'list', 'testimonial']).toContain(section.layout);
      });
    });
  });
});
