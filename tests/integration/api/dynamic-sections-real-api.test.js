import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { vi } from 'vitest';

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

describe('Dynamic Sections API Integration (Real API Testing)', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Note: Database connection handled by global setup

    // Create test app
    app = createTestApp();

    // Create test admin user for authentication
    const bcrypt = require('bcryptjs');
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: await bcrypt.hash('testpassword', 10),
      role: 'admin'
    });

    // Generate auth token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { userId: testUser._id, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Note: Database cleanup handled by global teardown
  });

  beforeEach(async () => {
    // Clear sections collection
    await Section.deleteMany({});

    // Seed with test data using create() to ensure validation runs
    await Section.create([
      {
        page: 'about',
        heading: 'Our Mission',
        text: 'We are dedicated to connecting students with qualified tutors...',
        layout: 'standard',
        position: 'bottom',
        order: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        page: 'about',
        heading: 'Team Photo',
        text: '',
        layout: 'standard',
        position: 'bottom',
        order: 2,
        imageUrl: 'https://example.com/team-photo.jpg',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      },
      {
        page: 'services',
        heading: 'Meet Sarah',
        text: 'Sarah is our lead mathematics tutor with 10 years of experience.',
        layout: 'team-member',
        position: 'bottom',
        order: 1,
        imageUrl: 'https://example.com/sarah.jpg',
        team: [{
          name: 'Sarah Johnson',
          bio: 'Experienced mathematics tutor with 10 years of teaching experience, specializing in algebra, calculus, and statistics.',
          role: 'Mathematics Tutor',
          experience: '10 years',
          subjects: ['Algebra', 'Calculus', 'Statistics']
        }],
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
      }
    ]);
  });

  describe('GET /api/sections - Retrieve Sections', () => {
    it('should retrieve sections for a specific page', async () => {
      const response = await request(app)
        .get('/api/sections?page=about')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].heading).toBe('Our Mission');
      expect(response.body[1].heading).toBe('Team Photo');
      
      // Verify all sections belong to the requested page
      response.body.forEach(section => {
        expect(section.page).toBe('about');
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
        .get('/api/sections?page=about')
        .expect(200);

      // Verify sorting (position first, then createdAt)
      expect(response.body[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(response.body[1].createdAt).toBe('2024-01-02T00:00:00.000Z');
    });
  });

  describe('POST /api/sections - Create Section', () => {
    it('should create a new section with valid data', async () => {
      const newSection = {
        page: 'home',
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
      expect(response.body.page).toBe('home');
      expect(response.body._id).toBeDefined();

      // Verify database state
      const dbSection = await Section.findById(response.body._id);
      expect(dbSection.heading).toBe('Welcome Message');
      expect(dbSection.page).toBe('home');
      expect(dbSection.layout).toBe('standard');
    });

    it('should reject section creation without authentication', async () => {
      const newSection = {
        page: 'home',
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
        page: 'home',
        // Missing required heading
        text: 'Some text'
      };

      const response = await request(app)
        .post('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(invalidSection)
        .expect(400);

      expect(response.body.message).toContain('required');
    });
  });

  describe('PUT /api/sections - Update Section', () => {
    it('should update an existing section', async () => {
      // Get an existing section
      const existingSection = await Section.findOne({ page: 'about' });
      
      const updateData = {
        _id: existingSection._id.toString(),
        heading: 'Updated Mission Statement',
        text: 'Our updated mission...',
        layout: 'standard'
      };

      const response = await request(app)
        .put('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(updateData)
        .expect(200);

      // Verify HTTP response
      expect(response.body.heading).toBe('Updated Mission Statement');

      // Verify database state
      const updatedSection = await Section.findById(existingSection._id);
      expect(updatedSection.heading).toBe('Updated Mission Statement');
      expect(updatedSection.text).toBe('Our updated mission...');
    });

    it('should return 404 for non-existent section', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const updateData = {
        _id: fakeId.toString(),
        heading: 'Non-existent Section',
        text: 'This should fail'
      };

      await request(app)
        .put('/api/sections')
        .set('Cookie', `token=${authToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/sections - Delete Section', () => {
    it('should delete an existing section', async () => {
      // Get an existing section
      const existingSection = await Section.findOne({ page: 'about' });
      
      await request(app)
        .delete(`/api/sections?id=${existingSection._id}`)
        .set('Cookie', `token=${authToken}`)
        .expect(200);

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
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Temporarily close database connection
      await mongoose.disconnect();
      
      const response = await request(app)
        .get('/api/sections?page=about')
        .expect(500);

      expect(response.body.message).toContain('Error');
      
      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });

    it('should validate page parameter format', async () => {
      await request(app)
        .get('/api/sections?page=')
        .expect(400);
    });
  });

  describe('Team Member Sections', () => {
    it('should handle team member sections correctly', async () => {
      const response = await request(app)
        .get('/api/sections?page=services')
        .expect(200);

      const teamSection = response.body.find(s => s.layout === 'team-member');
      expect(teamSection).toBeDefined();
      expect(teamSection.team).toBeDefined();
      expect(teamSection.team[0].name).toBe('Sarah Johnson');
    });
  });
});
