/**
 * CSRF Protection - CI Security Validation Tests
 * 
 * Tests comprehensive Cross-Site Request Forgery protection across all API endpoints
 * Validates origin validation, security headers, and attack prevention
 * 
 * @security Critical security tests for production deployment
 * @coverage CSRF protection, origin validation, security headers
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';

// Import API handlers (using dynamic imports for CommonJS modules)
let loginHandler, uploadHandler;

beforeAll(async () => {
    // Dynamic imports for CommonJS modules
    loginHandler = (await import('../../../api/login.js')).default;
    uploadHandler = (await import('../../../api/upload-image.js')).default;

// Test database setup
let mongoServer;
let testDb;

beforeAll(async () => {
    console.log('🔧 Setting up CSRF protection test environment...');

    // Dynamic imports for CommonJS modules
    loginHandler = (await import('../../../api/login.js')).default;
    uploadHandler = (await import('../../../api/upload-image.js')).default;

    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    testDb = await mongoose.connect(mongoUri);

    console.log('✅ Test database connected');
}, 30000);

afterAll(async () => {
    console.log('🧹 Cleaning up CSRF protection test fixtures');
    
    if (testDb) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
    
    console.log('Test database torn down successfully');
}, 10000);

// Create test apps for different endpoints

function createTestApp(handler) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Add IP extraction middleware
    app.use((req, res, next) => {
        req.ip = req.ip || '127.0.0.1';
        next();
    });
    
    app.all('*', handler);
    return app;
}

const loginApp = createTestApp(loginHandler);
const uploadApp = createTestApp(uploadHandler);

describe('CSRF Protection - CI Security Validation', () => {
    describe('Origin Validation (CI Critical)', () => {
        it('should allow requests from trusted origins', async () => {
            console.log('🚨 CI CRITICAL: Testing trusted origin validation');
            
            const trustedOrigins = [
                'https://tutor-scotland.vercel.app',
                'http://localhost:3000',
                'http://127.0.0.1:3000'
            ];
            
            for (const origin of trustedOrigins) {
                const response = await request(loginApp)
                    .post('/')
                    .set('Origin', origin)
                    .send({ email: 'test@example.com', password: 'testpass' });
                
                // ✅ SECURITY WORKING: Should not be blocked by CSRF (may fail auth, but not CSRF)
                expect([200, 400, 401, 429, 500]).toContain(response.status);
                
                if (response.status === 403) {
                    expect(response.body.code).not.toBe('CSRF_VIOLATION');
                }
                
                console.log(`✅ Trusted origin ${origin}: ${response.status} (ALLOWED)`);
            }
        });

        it('should block requests from untrusted origins', async () => {
            console.log('🚨 CI CRITICAL: Testing untrusted origin blocking');
            
            const untrustedOrigins = [
                'https://malicious-site.com',
                'http://evil.example.com',
                'https://phishing-attack.net'
            ];
            
            for (const origin of untrustedOrigins) {
                const response = await request(loginApp)
                    .post('/')
                    .set('Origin', origin)
                    .send({ email: 'test@example.com', password: 'testpass' });
                
                // ✅ SECURITY WORKING: Should be blocked by CSRF protection
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('code', 'CSRF_VIOLATION');
                expect(response.body).toHaveProperty('message', 'Invalid request origin');
                
                console.log(`✅ Untrusted origin ${origin}: BLOCKED (SECURITY WORKING)`);
            }
        });

        it('should handle missing origin headers appropriately', async () => {
            console.log('🚨 CI CRITICAL: Testing missing origin header handling');
            
            const response = await request(loginApp)
                .post('/')
                .send({ email: 'test@example.com', password: 'testpass' });
            
            // ✅ SECURITY WORKING: Should be blocked when no origin provided
            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('code', 'CSRF_VIOLATION');
            
            console.log('✅ Missing origin header: BLOCKED (SECURITY WORKING)');
        });
    });

    describe('File Upload CSRF Protection (CI Security)', () => {
        it('should protect file upload endpoint with CSRF', async () => {
            console.log('🚨 CI SECURITY: Testing file upload CSRF protection');
            
            // Test with untrusted origin
            const maliciousResponse = await request(uploadApp)
                .post('/')
                .set('Origin', 'https://malicious-uploader.com')
                .attach('file', Buffer.from('fake-image-data'), 'malicious.jpg');
            
            // ✅ SECURITY WORKING: Should be blocked by CSRF protection
            expect(maliciousResponse.status).toBe(403);
            expect(maliciousResponse.body).toHaveProperty('code', 'CSRF_VIOLATION');
            
            console.log('✅ Malicious file upload: BLOCKED (SECURITY WORKING)');
            
            // Test with trusted origin (should pass CSRF but may fail other validation)
            const trustedResponse = await request(uploadApp)
                .post('/')
                .set('Origin', 'http://localhost:3000')
                .attach('file', Buffer.from('fake-image-data'), 'test.jpg');
            
            // ✅ SECURITY WORKING: Should pass CSRF protection
            expect([200, 400, 401, 413, 415, 429, 500]).toContain(trustedResponse.status);
            
            if (trustedResponse.status === 403) {
                expect(trustedResponse.body.code).not.toBe('CSRF_VIOLATION');
            }
            
            console.log(`✅ Trusted file upload: ${trustedResponse.status} (CSRF PASSED)`);
        });
    });

    describe('Security Headers Validation (CI Security)', () => {
        it('should apply comprehensive security headers to API responses', async () => {
            console.log('🚨 CI SECURITY: Testing comprehensive security headers');
            
            const response = await request(loginApp)
                .get('/')
                .set('Origin', 'http://localhost:3000');
            
            // ✅ SECURITY WORKING: Should have comprehensive security headers
            const expectedHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'referrer-policy',
                'permissions-policy',
                'cross-origin-resource-policy',
                'cross-origin-opener-policy'
            ];
            
            for (const header of expectedHeaders) {
                expect(response.headers).toHaveProperty(header);
                console.log(`✅ Security header ${header}: ${response.headers[header]}`);
            }
            
            // Validate specific header values
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
            
            console.log('✅ All comprehensive security headers validated');
        });

        it('should prevent caching of API responses', async () => {
            console.log('🚨 CI SECURITY: Testing API response caching prevention');
            
            const response = await request(loginApp)
                .get('/')
                .set('Origin', 'http://localhost:3000');
            
            // ✅ SECURITY WORKING: Should prevent caching
            expect(response.headers['cache-control']).toContain('no-store');
            expect(response.headers['cache-control']).toContain('no-cache');
            expect(response.headers['pragma']).toBe('no-cache');
            expect(response.headers['expires']).toBe('0');
            
            console.log('✅ API response caching prevention: WORKING');
        });
    });

    describe('CSRF Protection Edge Cases (CI Security)', () => {
        it('should handle referer fallback for origin validation', async () => {
            console.log('🚨 CI SECURITY: Testing referer fallback validation');
            
            const response = await request(loginApp)
                .post('/')
                .set('Referer', 'http://localhost:3000/admin')
                .send({ email: 'test@example.com', password: 'testpass' });
            
            // ✅ SECURITY WORKING: Should use referer as fallback for origin
            expect([200, 400, 401, 429, 500]).toContain(response.status);
            
            if (response.status === 403) {
                expect(response.body.code).not.toBe('CSRF_VIOLATION');
            }
            
            console.log(`✅ Referer fallback validation: ${response.status} (WORKING)`);
        });

        it('should skip CSRF protection for safe HTTP methods', async () => {
            console.log('🚨 CI SECURITY: Testing safe method CSRF bypass');
            
            const response = await request(loginApp)
                .get('/')
                .set('Origin', 'https://malicious-site.com');
            
            // ✅ SECURITY WORKING: GET requests should not be blocked by CSRF
            expect([200, 400, 401, 404, 429, 500]).toContain(response.status);
            
            if (response.status === 403) {
                expect(response.body.code).not.toBe('CSRF_VIOLATION');
            }
            
            console.log(`✅ Safe method CSRF bypass: ${response.status} (CORRECT)`);
        });
    });
});
