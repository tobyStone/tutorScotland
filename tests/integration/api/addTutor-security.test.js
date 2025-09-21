/**
 * @fileoverview Integration tests for addTutor API security
 * @description Tests CSRF protection and security headers for tutor management endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import addTutorHandler from '../../../api/addTutor.js';

// Mock CSRF protection to verify it's called
const mockCsrfProtection = vi.fn();
vi.mock('../../../utils/csrf-protection', () => ({
  csrfProtection: mockCsrfProtection
}));

// Mock security headers to verify they're applied
const mockApplySecurityHeaders = vi.fn();
vi.mock('../../../utils/security-headers', () => ({
  applyComprehensiveSecurityHeaders: mockApplySecurityHeaders
}));

describe('Add Tutor API Security Integration Tests', () => {
  let mongoServer;
  let app;
  let adminToken;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Handle existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
    console.log('Test database connected successfully');

    // Create HTTP server with addTutor handler
    app = createServer((req, res) => {
      // Parse request body for POST/PUT/DELETE requests
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
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
          addTutorHandler(req, res);
        });
      } else {
        addTutorHandler(req, res);
      }
    });

    // Generate admin JWT token for testing
    adminToken = jwt.sign(
      { email: 'admin@test.com', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
    console.log('Test database torn down successfully');
  });

  beforeEach(async () => {
    // Clear database and reset mocks
    await mongoose.connection.db.dropDatabase();
    vi.clearAllMocks();

    // Default mock implementations - CSRF as callback-based middleware
    mockCsrfProtection.mockImplementation((req, res, next) => next());
    mockApplySecurityHeaders.mockImplementation(() => {});
  });

  describe('Security Headers', () => {
    it('should apply comprehensive security headers for all requests', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ name: 'Test Tutor', email: 'tutor@test.com' });

      // Verify security headers function was called
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
    });

    it('should apply security headers even for method not allowed', async () => {
      const response = await request(app)
        .get('/')
        .expect(405);

      // Verify security headers were applied before method check
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSRF Protection', () => {
    it('should enforce CSRF protection for POST requests', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ name: 'Test Tutor', email: 'tutor@test.com' });

      // Verify CSRF protection was called
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should enforce CSRF protection for PUT requests', async () => {
      const response = await request(app)
        .put('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id', name: 'Updated Tutor' });

      // Verify CSRF protection was called
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should enforce CSRF protection for DELETE requests', async () => {
      const response = await request(app)
        .delete('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id' });

      // Verify CSRF protection was called
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when CSRF validation fails', async () => {
      // Mock CSRF failure - callback with error
      mockCsrfProtection.mockImplementation((req, res, next) => {
        next(new Error('Invalid CSRF token'));
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ name: 'Test Tutor' })
        .expect(403);

      expect(response.body).toHaveProperty('message', 'CSRF token validation failed');
      expect(response.body).toHaveProperty('error', 'Invalid CSRF token');
    });
  });

  describe('Method Validation', () => {
    it('should reject GET requests with 405', async () => {
      const response = await request(app)
        .get('/')
        .expect(405);

      expect(response.text).toContain('Method GET Not Allowed');
      
      // Verify security headers were applied
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      
      // Verify CSRF protection was NOT called for rejected method
      expect(mockCsrfProtection).not.toHaveBeenCalled();
    });

    it('should set proper Allow header for unsupported methods', async () => {
      const response = await request(app)
        .patch('/')
        .expect(405);

      expect(response.headers.allow).toEqual(['POST', 'PUT', 'DELETE']);
    });
  });

  describe('Security Integration', () => {
    it('should apply both security headers and CSRF protection for all allowed methods', async () => {
      // Test POST
      await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ name: 'Test Tutor' });

      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);

      // Reset mocks
      vi.clearAllMocks();
      mockCsrfProtection.mockImplementation((req, res, next) => next());
      mockApplySecurityHeaders.mockImplementation(() => {});

      // Test PUT
      await request(app)
        .put('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id' });

      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);

      // Reset mocks
      vi.clearAllMocks();
      mockCsrfProtection.mockImplementation((req, res, next) => next());
      mockApplySecurityHeaders.mockImplementation(() => {});

      // Test DELETE
      await request(app)
        .delete('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id' });

      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should handle security failures gracefully', async () => {
      // Mock CSRF failure - callback with error
      mockCsrfProtection.mockImplementation((req, res, next) => {
        next(new Error('CSRF token missing'));
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ name: 'Test Tutor' })
        .expect(403);

      // Verify security headers were still applied
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(response.body.message).toContain('CSRF token validation failed');
    });
  });
});
