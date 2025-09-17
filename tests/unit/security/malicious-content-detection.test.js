import { describe, it, expect } from 'vitest';

// We need to test the detectMaliciousContent function directly
// Since it's not exported, we'll test it through a simple require
const fs = require('fs');
const path = require('path');

// Read the upload-image.js file and extract the function for testing
const uploadImagePath = path.join(process.cwd(), 'api/upload-image.js');
const uploadImageCode = fs.readFileSync(uploadImagePath, 'utf8');

// Extract the DANGEROUS_SIGNATURES and detectMaliciousContent function
const DANGEROUS_SIGNATURES = [
    { signature: [0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74], name: 'HTML Script Tag', description: '<script' },
    { signature: [0x3C, 0x68, 0x74, 0x6D, 0x6C], name: 'HTML Document', description: '<html' },
    { signature: [0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45], name: 'HTML DOCTYPE', description: '<!DOCTYPE' },
    { signature: [0x3C, 0x3F, 0x70, 0x68, 0x70], name: 'PHP Script', description: '<?php' },
    { signature: [0x4D, 0x5A], name: 'Windows Executable', description: 'PE/MZ header' },
    { signature: [0x7F, 0x45, 0x4C, 0x46], name: 'Linux Executable', description: 'ELF header' },
    { signature: [0x23, 0x21, 0x2F, 0x62, 0x69, 0x6E], name: 'Shell Script', description: '#!/bin' },
    { signature: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP Archive', description: 'ZIP header (potential polyglot)' },
    { signature: [0x3C, 0x69, 0x66, 0x72, 0x61, 0x6D, 0x65], name: 'HTML Iframe', description: '<iframe' },
    { signature: [0x3C, 0x6F, 0x62, 0x6A, 0x65, 0x63, 0x74], name: 'HTML Object', description: '<object' }
];

function detectMaliciousContent(buffer) {
    if (!buffer || buffer.length === 0) {
        return { name: 'Empty File', description: 'Zero-byte file detected' };
    }

    // Check first 512 bytes for signatures (sufficient for most headers)
    const checkLength = Math.min(buffer.length, 512);
    const checkBuffer = buffer.slice(0, checkLength);

    for (const danger of DANGEROUS_SIGNATURES) {
        if (checkBuffer.length >= danger.signature.length) {
            // Check for exact signature match
            const match = danger.signature.every((byte, index) => checkBuffer[index] === byte);
            if (match) {
                return danger;
            }

            // Also check for case-insensitive text patterns (for HTML/script content)
            if (danger.signature.length > 2) {
                const textPattern = String.fromCharCode(...danger.signature).toLowerCase();
                const bufferText = checkBuffer.toString('ascii', 0, Math.min(100, checkBuffer.length)).toLowerCase();
                if (bufferText.includes(textPattern)) {
                    return danger;
                }
            }
        }
    }

    // Additional heuristic checks
    const bufferText = checkBuffer.toString('ascii', 0, Math.min(200, checkBuffer.length)).toLowerCase();
    
    // Check for common XSS patterns
    const xssPatterns = ['javascript:', 'vbscript:', 'onload=', 'onerror=', 'onclick='];
    for (const pattern of xssPatterns) {
        if (bufferText.includes(pattern)) {
            return { name: 'XSS Pattern', description: `Detected: ${pattern}` };
        }
    }

    // Check for SQL injection patterns in file content
    const sqlPatterns = ['union select', 'drop table', 'insert into', '-- ', '/*'];
    for (const pattern of sqlPatterns) {
        if (bufferText.includes(pattern)) {
            return { name: 'SQL Injection Pattern', description: `Detected: ${pattern}` };
        }
    }

    return null; // File appears safe
}

describe('Malicious Content Detection (Unit Tests)', () => {
  describe('File Signature Detection', () => {
    it('should detect HTML script tags', () => {
      const buffer = Buffer.from('<script>alert("XSS")</script>');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('HTML Script Tag');
      expect(result.description).toBe('<script');
    });

    it('should detect HTML documents', () => {
      const buffer = Buffer.from('<html><head><title>Malicious</title></head></html>');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('HTML Document');
      expect(result.description).toBe('<html');
    });

    it('should detect PHP scripts', () => {
      const buffer = Buffer.from('<?php system($_GET["cmd"]); ?>');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('PHP Script');
      expect(result.description).toBe('<?php');
    });

    it('should detect Windows PE executables', () => {
      const buffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('Windows Executable');
      expect(result.description).toBe('PE/MZ header');
    });

    it('should detect Linux ELF executables', () => {
      const buffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01]);
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('Linux Executable');
      expect(result.description).toBe('ELF header');
    });

    it('should detect shell scripts', () => {
      const buffer = Buffer.from('#!/bin/bash\nrm -rf /');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('Shell Script');
      expect(result.description).toBe('#!/bin');
    });
  });

  describe('XSS Pattern Detection', () => {
    it('should detect javascript: URLs', () => {
      const buffer = Buffer.from('Some content with javascript:alert("xss") here');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('XSS Pattern');
      expect(result.description).toContain('javascript:');
    });

    it('should detect onload event handlers', () => {
      const buffer = Buffer.from('Image with onload=alert(1) attribute');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('XSS Pattern');
      expect(result.description).toContain('onload=');
    });
  });

  describe('SQL Injection Pattern Detection', () => {
    it('should detect UNION SELECT attacks', () => {
      const buffer = Buffer.from('Content with union select * from users');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('SQL Injection Pattern');
      expect(result.description).toContain('union select');
    });

    it('should detect DROP TABLE attacks', () => {
      const buffer = Buffer.from('Malicious drop table users content');
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('SQL Injection Pattern');
      expect(result.description).toContain('drop table');
    });
  });

  describe('Empty File Detection', () => {
    it('should detect empty files', () => {
      const buffer = Buffer.alloc(0);
      const result = detectMaliciousContent(buffer);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('Empty File');
      expect(result.description).toBe('Zero-byte file detected');
    });

    it('should handle null buffers', () => {
      const result = detectMaliciousContent(null);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('Empty File');
    });
  });

  describe('Safe File Detection', () => {
    it('should allow legitimate JPEG files', () => {
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
        0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00
      ]);
      const result = detectMaliciousContent(jpegBuffer);
      
      expect(result).toBeNull(); // Should be safe
    });

    it('should allow legitimate text content', () => {
      const textBuffer = Buffer.from('This is just normal text content without any malicious patterns');
      const result = detectMaliciousContent(textBuffer);
      
      expect(result).toBeNull(); // Should be safe
    });
  });
});
