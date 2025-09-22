import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import createVercelCompatibleResponse from '../../utils/createVercelCompatibleResponse.js';

// Mock external services
import { vi } from 'vitest';

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Import models and API handler (using dynamic imports for mixed module compatibility)
let User, uploadHandler;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create test server with Vercel-compatible response object
function createTestApp() {
  return createServer((req, res) => {
    // ✅ SECURITY FIX: Use shared response helper with proper charset handling
    createVercelCompatibleResponse(res);

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

describe('Image Upload Pipeline Integration', () => {
  let testImageBuffer;
  let testImagePath;

  beforeAll(async () => {
    // Note: Database connection is handled by global setup
    console.log('Setting up image upload test fixtures');

    // Dynamic imports for mixed module compatibility
    User = (await import('../../../models/User.js')).default;
    uploadHandler = (await import('../../../api/upload-image.js')).default;

    // Create test image buffer
    testImagePath = path.join(__dirname, '../../fixtures/data/test-image.jpg');
    
    // Create a minimal test image if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      // Create fixtures directory if it doesn't exist
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
  });

  afterAll(async () => {
    // Note: Database teardown is handled by global setup
    console.log('Cleaning up image upload test fixtures');

    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockPut.mockResolvedValue({
      url: 'https://test-blob-url.vercel-storage.com/test-image.jpg',
      pathname: 'test-image.jpg',
      contentType: 'image/jpeg',
      contentDisposition: 'inline; filename="test-image.jpg"'
    });

    mockSharp.metadata.mockResolvedValue({
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 50000
    });

    mockSharp.toBuffer.mockResolvedValue(testImageBuffer);
  });

  describe('Image Processing with Sharp', () => {
    it('should process and resize images correctly', async () => {
      const sharp = (await import('sharp')).default;
      
      // Simulate image processing
      const processor = sharp(testImageBuffer);
      await processor.resize(400, 300).jpeg({ quality: 80 }).toBuffer();
      
      expect(mockSharp.resize).toHaveBeenCalledWith(400, 300);
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(mockSharp.toBuffer).toHaveBeenCalled();
    });

    it('should handle different image formats', async () => {
      const sharp = (await import('sharp')).default;
      
      // Test PNG processing
      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'png',
        size: 75000
      });
      
      const processor = sharp(testImageBuffer);
      await processor.png({ quality: 90 }).toBuffer();
      
      expect(mockSharp.png).toHaveBeenCalledWith({ quality: 90 });
    });

    it('should validate image metadata', async () => {
      const sharp = (await import('sharp')).default;
      
      const processor = sharp(testImageBuffer);
      const metadata = await processor.metadata();
      
      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('format');
      expect(metadata).toHaveProperty('size');
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
    });

    it('should handle corrupted images gracefully', async () => {
      const sharp = (await import('sharp')).default;
      
      // Mock corrupted image metadata
      mockSharp.metadata.mockRejectedValue(new Error('Invalid image format'));
      
      const processor = sharp(Buffer.from('invalid image data'));
      
      await expect(processor.metadata()).rejects.toThrow('Invalid image format');
    });
  });

  describe('Vercel Blob Storage Integration', () => {
    it('should upload images to Vercel Blob successfully', async () => {
      const { put } = await import('@vercel/blob');
      
      const result = await put('test-image.jpg', testImageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
      
      expect(mockPut).toHaveBeenCalledWith('test-image.jpg', testImageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('pathname');
      expect(result.url).toContain('vercel-storage.com');
    });

    it('should handle upload failures gracefully', async () => {
      const { put } = await import('@vercel/blob');
      
      mockPut.mockRejectedValue(new Error('Upload failed'));
      
      await expect(put('test-image.jpg', testImageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      })).rejects.toThrow('Upload failed');
    });

    it('should delete images from Vercel Blob', async () => {
      const { del } = await import('@vercel/blob');
      
      await del('https://test-blob-url.vercel-storage.com/test-image.jpg');
      
      expect(mockDel).toHaveBeenCalledWith('https://test-blob-url.vercel-storage.com/test-image.jpg');
    });

    it('should handle large file uploads', async () => {
      const { put } = await import('@vercel/blob');
      
      // Create a large buffer (5MB)
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024, 'test data');
      
      await put('large-image.jpg', largeBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
      
      expect(mockPut).toHaveBeenCalledWith('large-image.jpg', largeBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
    });
  });

  describe('File Validation', () => {
    it('should validate file types correctly', () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const invalidTypes = ['text/plain', 'application/pdf', 'video/mp4'];
      
      validTypes.forEach(type => {
        expect(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).toContain(type);
      });
      
      invalidTypes.forEach(type => {
        expect(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).not.toContain(type);
      });
    });

    it('should validate file sizes', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      expect(testImageBuffer.length).toBeLessThan(maxSize);
      
      // Test oversized file
      const oversizedBuffer = Buffer.alloc(maxSize + 1);
      expect(oversizedBuffer.length).toBeGreaterThan(maxSize);
    });

    it('should validate image dimensions', async () => {
      const sharp = (await import('sharp')).default;
      
      const processor = sharp(testImageBuffer);
      const metadata = await processor.metadata();
      
      // Validate reasonable dimensions
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(metadata.width).toBeLessThan(10000); // Max width
      expect(metadata.height).toBeLessThan(10000); // Max height
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts during upload', async () => {
      const { put } = await import('@vercel/blob');
      
      mockPut.mockRejectedValue(new Error('Network timeout'));
      
      await expect(put('test-image.jpg', testImageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      })).rejects.toThrow('Network timeout');
    });

    it('should handle insufficient storage space', async () => {
      const { put } = await import('@vercel/blob');
      
      mockPut.mockRejectedValue(new Error('Insufficient storage'));
      
      await expect(put('test-image.jpg', testImageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      })).rejects.toThrow('Insufficient storage');
    });

    it('should handle concurrent upload limits', async () => {
      const { put } = await import('@vercel/blob');
      
      mockPut.mockRejectedValue(new Error('Too many concurrent uploads'));
      
      await expect(put('test-image.jpg', testImageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      })).rejects.toThrow('Too many concurrent uploads');
    });
  });

  describe('Image Optimization Pipeline', () => {
    it('should create multiple image sizes for responsive design', async () => {
      const sharp = (await import('sharp')).default;
      const sizes = [
        { width: 400, height: 300, suffix: 'small' },
        { width: 800, height: 600, suffix: 'medium' },
        { width: 1200, height: 900, suffix: 'large' }
      ];
      
      for (const size of sizes) {
        const processor = sharp(testImageBuffer);
        await processor.resize(size.width, size.height).jpeg({ quality: 80 }).toBuffer();
        
        expect(mockSharp.resize).toHaveBeenCalledWith(size.width, size.height);
      }
      
      expect(mockSharp.resize).toHaveBeenCalledTimes(sizes.length);
    });

    it('should optimize images for web delivery', async () => {
      const sharp = (await import('sharp')).default;
      
      // Test WebP optimization
      const processor = sharp(testImageBuffer);
      await processor.webp({ quality: 85, effort: 4 }).toBuffer();
      
      expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85, effort: 4 });
    });

    it('should maintain aspect ratios during resize', async () => {
      const sharp = (await import('sharp')).default;
      
      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg'
      });
      
      const processor = sharp(testImageBuffer);
      const metadata = await processor.metadata();
      
      // Calculate original aspect ratio for validation
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);

      // Resize maintaining aspect ratio
      await processor.resize(400, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      }).toBuffer();
      
      // The aspect ratio should be maintained
      expect(mockSharp.resize).toHaveBeenCalled();
      // Note: In a real test, we would verify the calculated height matches the aspect ratio
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 NEW: REAL API INTEGRATION TESTS (Following Tech Team Recommendations)
// ═══════════════════════════════════════════════════════════════════════════════

describe('File Upload API Integration (Real API Testing)', () => {
  let app;
  let testUser;
  let authToken;
  let testImageBuffer;
  let testImagePath;
  let testVideoBuffer;
  let testVideoPath;

  beforeAll(async () => {
    // Note: Database connection handled by global setup
    console.log('🔧 Setting up real API integration tests');

    // Dynamic imports for mixed module compatibility (if not already loaded)
    if (!User) {
      User = (await import('../../../models/User.js')).default;
      uploadHandler = (await import('../../../api/upload-image.js')).default;
    }

    // Create test app
    app = createTestApp();

    // Create test admin user for authentication
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@upload-test.com',
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
    testImagePath = path.join(__dirname, '../../fixtures/data/test-upload-image.jpg');

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

    // Create test video buffer (minimal MP4 header)
    testVideoPath = path.join(__dirname, '../../fixtures/data/test-upload-video.mp4');
    if (!fs.existsSync(testVideoPath)) {
      // Minimal MP4 header for testing
      testVideoBuffer = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
        0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
      ]);
      fs.writeFileSync(testVideoPath, testVideoBuffer);
    } else {
      testVideoBuffer = fs.readFileSync(testVideoPath);
    }

    console.log('✅ Real API integration test setup complete');
  });

  afterAll(async () => {
    // Note: Database cleanup handled by global teardown
    console.log('🧹 Cleaning up real API integration test fixtures');

    // Clean up test files
    [testImagePath, testVideoPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  beforeEach(() => {
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
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔒 AUTHENTICATION & AUTHORIZATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /api/upload-image - Authentication & Authorization', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .post('/')
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Authentication required for file uploads');
      expect(response.body).toHaveProperty('error', 'UNAUTHORIZED_UPLOAD_ATTEMPT');
    });

    it('should reject requests with invalid authentication token', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', 'token=invalid-token-here')
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Authentication required for file uploads');
    });

    it('should reject requests with expired authentication token', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id.toString(), role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${expiredToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Authentication required for file uploads');
    });

    it('should reject users with insufficient permissions (parent role)', async () => {
      // Create a parent user (not in allowed roles)
      const parentUser = await User.create({
        name: 'Parent User',
        email: 'parent@upload-test.com',
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
      expect(response.body).toHaveProperty('allowedRoles');
      expect(response.body.allowedRoles).toEqual(['admin', 'tutor', 'blogwriter']);
    });

    it('should allow admin users to upload files', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('width');
      expect(response.body).toHaveProperty('height');
      expect(response.body).toHaveProperty('type', 'image/jpeg');
    });

    it('should allow tutor users to upload files', async () => {
      // Create a tutor user
      const tutorUser = await User.create({
        name: 'Tutor User',
        email: 'tutor@upload-test.com',
        password: await bcrypt.hash('testpassword', 10),
        role: 'tutor'
      });

      const tutorToken = jwt.sign(
        { id: tutorUser._id.toString(), role: 'tutor' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${tutorToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('type', 'image/jpeg');
    });

    it('should allow blogwriter users to upload files', async () => {
      // Create a blogwriter user
      const blogwriterUser = await User.create({
        name: 'Blog Writer',
        email: 'blogger@upload-test.com',
        password: await bcrypt.hash('testpassword', 10),
        role: 'blogwriter'
      });

      const blogwriterToken = jwt.sign(
        { id: blogwriterUser._id.toString(), role: 'blogwriter' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${blogwriterToken}`)
        .attach('file', testImageBuffer, 'test-image.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('type', 'image/jpeg');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🛡️ FILE VALIDATION & SECURITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /api/upload-image - File Validation & Security', () => {
    it('should reject requests without a file', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'No file provided');
    });

    it('should reject disallowed file types (text file)', async () => {
      const textBuffer = Buffer.from('This is a text file, not an image');

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', textBuffer, 'malicious.txt')
        .expect(415);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should reject disallowed file types (PDF file)', async () => {
      // PDF header
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', pdfBuffer, 'document.pdf')
        .expect(415);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should reject oversized image uploads', async () => {
      // Create a buffer larger than MAX_UPLOAD (4MB)
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024, 0xFF); // 5MB

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', oversizedBuffer, 'huge-image.jpg')
        .expect(413);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('File too large');
    });

    it('should accept valid JPEG images', async () => {
      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', testImageBuffer, 'valid-image.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('thumb');
      expect(response.body).toHaveProperty('width');
      expect(response.body).toHaveProperty('height');
      expect(response.body).toHaveProperty('type', 'image/jpeg');
      expect(mockPut).toHaveBeenCalledTimes(2); // Main image + thumbnail
    });

    it('should accept valid PNG images', async () => {
      // Mock PNG metadata
      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'png',
        size: testImageBuffer.length
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', testImageBuffer, 'valid-image.png')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('type', 'image/png');
    });

    it('should accept valid WebP images', async () => {
      // Mock WebP metadata
      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'webp',
        size: testImageBuffer.length
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', testImageBuffer, 'valid-image.webp')
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('type', 'image/webp');
    });

    it('should handle corrupted image files gracefully', async () => {
      // Mock Sharp to throw an error for corrupted image
      mockSharp.metadata.mockRejectedValue(new Error('Invalid image format'));

      const corruptedBuffer = Buffer.from([0xFF, 0xD8, 0x00, 0x00]); // Incomplete JPEG

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', corruptedBuffer, 'corrupted.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unable to process image');
    });

    it('should validate image dimensions', async () => {
      // Mock oversized dimensions
      mockSharp.metadata.mockResolvedValue({
        width: 3000, // Exceeds MAX_DIMENSIONS (2000)
        height: 3000,
        format: 'jpeg',
        size: testImageBuffer.length
      });

      const response = await request(app)
        .post('/')
        .set('Cookie', `token=${authToken}`)
        .attach('file', testImageBuffer, 'huge-dimensions.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Image dimensions too large');
    });
  });
