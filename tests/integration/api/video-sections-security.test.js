/**
 * @fileoverview Integration tests for video-sections API security
 * @description Tests CSRF protection and security headers for video management endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import createVercelCompatibleResponse from '../../utils/createVercelCompatibleResponse.js';
import * as csrfModule from '../../../utils/csrf-protection.js';
import * as securityModule from '../../../utils/security-headers.js';

// Note: We focus on functional testing rather than mocking implementation details
// The security functions are tested by verifying their actual effects (headers, behavior)

describe('Video Sections API Security Integration Tests', () => {
  let mongoServer;
  let app;
  let adminToken;
  let mockCsrfProtection;
  let mockApplySecurityHeaders;
  let videoSectionsHandler;

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

    // Set up spies for security functions BEFORE importing handler
    mockCsrfProtection = vi.spyOn(csrfModule, 'csrfProtection');
    mockApplySecurityHeaders = vi.spyOn(securityModule, 'applyComprehensiveSecurityHeaders');

    // Import handler AFTER setting up spies
    const videoSectionsModule = await import('../../../api/video-sections.js');
    videoSectionsHandler = videoSectionsModule.default;

    // Create HTTP server with video-sections handler
    app = createServer((req, res) => {
      // ✅ SECURITY FIX: Use shared response helper with proper charset handling
      createVercelCompatibleResponse(res);

      // Don't pre-parse body - let formidable handle multipart data
      videoSectionsHandler(req, res);
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
    // Clear database before each test
    await mongoose.connection.db.dropDatabase();

    // Reset spies between tests
    mockCsrfProtection.mockClear();
    mockApplySecurityHeaders.mockClear();
  });

  describe('Security Headers', () => {
    it('should apply comprehensive security headers for all requests', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', `token=${adminToken}`);

      // Verify security headers are present in response
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });

    it('should apply security headers even for failed requests', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Video Section' });

      // Verify security headers are present even for failed requests
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
  });

  describe('CSRF Protection', () => {
    it('should enforce CSRF protection for POST requests', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Video Section', videoUrl: 'https://example.com/video.mp4' });

      // Verify CSRF protection was called
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should enforce CSRF protection for PUT requests', async () => {
      const response = await request(app)
        .put('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id', title: 'Updated Video Section' });

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
        .send({ title: 'Test Video Section' })
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
        .send({ title: 'Test Video Section', videoUrl: 'https://example.com/video.mp4' });

      // Verify both security measures were applied
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });

    it('should apply security headers but not CSRF for read operations', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', `token=${adminToken}`);

      // Verify security headers were applied but not CSRF for GET
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).not.toHaveBeenCalled();
    });

    it('should handle security failures gracefully', async () => {
      // Mock CSRF failure - callback with error
      mockCsrfProtection.mockImplementation((req, res, next) => {
        next(new Error('CSRF token missing'));
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Video Section' })
        .expect(403);

      // Verify security headers were still applied
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(response.body.message).toContain('CSRF token validation failed');
    });

    it('should handle all state-changing methods with proper security', async () => {
      const methods = ['POST', 'PUT', 'DELETE'];
      
      for (const method of methods) {
        // Reset mocks for each test
        vi.clearAllMocks();
        mockCsrfProtection.mockImplementation((req, res, next) => next());
        mockApplySecurityHeaders.mockImplementation(() => {});

        await request(app)[method.toLowerCase()]('/')
          .set('Cookie', `token=${adminToken}`)
          .send({ title: `Test ${method}` });

        // Verify both security measures were applied for each method
        expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
        expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Error Handling', () => {
    it('should maintain security even when handler throws errors', async () => {
      // This test ensures security is applied before any business logic that might fail
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ invalidData: true });

      // Verify security headers were applied regardless of handler outcome
      expect(mockApplySecurityHeaders).toHaveBeenCalledTimes(1);
      expect(mockCsrfProtection).toHaveBeenCalledTimes(1);
    });
  });
});
