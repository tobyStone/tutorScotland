/**
 * @fileoverview Integration tests for blog-writer API security
 * @description Tests CSRF protection and security headers for blog management endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import blogWriterHandler from '../../../api/blog-writer.js';

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

describe('Blog Writer API Security Integration Tests', () => {
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

    // Create HTTP server with blog handler
    app = createServer((req, res) => {
      // Parse request body for POST/PUT requests
      if (['POST', 'PUT'].includes(req.method)) {
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
          blogWriterHandler(req, res);
        });
      } else {
        blogWriterHandler(req, res);
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
        .get('/')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      // Verify security headers function was called
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
    });

    it('should apply security headers even for failed requests', async () => {
      // Mock CSRF failure - callback with error
      mockCsrfProtection.mockImplementation((req, res, next) => {
        next(new Error('Invalid CSRF token'));
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog' })
        .expect(403);

      // Verify security headers were applied before CSRF check
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSRF Protection', () => {
    it('should enforce CSRF protection for POST requests', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog', content: 'Test content' });

      // Verify CSRF protection was called
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should enforce CSRF protection for PUT requests', async () => {
      const response = await request(app)
        .put('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id', title: 'Updated Blog' });

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

    it('should NOT enforce CSRF protection for GET requests', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', `token=${adminToken}`);

      // Verify CSRF protection was NOT called for GET
      expect(mockCsrfProtection).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF validation fails', async () => {
      // Mock CSRF failure - callback with error
      mockCsrfProtection.mockImplementation((req, res, next) => {
        next(new Error('Invalid CSRF token'));
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog' })
        .expect(403);

      expect(response.body).toHaveProperty('message', 'CSRF token validation failed');
      expect(response.body).toHaveProperty('error', 'Invalid CSRF token');
    });
  });

  describe('Security Integration', () => {
    it('should apply both security headers and CSRF protection for write operations', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog', content: 'Test content' });

      // Verify both security measures were applied
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should handle security failures gracefully', async () => {
      // Mock CSRF failure
      mockCsrfProtection.mockReturnValue({ 
        success: false, 
        error: 'CSRF token missing' 
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog' })
        .expect(403);

      // Verify security headers were still applied
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(response.body.message).toContain('CSRF token validation failed');
    });
  });
});
