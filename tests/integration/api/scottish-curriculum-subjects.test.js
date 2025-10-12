/**
 * @fileoverview Integration tests for Scottish curriculum subjects API
 * @description Tests subject filtering and search functionality via HTTP requests with in-memory database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createServer } from 'http';
import createVercelCompatibleResponse from '../../utils/createVercelCompatibleResponse.js';

// Import the API handler
import tutorsHandler from '../../../api/tutors.js';

// Create HTTP server for testing
function createTestServer() {
  return createServer((req, res) => {
    // Add Vercel-compatible response helpers
    createVercelCompatibleResponse(res);
    
    // Parse URL and query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    req.query = Object.fromEntries(url.searchParams);
    
    // Call the handler
    tutorsHandler(req, res);
  });
}

describe('Scottish Curriculum Subjects Integration Tests', () => {
  let mongoServer;
  let testTutors;
  let Tutor;
  let testServer;

  beforeAll(async () => {
    // Disconnect any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory database
    await mongoose.connect(mongoUri);
    console.log('Test database connected successfully');

    // Create HTTP test server
    testServer = createTestServer();
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('Test database torn down successfully');
  });

  beforeEach(async () => {
    // Get or create Tutor model
    try {
      Tutor = mongoose.model('Tutor');
    } catch (error) {
      // Create a simple schema for testing if model doesn't exist
      const tutorSchema = new mongoose.Schema({
        name: String,
        subjects: [String],
        costRange: String,
        badges: [String],
        contact: String,
        description: String,
        regions: [String],
        imagePath: String
      });
      Tutor = mongoose.model('Tutor', tutorSchema);
    }

    // Clear database and seed with test data
    await Tutor.deleteMany({});

    // Create test tutors with Scottish curriculum subjects
    testTutors = [
      {
        name: 'John MacDonald',
        subjects: ['mathematics', 'sciences'],
        costRange: '£20-25',
        badges: ['Qualified Teacher', 'PVG Checked'],
        contact: 'john@example.com',
        description: 'Experienced maths and science tutor',
        regions: ['Edinburgh & Lothians'],
        imagePath: '/images/tutor1.jpg'
      },
      {
        name: 'Sarah Campbell',
        subjects: ['english', 'expressive arts'],
        costRange: '£25-30',
        badges: ['Qualified Teacher'],
        contact: 'sarah@example.com',
        description: 'English and arts specialist',
        regions: ['Glasgow & West'],
        imagePath: '/images/tutor2.jpg'
      },
      {
        name: 'Mike Stewart',
        subjects: ['technologies', 'computing'],
        costRange: '£30-35',
        badges: ['Industry Expert', 'PVG Checked'],
        contact: 'mike@example.com',
        description: 'Technology and computing tutor',
        regions: ['Aberdeen & Aberdeenshire'],
        imagePath: '/images/tutor3.jpg'
      },
      {
        name: 'Emma Fraser',
        subjects: ['social studies', 'history'],
        costRange: '£15-20',
        badges: ['Qualified Teacher', 'History Specialist'],
        contact: 'emma@example.com',
        description: 'Social studies and history expert',
        regions: ['Fife'],
        imagePath: '/images/tutor4.jpg'
      },
      {
        name: 'David Wilson',
        subjects: ['languages', 'french'],
        costRange: '£25-30',
        badges: ['Native Speaker', 'PVG Checked'],
        contact: 'david@example.com',
        description: 'Modern languages specialist',
        regions: ['Edinburgh & Lothians'],
        imagePath: '/images/tutor5.jpg'
      },
      {
        name: 'Lisa Brown',
        subjects: ['health and wellbeing', 'pe'],
        costRange: '£20-25',
        badges: ['Sports Coach', 'First Aid Certified'],
        contact: 'lisa@example.com',
        description: 'Health and wellbeing tutor',
        regions: ['Glasgow & West'],
        imagePath: '/images/tutor6.jpg'
      },
      {
        name: 'Robert Anderson',
        subjects: ['religious and moral education', 'philosophy'],
        costRange: '£25-30',
        badges: ['Qualified Teacher', 'Philosophy Degree'],
        contact: 'robert@example.com',
        description: 'RME and philosophy tutor',
        regions: ['Perth & Kinross'],
        imagePath: '/images/tutor7.jpg'
      },
      {
        name: 'Jennifer Taylor',
        subjects: ['custom subject', 'special needs'],
        costRange: '£30-35',
        badges: ['Special Needs Specialist', 'PVG Checked'],
        contact: 'jennifer@example.com',
        description: 'Specialist in custom and special needs tutoring',
        regions: ['Stirling & Falkirk'],
        imagePath: '/images/tutor8.jpg'
      }
    ];

    await Tutor.insertMany(testTutors);
  });

  afterEach(async () => {
    // Clean up test data
    await Tutor.deleteMany({});
  });

  describe('Scottish Curriculum Subject Search', () => {
    it('should find tutors by mathematics subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=mathematics&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('John MacDonald');
      expect(response.body[0].subjects).toContain('mathematics');
    });

    it('should find tutors by sciences subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=sciences&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('sciences');
    });

    it('should find tutors by english subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=english&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('english');
    });

    it('should find tutors by technologies subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=technologies&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('technologies');
    });

    it('should find tutors by social studies subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=social studies&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('social studies');
    });

    it('should find tutors by languages subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=languages&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('languages');
    });

    it('should find tutors by health and wellbeing subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=health and wellbeing&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('health and wellbeing');
    });

    it('should find tutors by religious and moral education subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=religious and moral education&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('religious and moral education');
    });

    it('should find tutors by expressive arts subject', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=expressive arts&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('expressive arts');
    });
  });

  describe('Subject Synonym Matching', () => {
    it('should find mathematics tutors when searching for "maths"', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=maths&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('mathematics');
    });

    it('should find sciences tutors when searching for "biology"', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=biology&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('sciences');
    });

    it('should find languages tutors when searching for "french"', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=french&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('languages');
    });

    it('should find technologies tutors when searching for "computing"', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=computing&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('technologies');
    });
  });

  describe('Custom "Other" Subject Search', () => {
    it('should find tutors with custom subjects', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=custom subject&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('custom subject');
    });

    it('should handle case-insensitive custom subject search', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=CUSTOM SUBJECT&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].subjects).toContain('custom subject');
    });
  });

  describe('Input Validation and Security', () => {
    it('should reject subjects with invalid characters', async () => {
      await request(testServer)
        .get('/api/tutors?subject=<script>alert("xss")</script>&format=json')
        .expect(400);
    });

    it('should reject subjects that are too long', async () => {
      const longSubject = 'a'.repeat(101);
      await request(testServer)
        .get(`/api/tutors?subject=${longSubject}&format=json`)
        .expect(400);
    });

    it('should handle empty subject parameter gracefully', async () => {
      const response = await request(testServer)
        .get('/api/tutors?subject=&format=json')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(8); // Should return all tutors
    });
  });
});
