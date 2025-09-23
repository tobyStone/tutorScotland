/**
 * @fileoverview Security fixes validation tests
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Tests to verify security vulnerabilities are properly addressed:
 * - Debug-sections authentication bypass
 * - Public APIs isPublished filtering
 * - XSS prevention in content rendering
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import models
const Section = require('../../models/Section');

describe('Security Fixes Validation', () => {
    let mongoServer;
    let adminToken;
    let userToken;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test JWT tokens
        const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
        
        adminToken = jwt.sign(
            { id: 'admin123', role: 'admin', username: 'testadmin' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        userToken = jwt.sign(
            { id: 'user123', role: 'user', username: 'testuser' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear database before each test
        await Section.deleteMany({});
        
        // Create test sections with different publication states
        await Section.create([
            {
                page: 'index',
                heading: 'Published Section',
                text: 'This is published content',
                isPublished: true,
                layout: 'standard'
            },
            {
                page: 'index',
                heading: 'Unpublished Section',
                text: 'This is draft content',
                isPublished: false,
                layout: 'standard'
            },
            {
                page: 'index',
                heading: 'Published Video Section',
                text: 'Video description',
                videoUrl: 'https://example.com/video.mp4',
                isPublished: true,
                layout: 'video'
            },
            {
                page: 'index',
                heading: 'Unpublished Video Section',
                text: 'Draft video description',
                videoUrl: 'https://example.com/draft-video.mp4',
                isPublished: false,
                layout: 'video'
            }
        ]);
    });

    describe('Fix 1: Debug-sections authentication bypass', () => {
        test('should require admin authentication for debug-sections operation', async () => {
            const mockReq = {
                method: 'GET',
                query: { operation: 'debug-sections' },
                cookies: {},
                headers: {}
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await contentManagerHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Authentication required for content management',
                    error: 'UNAUTHORIZED_CONTENT_ACCESS'
                })
            );
        });

        test('should allow admin access to debug-sections operation', async () => {
            const mockReq = {
                method: 'GET',
                query: { operation: 'debug-sections' },
                cookies: { token: adminToken },
                headers: {}
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await contentManagerHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    total: expect.any(Number),
                    breakdown: expect.any(Object),
                    sections: expect.any(Object)
                })
            );
        });

        test('should deny non-admin access to debug-sections operation', async () => {
            const mockReq = {
                method: 'GET',
                query: { operation: 'debug-sections' },
                cookies: { token: userToken },
                headers: {}
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await contentManagerHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Admin access required for content management',
                    error: 'INSUFFICIENT_PERMISSIONS'
                })
            );
        });
    });

    describe('Fix 2: Public APIs ignore isPublished flag', () => {
        test('sections API should only return published sections for anonymous users', async () => {
            const mockReq = {
                method: 'GET',
                query: { page: 'index' },
                cookies: {},
                headers: {}
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await sectionsHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            const responseData = mockRes.json.mock.calls[0][0];
            
            // Should only contain published sections
            expect(responseData).toHaveLength(1);
            expect(responseData[0].heading).toBe('Published Section');
            expect(responseData[0].isPublished).toBe(true);
        });

        test('sections API should return all sections for authenticated admin', async () => {
            const mockReq = {
                method: 'GET',
                query: { page: 'index' },
                cookies: { token: adminToken },
                headers: {}
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await sectionsHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            const responseData = mockRes.json.mock.calls[0][0];
            
            // Should contain both published and unpublished sections
            expect(responseData.length).toBeGreaterThan(1);
            const headings = responseData.map(s => s.heading);
            expect(headings).toContain('Published Section');
            expect(headings).toContain('Unpublished Section');
        });

        test('video-sections API should only return published sections for anonymous users', async () => {
            const mockReq = {
                method: 'GET',
                query: { page: 'index' },
                cookies: {},
                headers: {}
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await videoSectionsHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            const responseData = mockRes.json.mock.calls[0][0];
            
            // Should only contain published video sections
            expect(responseData).toHaveLength(1);
            expect(responseData[0].heading).toBe('Published Video Section');
            expect(responseData[0].isPublished).toBe(true);
        });
    });

    describe('Fix 3: Input validation and sanitization', () => {
        test('should reject malicious script content in section creation', async () => {
            const maliciousContent = {
                page: 'index',
                heading: 'Test Section<script>alert("xss")</script>',
                text: '<script>alert("xss")</script><p>Normal content</p>',
                buttonLabel: 'Click<script>alert("xss")</script>',
                buttonUrl: 'javascript:alert("xss")'
            };

            const mockReq = {
                method: 'POST',
                body: maliciousContent,
                cookies: { token: adminToken },
                headers: { 'content-type': 'application/json' }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await sectionsHandler(mockReq, mockRes);

            // Should reject the malicious button URL
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Button URL validation failed')
                })
            );
        });

        test('should sanitize team member data', async () => {
            const maliciousTeamData = {
                page: 'index',
                heading: 'Team Section',
                text: '',
                layout: 'team',
                team: JSON.stringify([
                    {
                        name: 'John<script>alert("xss")</script>',
                        bio: '<script>alert("xss")</script><p>Bio content</p>',
                        quote: 'Quote<script>alert("xss")</script>'
                    }
                ])
            };

            const mockReq = {
                method: 'POST',
                body: maliciousTeamData,
                cookies: { token: adminToken },
                headers: { 'content-type': 'application/json' }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await sectionsHandler(mockReq, mockRes);

            // Should accept the request but sanitize the content
            expect(mockRes.status).toHaveBeenCalledWith(201);
        });
    });
});
