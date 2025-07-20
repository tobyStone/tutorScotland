import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Set up test environment FIRST
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Import models AFTER setting environment
const User = require('../../../models/User');

// Import the login handler
const loginHandler = require('../../../api/login.js');

// Create a simple test server using Node.js http
const http = require('http');
const { parse } = require('url');

const app = http.createServer(async (req, res) => {
  // Parse URL and body
  const parsedUrl = parse(req.url, true);
  req.query = parsedUrl.query;

  // Parse body for POST requests
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
      } catch (e) {
        req.body = {};
      }
      loginHandler(req, res);
    });
  } else {
    req.body = {};
    loginHandler(req, res);
  }
});

let mongoServer;

describe.skip('Login API Integration (DISABLED - needs proper setup)', () => {
  let testUser;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(mongoUri);
    console.log('Test database connected successfully');
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
      console.log('Test database torn down successfully');
    }
  });

  beforeEach(async () => {
    // Clear database
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      console.log('Test database cleared successfully');
    }
    // Create a test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: await bcrypt.hash('testpassword123', 10),
      role: 'admin'
    });
  });

  describe('POST /api/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('redirectUrl');
      expect(response.body.user).toMatchObject({
        id: testUser._id.toString(),
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin'
      });
      expect(response.body.redirectUrl).toBe('/admin.html');

      // Check that JWT token is set in cookie
      expect(response.headers['set-cookie']).toBeDefined();
      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('token=');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('Secure');
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should handle case-insensitive email login', async () => {
      const loginData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(200);

      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should generate valid JWT token', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(200);

      // Extract token from cookie
      const cookieHeader = response.headers['set-cookie'][0];
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      expect(tokenMatch).toBeTruthy();

      const token = tokenMatch[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded).toMatchObject({
        id: testUser._id.toString(),
        role: 'admin'
      });
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should handle missing JWT_SECRET gracefully', async () => {
      // Temporarily remove JWT_SECRET
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(500);

      expect(response.body).toHaveProperty('message', 'Internal server error: JWT_SECRET not set');

      // Restore JWT_SECRET
      process.env.JWT_SECRET = originalSecret;
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/')
        .send({})
        .expect(400);

      // Should handle missing email/password gracefully
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/login?check=admin', () => {
    it('should verify admin status with valid token', async () => {
      // Generate a valid admin token
      const token = jwt.sign(
        { id: testUser._id.toString(), role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '3h' }
      );

      const response = await request(app)
        .get('/?check=admin')
        .set('Cookie', `token=${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('isAdmin', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('admin');
    });

    it('should reject non-admin users', async () => {
      // Create a parent user
      const parentUser = await User.create({
        name: 'Parent User',
        email: 'parent@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'parent'
      });

      const token = jwt.sign(
        { id: parentUser._id.toString(), role: 'parent' },
        process.env.JWT_SECRET,
        { expiresIn: '3h' }
      );

      const response = await request(app)
        .get('/?check=admin')
        .set('Cookie', `token=${token}`)
        .expect(403);

      expect(response.body).toHaveProperty('isAdmin', false);
      expect(response.body).toHaveProperty('message', 'Access denied: Admin only');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/?check=admin')
        .set('Cookie', 'token=invalid-token')
        .expect(200);

      expect(response.body).toHaveProperty('isAdmin', false);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id.toString(), role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/?check=admin')
        .set('Cookie', `token=${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('isAdmin', false);
    });

    it('should handle missing token', async () => {
      const response = await request(app)
        .get('/?check=admin')
        .expect(200);

      expect(response.body).toHaveProperty('isAdmin', false);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      const originalFindOne = User.findOne;
      User.findOne = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(500);

      expect(response.body.message).toContain('error');

      // Restore original method
      User.findOne = originalFindOne;
    });

    it('should handle bcrypt comparison errors', async () => {
      // Mock bcrypt error
      const originalCompare = bcrypt.compare;
      bcrypt.compare = vi.fn().mockRejectedValue(new Error('Bcrypt error'));

      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(500);

      expect(response.body.message).toContain('error');

      // Restore original method
      bcrypt.compare = originalCompare;
    });

    it('should reject non-POST/GET methods', async () => {
      const response = await request(app)
        .put('/')
        .expect(405);

      expect(response.headers.allow).toContain('POST');
      expect(response.headers.allow).toContain('GET');
    });
  });

  describe('Security', () => {
    it('should not expose password in response', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(200);

      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should set secure cookie flags', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/')
        .send(loginData)
        .expect(200);

      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('Secure');
      expect(cookieHeader).toContain('SameSite=Strict');
    });
  });
});
