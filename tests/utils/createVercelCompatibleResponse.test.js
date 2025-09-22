import { describe, it, expect, beforeEach, vi } from 'vitest';
import createVercelCompatibleResponse from './createVercelCompatibleResponse.js';

describe('createVercelCompatibleResponse', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      statusCode: 200,
      headers: {},
      setHeader: vi.fn((name, value) => {
        mockRes.headers[name] = value;
      }),
      getHeader: vi.fn((name) => mockRes.headers[name]),
      end: vi.fn()
    };
  });

  describe('Input Validation', () => {
    it('should throw TypeError for null input', () => {
      expect(() => createVercelCompatibleResponse(null)).toThrow(TypeError);
      expect(() => createVercelCompatibleResponse(null)).toThrow('Expected a response object to enhance');
    });

    it('should throw TypeError for non-object input', () => {
      expect(() => createVercelCompatibleResponse('string')).toThrow(TypeError);
      expect(() => createVercelCompatibleResponse(123)).toThrow(TypeError);
    });

    it('should accept valid response objects', () => {
      expect(() => createVercelCompatibleResponse(mockRes)).not.toThrow();
    });
  });

  describe('Status Method', () => {
    it('should add status method if missing', () => {
      delete mockRes.status;
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      expect(typeof enhanced.status).toBe('function');
      enhanced.status(404);
      expect(enhanced.statusCode).toBe(404);
    });

    it('should preserve existing status method', () => {
      const originalStatus = vi.fn();
      mockRes.status = originalStatus;
      
      const enhanced = createVercelCompatibleResponse(mockRes);
      expect(enhanced.status).toBe(originalStatus);
    });
  });

  describe('JSON Method Security', () => {
    it('should set Content-Type with UTF-8 charset for JSON responses', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      const testData = { message: 'test', data: [1, 2, 3] };
      
      enhanced.json(testData);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(testData));
    });

    it('should handle null payload correctly', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      enhanced.json(null);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith('null');
    });

    it('should handle undefined payload correctly', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      enhanced.json(undefined);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith('null');
    });
  });

  describe('Send Method Security', () => {
    it('should set text/plain with UTF-8 charset for string content', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      const testString = 'Hello, world!';
      
      enhanced.send(testString);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith(testString);
    });

    it('should set text/plain with UTF-8 charset for Buffer content', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      const testBuffer = Buffer.from('Binary data');
      
      enhanced.send(testBuffer);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith(testBuffer);
    });

    it('should not override existing Content-Type header', () => {
      mockRes.headers['Content-Type'] = 'application/xml';
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      enhanced.send('XML content');
      
      // Should not call setHeader since Content-Type already exists
      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith('XML content');
    });

    it('should handle object content with JSON charset', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      const testObject = { key: 'value' };
      
      enhanced.send(testObject);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(testObject));
    });

    it('should handle undefined payload', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      enhanced.send(undefined);
      
      expect(mockRes.end).toHaveBeenCalledWith();
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('Method Chaining', () => {
    it('should support method chaining for status and json', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      const result = enhanced.status(201).json({ created: true });
      
      expect(result).toBe(enhanced);
      expect(mockRes.statusCode).toBe(201);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    });

    it('should support method chaining for status and send', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      const result = enhanced.status(400).send('Bad Request');
      
      expect(result).toBe(enhanced);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    });
  });

  describe('Security Headers Validation', () => {
    it('should ensure UTF-8 charset is always present in JSON responses', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      enhanced.json({ test: 'data' });
      
      const contentType = mockRes.setHeader.mock.calls.find(call => call[0] === 'Content-Type')?.[1];
      expect(contentType).toContain('charset=utf-8');
      expect(contentType).toBe('application/json; charset=utf-8');
    });

    it('should ensure UTF-8 charset is present in text responses', () => {
      const enhanced = createVercelCompatibleResponse(mockRes);
      
      enhanced.send('Plain text');
      
      const contentType = mockRes.setHeader.mock.calls.find(call => call[0] === 'Content-Type')?.[1];
      expect(contentType).toContain('charset=utf-8');
      expect(contentType).toBe('text/plain; charset=utf-8');
    });
  });
});
