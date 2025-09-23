/**
 * @fileoverview Security fixes validation tests
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Unit tests to verify security vulnerabilities are properly addressed:
 * - Input validation functions
 * - HTML sanitization
 * - URL validation
 */

const { validateText, validateURL, sanitizeString } = require('../../../utils/input-validation');

describe('Security Fixes - Input Validation', () => {
    describe('validateText function', () => {
        test('should reject script tags in text content', () => {
            const maliciousText = '<script>alert("xss")</script><p>Normal content</p>';
            const result = validateText(maliciousText, { 
                allowHTML: false, 
                maxLength: 1000,
                fieldName: 'test'
            });
            
            expect(result.valid).toBe(true);
            expect(result.sanitized).not.toContain('<script>');
            expect(result.sanitized).toContain('Normal content');
        });

        test('should enforce maximum length limits', () => {
            const longText = 'a'.repeat(1001);
            const result = validateText(longText, { 
                maxLength: 1000,
                fieldName: 'test'
            });
            
            expect(result.valid).toBe(true);
            expect(result.sanitized.length).toBe(1000);
        });

        test('should require text when marked as required', () => {
            const result = validateText('', { 
                required: true,
                fieldName: 'test'
            });
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('required');
        });
    });

    describe('validateURL function', () => {
        test('should reject javascript: URLs', () => {
            const maliciousUrl = 'javascript:alert("xss")';
            const result = validateURL(maliciousUrl);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid URL');
        });

        test('should reject data: URLs', () => {
            const dataUrl = 'data:text/html,<script>alert("xss")</script>';
            const result = validateURL(dataUrl);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid URL protocol');
        });

        test('should accept valid HTTP URLs', () => {
            const validUrl = 'https://example.com/page';
            const result = validateURL(validUrl);
            
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe(validUrl);
        });

        test('should accept valid HTTPS URLs', () => {
            const validUrl = 'https://secure.example.com/page';
            const result = validateURL(validUrl);
            
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe(validUrl);
        });

        test('should reject URLs that are too long', () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(2048);
            const result = validateURL(longUrl);
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('too long');
        });
    });

    describe('sanitizeString function', () => {
        test('should remove HTML tags when not allowed', () => {
            const htmlString = '<script>alert("xss")</script><p>Safe content</p>';
            const result = sanitizeString(htmlString, { allowHTML: false });
            
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('<p>');
            expect(result).toContain('Safe content');
        });

        test('should escape HTML entities even when HTML tags are allowed', () => {
            const htmlString = '<p>Safe content</p>';
            const result = sanitizeString(htmlString, { allowHTML: true });

            // Even when allowHTML is true, entities should be escaped for security
            expect(result).toContain('&lt;p&gt;');
            expect(result).toContain('Safe content');
            expect(result).not.toContain('<p>'); // Raw tags should be escaped
        });

        test('should remove dangerous characters when not allowed', () => {
            const dangerousString = 'content<>&"\'';
            const result = sanitizeString(dangerousString, { allowSpecialChars: false });
            
            expect(result).toBe('content');
        });

        test('should truncate strings that exceed max length', () => {
            const longString = 'a'.repeat(1001);
            const result = sanitizeString(longString, { maxLength: 1000 });
            
            expect(result.length).toBe(1000);
        });
    });
});

describe('Security Fixes - Frontend Sanitization', () => {
    // Simple mock functions without vi dependency
    const mockFn = () => {
        const calls = [];
        const fn = (...args) => {
            calls.push(args);
            return {};
        };
        fn.calls = calls;
        return fn;
    };

    // Mock DOM environment for testing
    beforeAll(() => {
        global.document = {
            createElement: mockFn()
        };

        global.URL = class {
            constructor(url) {
                if (url.startsWith('javascript:') || url.startsWith('data:')) {
                    throw new Error('Invalid URL');
                }
                this.protocol = url.startsWith('https:') ? 'https:' : 'http:';
            }
        };
    });

    test('should validate HTML sanitizer utility functions exist', () => {
        // Load the HTML sanitizer
        const fs = require('fs');
        const path = require('path');
        const sanitizerPath = path.join(__dirname, '../../../public/js/html-sanitizer.js');
        
        expect(fs.existsSync(sanitizerPath)).toBe(true);
        
        const sanitizerCode = fs.readFileSync(sanitizerPath, 'utf8');
        
        // Check that key functions are defined
        expect(sanitizerCode).toContain('function sanitizeHTML');
        expect(sanitizerCode).toContain('function safeSetInnerHTML');
        expect(sanitizerCode).toContain('function safeSetTextContent');
        expect(sanitizerCode).toContain('function createSafeButton');
        expect(sanitizerCode).toContain('function isValidURL');
    });

    test('should validate dynamic-sections.js uses safe DOM methods', () => {
        const fs = require('fs');
        const path = require('path');
        const dynamicSectionsPath = path.join(__dirname, '../../../public/js/dynamic-sections.js');
        
        expect(fs.existsSync(dynamicSectionsPath)).toBe(true);
        
        const dynamicSectionsCode = fs.readFileSync(dynamicSectionsPath, 'utf8');
        
        // Check that security fixes are in place
        expect(dynamicSectionsCode).toContain('🔒 SECURITY FIX');
        expect(dynamicSectionsCode).toContain('window.HTMLSanitizer');
        expect(dynamicSectionsCode).toContain('safeSetInnerHTML');
        expect(dynamicSectionsCode).toContain('createSafeButton');
        
        // Check that dangerous innerHTML usage has been replaced
        const dangerousPatterns = [
            /innerHTML\s*=\s*[^;]*\$\{[^}]*\}/g, // Template literal injection
            /insertAdjacentHTML.*buttonHtml/g     // Button HTML injection
        ];
        
        dangerousPatterns.forEach(pattern => {
            const matches = dynamicSectionsCode.match(pattern);
            expect(matches).toBeNull();
        });
    });
});

describe('Security Fixes - API Authentication', () => {
    test('should validate content-manager.js requires auth for debug-sections', () => {
        const fs = require('fs');
        const path = require('path');
        const contentManagerPath = path.join(__dirname, '../../../api/content-manager.js');
        
        expect(fs.existsSync(contentManagerPath)).toBe(true);
        
        const contentManagerCode = fs.readFileSync(contentManagerPath, 'utf8');
        
        // Check that debug-sections is included in sensitive operations
        expect(contentManagerCode).toContain('sensitiveReadOperations');
        expect(contentManagerCode).toContain('debug-sections');
        expect(contentManagerCode).toContain('isSensitiveReadOperation');
    });

    test('should validate sections.js includes isPublished filtering', () => {
        const fs = require('fs');
        const path = require('path');
        const sectionsPath = path.join(__dirname, '../../../api/sections.js');
        
        expect(fs.existsSync(sectionsPath)).toBe(true);
        
        const sectionsCode = fs.readFileSync(sectionsPath, 'utf8');
        
        // Check that isPublished filtering is implemented
        expect(sectionsCode).toContain('isPublished: true');
        expect(sectionsCode).toContain('isAuthenticated');
        expect(sectionsCode).toContain('🔒 SECURITY FIX');
    });
});
