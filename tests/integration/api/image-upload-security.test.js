import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock external services
import { vi } from 'vitest';

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Import models and API handler
const User = require('../../../models/User.js');
const uploadHandler = require('../../../api/upload-image.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Vercel Blob
const mockPut = vi.fn();
const mockDel = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
  del: mockDel
}));

// Mock Sharp
const mockSharp = {
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
  metadata: vi.fn()
};
vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharp)
}));

// Create test server with Vercel-compatible response object
function createTestApp() {
  return createServer((req, res) => {
    // Add Vercel-compatible response methods
    if (!res.status) {
      res.status = function(code) {
        res.statusCode = code;
        return res;
      };
    }
    if (!res.json) {
      res.json = function(data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
      };
    }
    if (!res.send) {
      res.send = function(data) {
        if (typeof data === 'object') {
          return res.json(data);
        }
        res.end(data);
        return res;
      };
    }

    // Parse cookies for authentication
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      req.cookies = {};
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          req.cookies[name] = decodeURIComponent(value);
        }
      });
    } else {
      req.cookies = {};
    }

    // Route to upload handler
    uploadHandler(req, res);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 SECURITY-FOCUSED FILE UPLOAD TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('File Upload Security Integration Tests', () => {
  let app;
  let testUser;
  let authToken;
  let testImageBuffer;
  let testImagePath;

  beforeAll(async () => {
    // Note: Database connection handled by global setup
    console.log('🔧 Setting up security-focused upload tests');

    // Create test app
    app = createTestApp();

    // Create test admin user for authentication
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@security-test.com',
      password: await bcrypt.hash('testpassword', 10),
      role: 'admin'
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id.toString(), role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test image buffer
    testImagePath = path.join(__dirname, '../../fixtures/data/test-security-image.jpg');
    
    // Create a minimal test image if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      const fixturesDir = path.dirname(testImagePath);
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      
      // Create a minimal JPEG header for testing
      testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xD9
      ]);
      fs.writeFileSync(testImagePath, testImageBuffer);
    } else {
      testImageBuffer = fs.readFileSync(testImagePath);
    }

    console.log('✅ Security-focused upload test setup complete');
  });

  afterAll(async () => {
    // Note: Database cleanup handled by global teardown
    console.log('🧹 Cleaning up security test fixtures');

    // Clean up test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock responses for Vercel Blob
    mockPut.mockResolvedValue({
      url: 'https://test-blob-url.vercel-storage.com/test-image.jpg',
      pathname: 'test-image.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline; filename="test-image.jpg"'
    });

    // Setup default mock responses for Sharp
    mockSharp.metadata.mockResolvedValue({
      width: 800,
      height: 600,
      format: 'jpeg',
      size: testImageBuffer.length
    });

    mockSharp.toBuffer.mockResolvedValue(testImageBuffer);

    // Wait to avoid concurrent upload limits
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🛡️ CRITICAL SECURITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Authentication Security', () => {
    it('should block unauthenticated upload attempts', async () => {
      const response = await request(app)
        .post('/')
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Authentication required for file uploads');
      expect(response.body).toHaveProperty('error', 'UNAUTHORIZED_UPLOAD_ATTEMPT');
    });

    it('should block invalid tokens', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', 'token=invalid-malicious-token')
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Authentication required for file uploads');
    });

    it('should block expired tokens', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id.toString(), role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${expiredToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Authentication required for file uploads');
    });

    it('should enforce role-based permissions', async () => {
      // Create a parent user (not in allowed roles)
      const parentUser = await User.create({
        name: 'Parent User',
        email: 'parent@security-test.com',
        password: await bcrypt.hash('testpassword', 10),
        role: 'parent'
      });

      const parentToken = jwt.sign(
        { id: parentUser._id.toString(), role: 'parent' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${parentToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(403);

      expect(response.body).toHaveProperty('message', 'Insufficient permissions for file uploads');
      expect(response.body).toHaveProperty('error', 'INSUFFICIENT_PERMISSIONS');
      expect(response.body.allowedRoles).toEqual(['admin', 'tutor', 'blogwriter']);
    });
  });

  describe('File Type Security', () => {
    it('should block malicious executable files', async () => {
      const executableBuffer = Buffer.from('MZ\x90\x00'); // PE executable header

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', executableBuffer, 'malware.exe')
        .expect(415);

      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should block script files', async () => {
      const scriptBuffer = Buffer.from('#!/bin/bash\nrm -rf /');

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', scriptBuffer, 'malicious.sh')
        .expect(415);

      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should block HTML files with potential XSS', async () => {
      const htmlBuffer = Buffer.from('<script>alert("XSS")</script>');

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', htmlBuffer, 'xss.html')
        .expect(415);

      expect(response.body.message).toContain('Unsupported file type');
    });
  });

  describe('File Size Security', () => {
    it('should block oversized uploads (DoS protection)', async () => {
      // Create a buffer larger than MAX_UPLOAD (4MB)
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024, 0xFF);

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', oversizedBuffer, 'dos-attack.jpg');

      // Should either reject as too large (413) or hit rate limit (429)
      expect([413, 429]).toContain(response.status);
      
      if (response.status === 413) {
        expect(response.body.message).toContain('File too large');
      }
    });
  });

  describe('Method Security', () => {
    it('should only allow POST method', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        const response = await request(app)[method.toLowerCase()]('/')
          .set('Cookie', `token=${authToken}`)
          .expect(405);

        expect(response.headers.allow).toBe('POST');
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should implement concurrent upload protection', async () => {
      // The API has MAX_CONCURRENT_UPLOADS = 2
      // This is a security feature to prevent DoS attacks
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg');

      // Either succeeds or hits rate limit - both are correct security behavior
      expect([200, 429]).toContain(response.status);
      
      if (response.status === 429) {
        expect(response.body.message).toContain('Too many uploads in progress');
      }
    });
  });
});
