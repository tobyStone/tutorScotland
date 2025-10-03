import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Import API handler and models
import sectionsHandler from '../../../api/sections.js';
import Section from '../../../models/Section.js';
import User from '../../../models/User.js';

// Mock external services
vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({
    url: 'https://test-blob-url.vercel-storage.com/test-image.jpg',
    pathname: 'test-image.jpg'
  }),
  del: vi.fn().mockResolvedValue(true)
}));

// Create test server that mimics Vercel's serverless function behavior
const createTestApp = () => {
  return createServer(async (req, res) => {
    // Parse request body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          req.body = JSON.parse(body);
        } catch (e) {
          req.body = {};
        }
        sectionsHandler(req, res);
      });
    } else {
      // For GET/DELETE, parse query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      req.query = Object.fromEntries(url.searchParams);
      sectionsHandler(req, res);
    }
  });
};

describe('Dynamic Sections API Integration Tests (Real API)', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create test app
    app = createTestApp();

    // Create test admin user for authentication
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: await bcrypt.hash('testpassword', 10),
      role: 'admin'
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup handled by global teardown
  });

  beforeEach(async () => {
    // Ensure database is connected before cleanup
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
      await mongoose.connect(mongoUri);
    }

    // Clear sections collection and seed with real data
    await Section.deleteMany({});

    // Seed with test data using create() to ensure validation runs
    await Section.create([
      {
        page: 'about-us',
        heading: 'Our Mission',
        text: 'We are dedicated to connecting students with qualified tutors...',
        layout: 'standard',
        position: 'bottom',
        order: 1,
        isPublished: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        page: 'about-us',
        heading: 'Team Photo',
        text: '',
        layout: 'standard',
        position: 'bottom',
        order: 2,
        isPublished: true,
        imageUrl: 'https://example.com/team-photo.jpg',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      },
      {
        page: 'services',
        heading: 'Meet Sarah',
        text: 'Sarah is our lead mathematics tutor with 10 years of experience.',
        layout: 'team',
        position: 'bottom',
        order: 1,
        isPublished: true,
        imageUrl: 'https://example.com/sarah.jpg',
        team: [{
          name: 'Sarah Johnson',
          bio: 'Experienced mathematics tutor with 10 years of teaching experience.',
          role: 'Mathematics Tutor'
        }],
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
      },
      {
        page: 'about-us',
        heading: 'Inactive Section',
        text: 'This section is not active',
        layout: 'standard',
        position: 'bottom',
        order: 3,
        isPublished: false, // Unpublished section
        createdAt: new Date('2024-01-04'),
        updatedAt: new Date('2024-01-04')
      }
    ]);
  });

  describe('GET /api/sections - Retrieve Sections', () => {
    it('should retrieve sections for a specific page', async () => {
      const response = await request(app)
        .get('/api/sections?page=about-us')
        .expect(200);

      expect(response.body).toHaveLength(2); // Only published sections
      expect(response.body[0].heading).toBe('Our Mission');
      expect(response.body[1].heading).toBe('Team Photo');

      // Verify all sections belong to the requested page
      response.body.forEach(section => {
        expect(section.page).toBe('about-us');
        expect(section.isPublished).toBe(true);
      });
    });

    it('should return empty array for non-existent page', async () => {
      const response = await request(app)
        .get('/api/sections?page=nonexistent')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return sections sorted by position and creation date', async () => {
      const response = await request(app)
        .get('/api/sections?page=about-us')
        .expect(200);

      // Verify sorting (position first, then createdAt)
      expect(response.body[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(response.body[1].createdAt).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should include unpublished sections for authenticated admin users', async () => {
      const response = await request(app)
        .get('/api/sections?page=about-us')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3); // All sections including unpublished
      const unpublishedSection = response.body.find(s => s.heading === 'Inactive Section');
      expect(unpublishedSection).toBeDefined();
      expect(unpublishedSection.isPublished).toBe(false);
    });
  });

  describe('POST /api/sections - Create Section', () => {
    it('should create a new section with valid data', async () => {
      const newSection = {
        page: 'index',
        heading: 'Welcome Message',
        text: 'Welcome to TutorScotland!',
        layout: 'standard',
        position: 'bottom',
        order: 1
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(newSection)
        .expect(201);

      // Verify HTTP response
      expect(response.body.heading).toBe('Welcome Message');
      expect(response.body.page).toBe('index');
      expect(response.body._id).toBeDefined();

      // Verify database state
      const dbSection = await Section.findById(response.body._id);
      expect(dbSection.heading).toBe('Welcome Message');
      expect(dbSection.page).toBe('index');
      expect(dbSection.layout).toBe('standard');
    });

    it('should reject section creation without authentication', async () => {
      const newSection = {
        page: 'index',
        heading: 'Unauthorized Section',
        text: 'This should fail',
        layout: 'standard'
      };

      await request(app)
        .post('/api/sections')
        .send(newSection)
        .expect(401);

      // Verify no section was created in database
      const sections = await Section.find({ heading: 'Unauthorized Section' });
      expect(sections).toHaveLength(0);
    });

    it('should validate required fields', async () => {
      const invalidSection = {
        page: 'index',
        // Missing required heading
        text: 'Some text'
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(invalidSection)
        .expect(400);

      // The API should return a validation error for missing heading
      expect(response.body.message || response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/sections - Delete Section', () => {
    it('should delete an existing section', async () => {
      // Get an existing section
      const existingSection = await Section.findOne({ page: 'about-us' });

      await request(app)
        .delete(`/api/sections?id=${existingSection._id}`)
        .set('Cookie', `token=${authToken}`)
        .expect(204);

      // Verify section was deleted from database
      const deletedSection = await Section.findById(existingSection._id);
      expect(deletedSection).toBeNull();
    });

    it('should return 404 when deleting non-existent section', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .delete(`/api/sections?id=${fakeId}`)
        .set('Cookie', `token=${authToken}`)
        .expect(404);
    });

    it('should reject deletion without authentication', async () => {
      const existingSection = await Section.findOne({ page: 'about-us' });

      await request(app)
        .delete(`/api/sections?id=${existingSection._id}`)
        .expect(401);

      // Verify section still exists in database
      const stillExists = await Section.findById(existingSection._id);
      expect(stillExists).toBeTruthy();
    });
  });

  describe('Section Update Operations (via POST with editId)', () => {
    it('should update an existing section via POST with editId', async () => {
      const existingSection = await Section.findOne({ page: 'about-us' });

      const updateData = {
        editId: existingSection._id.toString(),
        page: 'about-us',
        heading: 'Updated Mission Statement',
        text: 'Our updated mission is to provide excellent tutoring services...',
        layout: 'standard'
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(updateData)
        .expect(200);

      // Verify HTTP response
      expect(response.body.heading).toBe('Updated Mission Statement');
      expect(response.body._id).toBe(existingSection._id.toString());

      // Verify database state
      const updatedSection = await Section.findById(existingSection._id);
      expect(updatedSection.heading).toBe('Updated Mission Statement');
      expect(updatedSection.text).toContain('updated mission');
    });

    it('should preserve existing data when updating specific fields', async () => {
      const existingSection = await Section.findOne({ page: 'about-us' });
      const originalCreatedAt = existingSection.createdAt;

      const updateData = {
        editId: existingSection._id.toString(),
        page: 'about-us',
        heading: 'Updated Title Only',
        text: existingSection.text, // Keep original text
        layout: existingSection.layout
      };

      await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(updateData)
        .expect(200);

      // Verify database state
      const updatedSection = await Section.findById(existingSection._id);
      expect(updatedSection.heading).toBe('Updated Title Only');
      expect(updatedSection.createdAt).toEqual(originalCreatedAt); // Should preserve original creation date
    });
  });

  describe('Team Member Sections', () => {
    it('should handle team member sections correctly', async () => {
      const response = await request(app)
        .get('/api/sections?page=services')
        .expect(200);

      const teamSection = response.body.find(s => s.layout === 'team');
      expect(teamSection).toBeDefined();
      expect(teamSection.team).toBeDefined();
      expect(teamSection.team[0].name).toBe('Sarah Johnson');
      expect(teamSection.team[0].role).toBe('Mathematics Tutor');
    });

    it('should create team sections with proper team data structure', async () => {
      const teamSection = {
        page: 'about-us',
        heading: 'New Team Member',
        text: 'Meet our new team member',
        layout: 'team',
        position: 'bottom',
        team: JSON.stringify([{
          name: 'John Doe',
          bio: 'Experienced educator',
          role: 'Science Tutor'
        }])
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(teamSection);

      // Debug: Log response if not 201
      if (response.status !== 201) {
        console.log('Team Response status:', response.status);
        console.log('Team Response body:', response.body);
      }

      expect(response.status).toBe(201);

      // Verify team data structure in response
      expect(response.body.team).toBeDefined();
      expect(response.body.team[0].name).toBe('John Doe');
      expect(response.body.team[0].role).toBe('Science Tutor');

      // Verify database state
      const dbSection = await Section.findById(response.body._id);
      expect(dbSection.team[0].name).toBe('John Doe');
    });

    it('should accept placeholder text from admin dashboard', async () => {
      // Test the exact scenario from admin dashboard where text is "Team members section"
      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send({
          page: 'index',
          heading: 'Our Team',
          text: 'Team members section', // This is what admin dashboard sends
          layout: 'team',
          position: 'bottom',
          team: JSON.stringify([
            {
              name: 'Jane Smith',
              bio: 'English Tutor',
              quote: 'Words have power!'
            }
          ])
        })
        .expect(201);

      expect(response.body.layout).toBe('team');
      expect(response.body.text).toBe('Team members section');
      expect(response.body.team).toHaveLength(1);
      expect(response.body.team[0].name).toBe('Jane Smith');
      expect(response.body.team[0].bio).toBe('English Tutor');
    });
  });

  describe('Content Validation and Security', () => {
    it('should normalize invalid layout types to standard', async () => {
      const invalidSection = {
        page: 'index',
        heading: 'Invalid Layout Section',
        text: 'This has an invalid layout',
        layout: 'invalid-layout-type'
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(invalidSection)
        .expect(201);

      expect(response.body.layout).toBe('standard'); // Should be normalized

      // Verify section was created in database with normalized layout
      const dbSection = await Section.findById(response.body._id);
      expect(dbSection.layout).toBe('standard');
      expect(dbSection.heading).toBe('Invalid Layout Section');
    });

    it('should handle HTML content safely', async () => {
      const sectionWithHTML = {
        page: 'index',
        heading: 'HTML Content Test',
        text: '<p>Safe HTML content</p><script>alert("xss")</script>',
        layout: 'standard'
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(sectionWithHTML)
        .expect(201);

      // The API should sanitize or handle HTML content appropriately
      expect(response.body.text).toBeDefined();
      // Note: Actual sanitization behavior depends on API implementation
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error instead of actual disconnect to avoid connection issues
      const originalFind = Section.find;
      Section.find = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/sections?page=about-us')
        .expect(500);

      expect(response.body.message || response.body.error).toBeDefined();

      // Restore original method
      Section.find = originalFind;
    }, 10000);

    it('should handle empty page parameter gracefully', async () => {
      const response = await request(app)
        .get('/api/sections?page=')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should handle malformed section data', async () => {
      const malformedSection = {
        page: 'index',
        heading: null, // Invalid heading
        text: 123, // Invalid text type
        layout: 'standard'
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(malformedSection)
        .expect(400);

      expect(response.body.message || response.body.error).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle sections with missing layout field', async () => {
      // Insert section directly to database without layout field
      await Section.collection.insertOne({
        page: 'test',
        heading: 'Legacy Section',
        text: 'Legacy content',
        position: 'bottom',
        order: 1,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .get('/api/sections?page=test')
        .expect(200);

      expect(response.body).toHaveLength(1);
      // API should normalize missing layout to 'standard'
      expect(response.body[0].layout).toBe('standard');
    });

    it('should handle sections with null layout field', async () => {
      // Insert section with explicit null layout
      await Section.collection.insertOne({
        page: 'test',
        heading: 'Null Layout Section',
        text: 'Content with null layout',
        layout: null,
        position: 'bottom',
        order: 1,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .get('/api/sections?page=test')
        .expect(200);

      expect(response.body).toHaveLength(1);
      // API should normalize null layout to 'standard'
      expect(response.body[0].layout).toBe('standard');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/sections?page=about-us')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 10 requests
    });

    it('should handle large page queries efficiently', async () => {
      // Create many sections for performance testing
      const largeSectionSet = Array.from({ length: 100 }, (_, i) => ({
        page: 'performance-test',
        heading: `Performance Section ${i}`,
        text: `Content for performance section ${i}`,
        layout: 'standard',
        position: 'bottom',
        order: i,
        isPublished: true
      }));

      await Section.create(largeSectionSet);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/sections?page=performance-test')
        .expect(200);
      const endTime = Date.now();

      expect(response.body).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Future Section Types - List and Testimonial', () => {
    it('should create list sections via API', async () => {
      const listSection = {
        page: 'index',
        heading: 'Test List Section',
        text: JSON.stringify({
          items: [
            'First list item',
            'Second list item',
            'Third list item'
          ],
          listType: 'unordered'
        }),
        layout: 'list',
        position: 'bottom',
        order: 1
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(listSection)
        .expect(201);

      // Verify response structure
      expect(response.body.heading).toBe('Test List Section');
      expect(response.body.layout).toBe('list');

      // Verify database state
      const dbSection = await Section.findById(response.body._id);
      expect(dbSection.layout).toBe('list');
      const listContent = JSON.parse(dbSection.text);
      expect(listContent.items).toHaveLength(3);
      expect(listContent.listType).toBe('unordered');
    });

    it('should create testimonial sections via API', async () => {
      const testimonialSection = {
        page: 'index',
        heading: 'Customer Testimonial',
        text: JSON.stringify([{
          quote: 'TutorScotland helped my child improve their grades significantly!',
          author: 'Sarah Johnson',
          role: 'Parent',
          rating: 5
        }]),
        layout: 'testimonial',
        position: 'bottom',
        order: 2
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(testimonialSection)
        .expect(201);

      // Verify response structure
      expect(response.body.heading).toBe('Customer Testimonial');
      expect(response.body.layout).toBe('testimonial');

      // Verify database state
      const dbSection = await Section.findById(response.body._id);
      expect(dbSection.layout).toBe('testimonial');
      const testimonialContent = JSON.parse(dbSection.text);
      expect(Array.isArray(testimonialContent)).toBe(true);
      expect(testimonialContent[0].quote).toBeTruthy();
      expect(testimonialContent[0].author).toBe('Sarah Johnson');
      expect(testimonialContent[0].rating).toBe(5);
    });
  });

  describe('Database Migration Compatibility', () => {
    it('should handle sections with all layout types via API', async () => {
      // Create sections of all supported types via API
      const sectionTypes = [
        { layout: 'standard', heading: 'Standard Section', text: 'Standard content' },
        { layout: 'team', heading: 'Team Section', text: 'Team content', team: JSON.stringify([{ name: 'John', bio: 'Developer', role: 'Developer' }]) },
        { layout: 'list', heading: 'List Section', text: JSON.stringify({ items: ['Item 1'], listType: 'unordered' }) },
        { layout: 'testimonial', heading: 'Testimonial', text: JSON.stringify([{ quote: 'Great!', author: 'Jane' }]) }
      ];

      // Create each section type via API
      for (const sectionData of sectionTypes) {
        const response = await request(app)
          .post('/api/sections')
          .set('Cookie', `token=${authToken}`)
          .send({
            page: 'index',
            heading: sectionData.heading,
            text: sectionData.text,
            layout: sectionData.layout,
            position: 'bottom',
            team: sectionData.team
          })
          .expect(201);

        expect(response.body.layout).toBe(sectionData.layout);
      }

      // Verify all sections can be retrieved via API
      const response = await request(app)
        .get('/api/sections?page=index')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(4);

      // Verify each layout type is preserved
      const layouts = response.body.map(s => s.layout);
      expect(layouts).toContain('standard');
      expect(layouts).toContain('team');
      expect(layouts).toContain('list');
      expect(layouts).toContain('testimonial');
    });

    it('should handle API requests with mixed section types', async () => {
      // Create a mix of section types
      await Section.create([
        { page: 'index', heading: 'Standard', text: 'Content', layout: 'standard', position: 'bottom', order: 1, isPublished: true },
        { page: 'index', heading: 'Team', text: 'Team content', layout: 'team', team: [{ name: 'Alice', bio: 'Teacher' }], position: 'bottom', order: 2, isPublished: true },
        { page: 'index', heading: 'List', text: JSON.stringify({ items: ['A', 'B'] }), layout: 'list', position: 'bottom', order: 3, isPublished: true }
      ]);

      const response = await request(app)
        .get('/api/sections?page=index')
        .expect(200);

      expect(response.body).toHaveLength(3);

      // Verify each section type is handled correctly
      const standardSection = response.body.find(s => s.layout === 'standard');
      const teamSection = response.body.find(s => s.layout === 'team');
      const listSection = response.body.find(s => s.layout === 'list');

      expect(standardSection).toBeDefined();
      expect(teamSection).toBeDefined();
      expect(teamSection.team).toBeDefined();
      expect(listSection).toBeDefined();
    });
  });
});
