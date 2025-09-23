/**
 * @fileoverview Pre-authentication exposure security tests
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Integration tests to verify that privileged content is not exposed
 * to unauthenticated users before authentication checks complete.
 * 
 * These tests address the red team findings about admin and blog writer interfaces
 * being visible before authentication verification.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs').promises;
const path = require('path');

describe('Pre-Authentication Exposure Security', () => {
    describe('Admin Dashboard Security', () => {
        let adminHtml;
        let dom;
        let document;

        beforeAll(async () => {
            // Load the admin.html file
            const adminPath = path.join(__dirname, '../../../public/admin.html');
            adminHtml = await fs.readFile(adminPath, 'utf8');
        });

        beforeEach(() => {
            // Create a fresh DOM for each test
            dom = new JSDOM(adminHtml, {
                runScripts: 'dangerously',
                resources: 'usable',
                pretendToBeVisual: true
            });
            document = dom.window.document;
            
            // Mock fetch to simulate authentication failure
            dom.window.fetch = async (url) => {
                if (url.includes('/api/protected')) {
                    return {
                        ok: false,
                        status: 401,
                        text: async () => 'Unauthorized'
                    };
                }
                throw new Error('Unexpected fetch call');
            };
        });

        afterEach(() => {
            dom.window.close();
        });

        test('should hide admin dashboard content by default', () => {
            const adminDashboard = document.getElementById('admin-dashboard');
            const authLoading = document.getElementById('auth-loading');
            
            expect(adminDashboard).toBeTruthy();
            expect(authLoading).toBeTruthy();
            
            // Admin dashboard should be hidden by default
            expect(adminDashboard.style.display).toBe('none');
            
            // Loading screen should be visible
            expect(authLoading.style.display).not.toBe('none');
        });

        test('should not expose sensitive form elements in initial HTML', () => {
            // Check that sensitive elements are inside the hidden dashboard
            const adminDashboard = document.getElementById('admin-dashboard');
            
            // These elements should exist but be hidden inside the dashboard
            const tutorForm = adminDashboard.querySelector('form[id*="tutor"]');
            const sectionForm = adminDashboard.querySelector('form[id*="section"]');
            const tutorTable = adminDashboard.querySelector('#tutorTable');
            
            // Elements should exist in the hidden dashboard
            expect(tutorForm || sectionForm || tutorTable).toBeTruthy();
            
            // But the dashboard itself should be hidden
            expect(adminDashboard.style.display).toBe('none');
        });

        test('should show loading message while auth check is pending', () => {
            const authLoading = document.getElementById('auth-loading');
            const loadingText = authLoading.textContent;
            
            expect(loadingText).toContain('Verifying admin access');
            expect(authLoading.style.display).not.toBe('none');
        });
    });

    describe('Blog Writer Security', () => {
        let blogWriterHtml;
        let dom;
        let document;

        beforeAll(async () => {
            // Load the blogWriter.html file
            const blogWriterPath = path.join(__dirname, '../../../public/blogWriter.html');
            blogWriterHtml = await fs.readFile(blogWriterPath, 'utf8');
        });

        beforeEach(() => {
            // Create a fresh DOM for each test
            dom = new JSDOM(blogWriterHtml, {
                runScripts: 'dangerously',
                resources: 'usable',
                pretendToBeVisual: true
            });
            document = dom.window.document;
            
            // Mock fetch to simulate authentication failure
            dom.window.fetch = async (url) => {
                if (url.includes('/api/protected')) {
                    return {
                        ok: false,
                        status: 401,
                        text: async () => 'Unauthorized'
                    };
                }
                throw new Error('Unexpected fetch call');
            };
        });

        afterEach(() => {
            dom.window.close();
        });

        test('should hide blog writer dashboard content by default', () => {
            const blogWriterDashboard = document.getElementById('blog-writer-dashboard');
            const authLoading = document.getElementById('auth-loading');
            
            expect(blogWriterDashboard).toBeTruthy();
            expect(authLoading).toBeTruthy();
            
            // Blog writer dashboard should be hidden by default
            expect(blogWriterDashboard.style.display).toBe('none');
            
            // Loading screen should be visible
            expect(authLoading.style.display).not.toBe('none');
        });

        test('should not expose blog editing forms in initial HTML', () => {
            // Check that sensitive elements are inside the hidden dashboard
            const blogWriterDashboard = document.getElementById('blog-writer-dashboard');
            
            // These elements should exist but be hidden inside the dashboard
            const blogForm = blogWriterDashboard.querySelector('form');
            const blogTable = blogWriterDashboard.querySelector('table');
            
            // Elements should exist in the hidden dashboard
            expect(blogForm || blogTable).toBeTruthy();
            
            // But the dashboard itself should be hidden
            expect(blogWriterDashboard.style.display).toBe('none');
        });

        test('should show loading message while auth check is pending', () => {
            const authLoading = document.getElementById('auth-loading');
            const loadingText = authLoading.textContent;
            
            expect(loadingText).toContain('Verifying blog writer access');
            expect(authLoading.style.display).not.toBe('none');
        });
    });

    describe('Debug Sections Security', () => {
        test('should not expose debug-sections.html in production', async () => {
            const debugPath = path.join(__dirname, '../../../public/debug-sections.html');
            const rootDebugPath = path.join(__dirname, '../../../debug-sections.html');
            
            // Check that debug-sections.html doesn't exist in public or root
            let publicExists = true;
            let rootExists = true;
            
            try {
                await fs.access(debugPath);
            } catch {
                publicExists = false;
            }
            
            try {
                await fs.access(rootDebugPath);
            } catch {
                rootExists = false;
            }
            
            // Debug file should not exist in either location
            expect(publicExists).toBe(false);
            expect(rootExists).toBe(false);
        });
    });
});
