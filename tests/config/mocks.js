import { vi } from 'vitest';

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({
    url: 'https://mock-blob-url.com/test-image.jpg',
    downloadUrl: 'https://mock-blob-url.com/test-image.jpg'
  }),
  list: vi.fn().mockResolvedValue({
    blobs: [
      {
        url: 'https://mock-blob-url.com/test-image-1.jpg',
        pathname: 'content-images/test-image-1.jpg',
        size: 1024,
        uploadedAt: new Date()
      }
    ]
  }),
  del: vi.fn().mockResolvedValue(undefined)
}));

// Mock Sharp image processing
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-processed-image')),
    metadata: vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 1024
    })
  }));
  
  // Mock static methods
  mockSharp.cache = vi.fn();
  mockSharp.concurrency = vi.fn();
  
  return mockSharp;
});

// Mock Nodemailer
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({
      messageId: 'mock-message-id',
      accepted: ['test@example.com'],
      rejected: []
    })
  }))
}));

// Mock OpenAI (if used in tests)
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock AI response'
            }
          }]
        })
      }
    }
  }))
}));

// Mock file system operations for testing
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('mock file content'),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    unlinkSync: vi.fn()
  };
});

// Mock formidable for file upload testing
vi.mock('formidable', () => ({
  formidable: vi.fn(() => ({
    parse: vi.fn().mockImplementation((req, callback) => {
      callback(null, 
        { // fields
          folder: 'content-images'
        }, 
        { // files
          file: {
            filepath: '/tmp/mock-file',
            originalFilename: 'test-image.jpg',
            mimetype: 'image/jpeg',
            size: 1024
          }
        }
      );
    })
  }))
}));

// Console suppression for cleaner test output
const originalConsole = { ...console };

export function suppressConsole() {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
}

export function restoreConsole() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}
