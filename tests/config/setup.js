import { vi } from 'vitest';
import { setupTestDB, teardownTestDB, clearTestDB } from './test-db.js';
import './mocks.js';

// Global test setup
beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  vi.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  createTestUser: async (role = 'admin') => {
    const User = require('../../models/user.js');
    const bcrypt = require('bcryptjs');
    
    return await User.create({
      name: `Test ${role}`,
      email: `test-${role}@tutorscotland.test`,
      password: await bcrypt.hash('testpassword123', 10),
      role
    });
  },
  
  generateJWT: (payload) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  },
  
  createTestTutor: async (overrides = {}) => {
    const Tutor = require('../../models/tutor.js');
    
    return await Tutor.create({
      name: 'Test Tutor',
      subjects: ['Mathematics'],
      costRange: '__P____P__',
      badges: ['Qualified Teacher'],
      description: 'Experienced test tutor',
      postcodes: ['EH1'],
      contact: 'test@tutor.com',
      imagePath: 'https://example.com/test-image.jpg',
      ...overrides
    });
  },
  
  createTestBlog: async (overrides = {}) => {
    const Blog = require('../../models/Blog.js');
    
    return await Blog.create({
      title: 'Test Blog Post',
      author: 'Test Author',
      content: 'This is test blog content',
      excerpt: 'Test excerpt',
      category: ['parent'],
      status: 'published',
      publishDate: new Date(),
      ...overrides
    });
  },
  
  createTestSection: async (overrides = {}) => {
    const Section = require('../../models/Section.js');
    
    return await Section.create({
      page: 'index',
      heading: 'Test Section',
      text: 'Test section content',
      order: 1,
      position: 'bottom',
      ...overrides
    });
  }
};
