/**
 * @fileoverview Integration tests for upload API security
 * @description Tests authentication requirements for upload diagnostics endpoint
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../../models/User.js';

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Import API handler
import uploadHandler from '../../../api/upload-image.js';
import { createServer } from 'http';
import createVercelCompatibleResponse from '../../utils/createVercelCompatibleResponse.js';

// Create test server that mimics Vercel's serverless function behavior
const createTestApp = () => {
  return createServer((req, res) => {
    // ✅ CRITICAL FIX: Add Vercel-style response helpers
    createVercelCompatibleResponse(res);

    // Parse cookies from Cookie header
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          req.cookies[name] = value;
        }
      });
    }

    // Parse request body for POST requests
    if (req.method === 'POST') {
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
        uploadHandler(req, res);
      });
    } else {
      // For GET requests, parse query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      req.query = Object.fromEntries(url.searchParams);
      uploadHandler(req, res);
    }
  });
};

describe('Upload API Security Integration Tests', () => {
  let app;
  let adminUser;
  let regularUser;
  let adminToken;
  let regularToken;

  beforeAll(async () => {
    app = createTestApp();

    // Create test users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: await bcrypt.hash('testpassword', 10),
      role: 'admin'
    });

    regularUser = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: await bcrypt.hash('testpassword', 10),
      role: 'parent'
    });

    // Generate tokens
    adminToken = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    regularToken = jwt.sign(
      { userId: regularUser._id, role: regularUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/upload-image - Diagnostics Endpoint Security', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const response = await request(app)
        .get('/api/upload-image')
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    it('should reject requests with invalid token with 401', async () => {
      const response = await request(app)
        .get('/api/upload-image')
        .set('Cookie', 'token=invalid-token')
        .expect(401);

      expect(response.body.message).toBe('Invalid authentication');
    });

    it('should reject non-admin users with 403', async () => {
      const response = await request(app)
        .get('/api/upload-image')
        .set('Cookie', `token=${regularToken}`)
        .expect(403);

      expect(response.body.message).toBe('Admin access required');
    });

    it('should allow authenticated admin users with minimal info', async () => {
      const response = await request(app)
        .get('/api/upload-image')
        .set('Cookie', `token=${adminToken}`)
        .expect(200);

      // Verify response contains only safe information
      expect(response.body.message).toBe('Upload API is running');
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBe('2.0.0');
      expect(response.body.timestamp).toBeDefined();

      // Verify sensitive information is NOT exposed
      expect(response.body.environment).toBeUndefined();
      expect(response.body.nodeVersion).toBeUndefined();
      expect(response.body.platform).toBeUndefined();
      expect(response.body.memoryUsage).toBeUndefined();
      expect(response.body.vercelRegion).toBeUndefined();
      expect(response.body.runtime).toBeUndefined();
      expect(response.body.maxFileSize).toBeUndefined();
      expect(response.body.activeUploads).toBeUndefined();
    });

    it('should handle expired tokens correctly', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/upload-image')
        .set('Cookie', `token=${expiredToken}`)
        .expect(401);

      expect(response.body.message).toBe('Invalid authentication');
    });
  });
});
