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

        beforeAll(async () => {
            // Load the admin.html file
            const adminPath = path.join(__dirname, '../../../public/admin.html');
            adminHtml = await fs.readFile(adminPath, 'utf8');
        });

        test('should serve minimal redirect page with no sensitive content', () => {
            // 🔒 SECURITY: Public admin.html should only contain redirect, no sensitive forms
            expect(adminHtml).toContain('window.location.href = \'/admin\'');
            expect(adminHtml).toContain('Redirecting to secure admin portal');

            // Should NOT contain any sensitive admin content
            expect(adminHtml).not.toContain('admin-dashboard');
            expect(adminHtml).not.toContain('addSection');
            expect(adminHtml).not.toContain('tutorTable');
            expect(adminHtml).not.toContain('Manage Content');
            expect(adminHtml).not.toContain('Manage Tutors');
            expect(adminHtml).not.toContain('sectionLayout');
            expect(adminHtml).not.toContain('pageSelect');
        });

        test('should not expose any form elements in public HTML', () => {
            // 🔒 SECURITY: No forms should be present in the public redirect page
            expect(adminHtml).not.toContain('<form');
            expect(adminHtml).not.toContain('enctype="multipart/form-data"');
            expect(adminHtml).not.toContain('input type="file"');
            expect(adminHtml).not.toContain('textarea');
            expect(adminHtml).not.toContain('select');
        });

        test('should have immediate redirect script', () => {
            // 🔒 SECURITY: Should redirect immediately to server-authenticated endpoint
            expect(adminHtml).toContain('<script>');
            expect(adminHtml).toContain('window.location.href = \'/admin\'');
            expect(adminHtml).not.toContain('fetch(\'/api/protected');
        });
    });

    describe('Blog Writer Security', () => {
        let blogWriterHtml;

        beforeAll(async () => {
            // Load the blogWriter.html file
            const blogWriterPath = path.join(__dirname, '../../../public/blogWriter.html');
            blogWriterHtml = await fs.readFile(blogWriterPath, 'utf8');
        });

        test('should serve minimal redirect page with no sensitive content', () => {
            // 🔒 SECURITY: Public blogWriter.html should only contain redirect, no sensitive forms
            expect(blogWriterHtml).toContain('window.location.href = \'/blog-writer\'');
            expect(blogWriterHtml).toContain('Redirecting to secure blog writer portal');

            // Should NOT contain any sensitive blog writer content
            expect(blogWriterHtml).not.toContain('blog-writer-dashboard');
            expect(blogWriterHtml).not.toContain('blogForm');
            expect(blogWriterHtml).not.toContain('blogTitle');
            expect(blogWriterHtml).not.toContain('blogContent');
            expect(blogWriterHtml).not.toContain('Manage Blogs');
            expect(blogWriterHtml).not.toContain('Existing Blogs');
        });

        test('should not expose any form elements in public HTML', () => {
            // 🔒 SECURITY: No forms should be present in the public redirect page
            expect(blogWriterHtml).not.toContain('<form');
            expect(blogWriterHtml).not.toContain('enctype="multipart/form-data"');
            expect(blogWriterHtml).not.toContain('input type="file"');
            expect(blogWriterHtml).not.toContain('textarea');
            expect(blogWriterHtml).not.toContain('blogTitle');
            expect(blogWriterHtml).not.toContain('blogContent');
        });

        test('should have immediate redirect script', () => {
            // 🔒 SECURITY: Should redirect immediately to server-authenticated endpoint
            expect(blogWriterHtml).toContain('<script>');
            expect(blogWriterHtml).toContain('window.location.href = \'/blog-writer\'');
            expect(blogWriterHtml).not.toContain('fetch(\'/api/protected');
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

        test('should not expose demo-context-indicators.html in production', async () => {
            const demoPath = path.join(__dirname, '../../../public/demo-context-indicators.html');

            // Check that demo-context-indicators.html doesn't exist in public
            let demoExists = true;

            try {
                await fs.access(demoPath);
            } catch {
                demoExists = false;
            }

            // Demo file should not exist
            expect(demoExists).toBe(false);
        });
    });

    describe('Server-Side Authentication Security', () => {
        test('should serve minimal redirect page for public admin.html', async () => {
            const adminPath = path.join(__dirname, '../../../public/admin.html');
            const adminHtml = await fs.readFile(adminPath, 'utf8');

            // Should contain redirect script and minimal content
            expect(adminHtml).toContain('window.location.href = \'/admin\'');
            expect(adminHtml).toContain('Redirecting to secure admin portal');

            // Should NOT contain sensitive admin forms or content
            expect(adminHtml).not.toContain('addSection');
            expect(adminHtml).not.toContain('tutorTable');
            expect(adminHtml).not.toContain('admin-dashboard');
            expect(adminHtml).not.toContain('Manage Content');
            expect(adminHtml).not.toContain('Manage Tutors');
        });

        test('should serve minimal redirect page for public blogWriter.html', async () => {
            const blogWriterPath = path.join(__dirname, '../../../public/blogWriter.html');
            const blogWriterHtml = await fs.readFile(blogWriterPath, 'utf8');

            // Should contain redirect script and minimal content
            expect(blogWriterHtml).toContain('window.location.href = \'/blog-writer\'');
            expect(blogWriterHtml).toContain('Redirecting to secure blog writer portal');

            // Should NOT contain sensitive blog writer forms or content
            expect(blogWriterHtml).not.toContain('blogForm');
            expect(blogWriterHtml).not.toContain('blogTitle');
            expect(blogWriterHtml).not.toContain('blogContent');
            expect(blogWriterHtml).not.toContain('Manage Blogs');
            expect(blogWriterHtml).not.toContain('Existing Blogs');
        });

        test('should have secure templates in templates directory', async () => {
            const adminTemplatePath = path.join(__dirname, '../../../templates/admin-dashboard.html');
            const blogTemplatePath = path.join(__dirname, '../../../templates/blog-writer-dashboard.html');
            const tutorTemplatePath = path.join(__dirname, '../../../templates/tutor-zone-dashboard.html');

            // Templates should exist
            let adminTemplateExists = true;
            let blogTemplateExists = true;
            let tutorTemplateExists = true;

            try {
                await fs.access(adminTemplatePath);
            } catch {
                adminTemplateExists = false;
            }

            try {
                await fs.access(blogTemplatePath);
            } catch {
                blogTemplateExists = false;
            }

            try {
                await fs.access(tutorTemplatePath);
            } catch {
                tutorTemplateExists = false;
            }

            expect(adminTemplateExists).toBe(true);
            expect(blogTemplateExists).toBe(true);
            expect(tutorTemplateExists).toBe(true);

            // Templates should contain the actual dashboard content
            if (adminTemplateExists) {
                const adminTemplate = await fs.readFile(adminTemplatePath, 'utf8');
                expect(adminTemplate).toContain('admin-dashboard');
                expect(adminTemplate).toContain('Manage Content');
            }

            if (blogTemplateExists) {
                const blogTemplate = await fs.readFile(blogTemplatePath, 'utf8');
                expect(blogTemplate).toContain('blog-writer-dashboard');
                expect(blogTemplate).toContain('Manage Blogs'); // Updated to match current template
            }

            if (tutorTemplateExists) {
                const tutorTemplate = await fs.readFile(tutorTemplatePath, 'utf8');
                expect(tutorTemplate).toContain('tutorzone-page');
                expect(tutorTemplate).toContain('Resources for Tutors');
            }
        });

        test('should serve minimal redirect page for public tutorszone.html', async () => {
            const tutorzonePath = path.join(__dirname, '../../../public/tutorszone.html');
            const tutorzoneHtml = await fs.readFile(tutorzonePath, 'utf8');

            // Should contain redirect script and minimal content
            expect(tutorzoneHtml).toContain('window.location.href = \'/tutorszone\'');
            expect(tutorzoneHtml).toContain('Redirecting to secure tutor zone');

            // Should NOT contain sensitive tutor content
            expect(tutorzoneHtml).not.toContain('Resources for Tutors');
            expect(tutorzoneHtml).not.toContain('Professional Development');
            expect(tutorzoneHtml).not.toContain('Connect with Fellow Tutors');
            expect(tutorzoneHtml).not.toContain('Training & Certification');
            expect(tutorzoneHtml).not.toContain('resource-list');
        });
    });

    describe('API Security', () => {
        test('should require authentication for content-manager overrides operation', async () => {
            // This test would need to be run against a real server
            // For now, we'll test that the sensitiveReadOperations array includes overrides
            const contentManagerPath = path.join(__dirname, '../../../api/content-manager.js');
            const contentManagerCode = await fs.readFile(contentManagerPath, 'utf8');

            // Check that overrides is in sensitiveReadOperations
            expect(contentManagerCode).toContain("'overrides'");
            expect(contentManagerCode).toContain("sensitiveReadOperations");
        });

        test('should require authentication for content-manager list-images operation', async () => {
            const contentManagerPath = path.join(__dirname, '../../../api/content-manager.js');
            const contentManagerCode = await fs.readFile(contentManagerPath, 'utf8');

            // Check that list-images is in sensitiveReadOperations
            expect(contentManagerCode).toContain("'list-images'");
            expect(contentManagerCode).toContain("sensitiveReadOperations");
        });

        test('should have proper authentication checks in protected.js for tutor role', async () => {
            const protectedPath = path.join(__dirname, '../../../api/protected.js');
            const protectedCode = await fs.readFile(protectedPath, 'utf8');

            // Check that tutor role is supported for HTML serving
            expect(protectedCode).toContain("requiredRole === 'tutor'");
            expect(protectedCode).toContain('tutor-zone-dashboard.html');
        });

        test('should protect section order API behind authentication', async () => {
            const contentManagerPath = path.join(__dirname, '../../../api/content-manager.js');
            const contentManagerCode = await fs.readFile(contentManagerPath, 'utf8');

            // Check that get-order is in sensitiveReadOperations
            expect(contentManagerCode).toContain("'get-order'");
            expect(contentManagerCode).toContain("sensitiveReadOperations");
        });
    });

    describe('Visual Editor Security', () => {
        test('should use secure bootstrap instead of direct visual editor loading', async () => {
            const publicFiles = [
                'public/contact.html',
                'public/page-template.html',
                'public/about-us.html',
                'public/index.html',
                'public/login.html',
                'public/page.html',
                'public/parents.html',
                'public/partnerships.html',
                'public/publicConnect.html',
                // 'public/tutorConnect.html', // Now redirects to external MemberMojo
                'public/tutorDirectory.html',
                'public/tutorMembership.html'
            ];

            for (const filePath of publicFiles) {
                const fullPath = path.join(__dirname, '../../../', filePath);
                const content = await fs.readFile(fullPath, 'utf8');

                // Should use bootstrap, not direct visual editor
                expect(content).toContain('visual-editor-bootstrap.js');
                expect(content).not.toContain('visual-editor-v2.js');
            }
        });

        test('should have secure bootstrap script that checks authentication', async () => {
            const bootstrapPath = path.join(__dirname, '../../../public/js/visual-editor-bootstrap.js');
            const bootstrapCode = await fs.readFile(bootstrapPath, 'utf8');

            // Should check admin authentication before loading
            expect(bootstrapCode).toContain('checkAdminAuth');
            expect(bootstrapCode).toContain('/api/protected?role=admin');
            expect(bootstrapCode).toContain('Not authenticated as admin - visual editor not loaded');
        });

        test('should have conditional initialization in visual editor', async () => {
            const visualEditorPath = path.join(__dirname, '../../../public/js/visual-editor-v2.js');
            const visualEditorCode = await fs.readFile(visualEditorPath, 'utf8');

            // Should have conditional initialization logic
            expect(visualEditorCode).toContain('initializeVisualEditor');
            expect(visualEditorCode).toContain('authentication required');
        });

        test('should allow direct loading in admin dashboard template', async () => {
            const adminTemplatePath = path.join(__dirname, '../../../templates/admin-dashboard.html');
            const adminTemplate = await fs.readFile(adminTemplatePath, 'utf8');

            // Admin template should directly load visual editor (already authenticated)
            expect(adminTemplate).toContain('visual-editor-v2.js');
        });
    });
});
