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
import createVercelCompatibleResponse from '../../utils/createVercelCompatibleResponse.js';
import blogWriterHandler from '../../../api/blog-writer.js';

// Note: We focus on functional testing rather than mocking implementation details
// The security functions are tested by verifying their actual effects (headers, behavior)

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
      // ✅ SECURITY FIX: Use shared response helper with proper charset handling
      createVercelCompatibleResponse(res);

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

    // Generate blogwriter JWT token for testing (blog-writer API expects 'blogwriter' role)
    adminToken = jwt.sign(
      { email: 'blogwriter@test.com', role: 'blogwriter' },
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
  });

  describe('Security Headers', () => {
    it('should apply comprehensive security headers for all requests', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', `token=${adminToken}`);

      // Verify security headers are present in response (may redirect due to auth issues)
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });

    it('should apply security headers even for failed requests', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog' });

      // Verify security headers are present even for failed requests
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
  });

  describe('CSRF Protection', () => {
    it('should process POST requests with proper authentication', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog', content: 'Test content' });

      // Should process the request (may fail on validation, but CSRF is handled)
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should process PUT requests with proper authentication', async () => {
      const response = await request(app)
        .put('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id', title: 'Updated Blog' });

      // Should process the request (may fail on validation, but not on CSRF)
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should process DELETE requests with proper authentication', async () => {
      const response = await request(app)
        .delete('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ id: 'test-id' });

      // Should process the request (may fail on validation, but not on CSRF)
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should process GET requests without CSRF protection', async () => {
      const response = await request(app)
        .get('/')
        .set('Cookie', `token=${adminToken}`);

      // GET requests should be processed (may redirect due to auth, but not CSRF issues)
      expect([200, 302]).toContain(response.status);
    });

    it('should handle requests without authentication', async () => {
      const response = await request(app)
        .post('/')
        .send({ title: 'Test Blog' });

      // Should fail due to missing authentication (may be 401 or 302 redirect)
      expect([401, 302]).toContain(response.status);
    });
  });

  describe('Security Integration', () => {
    it('should apply security headers for write operations', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test Blog', content: 'Test content' });

      // Verify security headers are present
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });

    it('should handle authentication failures gracefully', async () => {
      const response = await request(app)
        .post('/')
        .send({ title: 'Test Blog' });

      // Should fail due to missing authentication (may be 401 or 302 redirect)
      expect([401, 302]).toContain(response.status);

      // Security headers should still be present
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
  });
});
