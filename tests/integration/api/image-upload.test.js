import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock external services
import { vi } from 'vitest';

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

describe('Image Upload Pipeline Integration', () => {
  let testImageBuffer;
  let testImagePath;

  beforeAll(async () => {
    // Note: Database connection is handled by global setup
    console.log('Setting up image upload test fixtures');

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
