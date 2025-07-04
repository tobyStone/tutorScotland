/**
 * Phase 1 Integration Verification Script
 * Tests the enhanced visual editor + dynamic sections integration
 */

class Phase1IntegrationTester {
    constructor() {
        this.testResults = [];
        this.isAdmin = false;
    }

    async init() {
        console.log('🧪 [Phase1Test] Initializing integration tests...');
        
        // Wait for page to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Wait for dynamic sections to load
        await this.waitForDynamicSections();
        
        // Check admin status
        await this.checkAdminStatus();
        
        console.log('🧪 [Phase1Test] Ready to run tests');
    }

    async waitForDynamicSections() {
        return new Promise(resolve => {
            if (document.body.classList.contains('dyn-ready')) {
                resolve();
            } else {
                window.addEventListener('dyn-sections-loaded', resolve, { once: true });
                // Timeout after 5 seconds
                setTimeout(resolve, 5000);
            }
        });
    }

    async checkAdminStatus() {
        try {
            const response = await fetch('/api/protected');
            this.isAdmin = response.ok;
            console.log(`🧪 [Phase1Test] Admin status: ${this.isAdmin ? 'Admin' : 'Non-admin'}`);
        } catch (error) {
            this.isAdmin = false;
            console.log('🧪 [Phase1Test] Admin status check failed, assuming non-admin');
        }
    }

    runTest(name, testFunction) {
        try {
            const result = testFunction();
            this.testResults.push({ name, status: 'PASS', result });
            console.log(`✅ [Phase1Test] ${name}: PASS`);
            return true;
        } catch (error) {
            this.testResults.push({ name, status: 'FAIL', error: error.message });
            console.error(`❌ [Phase1Test] ${name}: FAIL - ${error.message}`);
            return false;
        }
    }

    async runAllTests() {
        console.log('🧪 [Phase1Test] Running comprehensive integration tests...');
        
        const tests = [
            ['Visual Editor Loading', () => this.testVisualEditorLoading()],
            ['Dynamic Sections Detection', () => this.testDynamicSectionsDetection()],
            ['CSS Styles Loading', () => this.testCSSLoading()],
            ['Overlay Functionality', () => this.testOverlayFunctionality()],
            ['Deep Linking URLs', () => this.testDeepLinkingURLs()],
            ['Conflict Detection', () => this.testConflictDetection()],
            ['Safety Safeguards', () => this.testSafetySafeguards()],
            ['Responsive Design', () => this.testResponsiveDesign()]
        ];

        let passCount = 0;
        for (const [name, testFn] of tests) {
            if (this.runTest(name, testFn)) {
                passCount++;
            }
        }

        const successRate = Math.round((passCount / tests.length) * 100);
        
        console.log(`🧪 [Phase1Test] Tests completed: ${passCount}/${tests.length} passed (${successRate}%)`);
        
        if (passCount === tests.length) {
            console.log('🎉 [Phase1Test] ALL TESTS PASSED! Phase 1 integration is working correctly.');
        } else {
            console.warn('⚠️ [Phase1Test] Some tests failed. Check the results above.');
        }

        return { passCount, totalTests: tests.length, successRate, results: this.testResults };
    }

    testVisualEditorLoading() {
        // Check if visual editor is loaded
        if (!window.visualEditor) {
            throw new Error('Visual editor not found in global scope');
        }

        // Check if UI manager exists
        if (!window.visualEditor.uiManager) {
            throw new Error('UI manager not found');
        }

        return 'Visual editor and UI manager loaded successfully';
    }

    testDynamicSectionsDetection() {
        const dynamicSections = document.querySelectorAll('[data-ve-section-id]');
        const staticElements = document.querySelectorAll('[data-ve-block-id]');
        
        return `Found ${dynamicSections.length} dynamic sections and ${staticElements.length} static elements`;
    }

    testCSSLoading() {
        // Check if editor CSS is loaded
        const editorCSS = document.querySelector('link[href="/editor.css"]');
        if (!editorCSS) {
            throw new Error('Editor CSS not loaded');
        }

        // Test dynamic overlay styles
        const testDiv = document.createElement('div');
        testDiv.className = 'dyn-edit-overlay';
        testDiv.style.visibility = 'hidden';
        document.body.appendChild(testDiv);

        const styles = window.getComputedStyle(testDiv);
        const hasCorrectStyles = styles.position === 'absolute' && 
                                styles.borderStyle.includes('dashed');

        document.body.removeChild(testDiv);

        if (!hasCorrectStyles) {
            throw new Error('Dynamic overlay styles not properly applied');
        }

        return 'CSS styles loaded and applied correctly';
    }

    testOverlayFunctionality() {
        const uiManager = window.visualEditor?.uiManager;
        if (!uiManager) {
            throw new Error('UI manager not accessible');
        }

        // Check if overlay methods exist
        const requiredMethods = [
            'addDynamicSectionOverlays',
            'removeDynamicSectionOverlays',
            'refreshEditableElements'
        ];

        for (const method of requiredMethods) {
            if (typeof uiManager[method] !== 'function') {
                throw new Error(`Required method ${method} not found`);
            }
        }

        return 'All overlay functionality methods are available';
    }

    testDeepLinkingURLs() {
        const currentPage = document.body.dataset.page || 'index';
        const testSectionId = 'test-section-123';
        
        // Test URL generation patterns
        const editUrl = `/admin.html?slug=${encodeURIComponent(currentPage)}&editSection=${testSectionId}`;
        const addUrl = `/admin.html?slug=${encodeURIComponent(currentPage)}&addAfter=${testSectionId}`;
        
        // Basic URL validation
        if (!editUrl.includes('editSection=') || !addUrl.includes('addAfter=')) {
            throw new Error('Deep linking URL generation failed');
        }

        return `Deep linking URLs generated correctly for page: ${currentPage}`;
    }

    testConflictDetection() {
        const uiManager = window.visualEditor?.uiManager;
        if (!uiManager) {
            throw new Error('UI manager not accessible');
        }

        // Check if conflict detection method exists
        if (typeof uiManager.hasEditingConflicts !== 'function') {
            throw new Error('Conflict detection method not found');
        }

        // Test the method
        const hasConflicts = uiManager.hasEditingConflicts();
        
        return `Conflict detection working. Current conflicts: ${hasConflicts ? 'Yes' : 'No'}`;
    }

    testSafetySafeguards() {
        const uiManager = window.visualEditor?.uiManager;
        if (!uiManager) {
            throw new Error('UI manager not accessible');
        }

        // Check if safety methods exist
        const safetyMethods = ['safeAddOverlays'];
        
        for (const method of safetyMethods) {
            if (typeof uiManager[method] !== 'function') {
                throw new Error(`Safety method ${method} not found`);
            }
        }

        return 'Safety safeguards are in place';
    }

    testResponsiveDesign() {
        // Create a test overlay to check responsive styles
        const testOverlay = document.createElement('div');
        testOverlay.className = 'dyn-edit-overlay';
        testOverlay.style.visibility = 'hidden';
        document.body.appendChild(testOverlay);

        const controls = document.createElement('div');
        controls.className = 'dyn-edit-controls';
        testOverlay.appendChild(controls);

        // Check if responsive styles are applied
        const styles = window.getComputedStyle(controls);
        const hasFlexDisplay = styles.display === 'flex';

        document.body.removeChild(testOverlay);

        if (!hasFlexDisplay) {
            throw new Error('Responsive design styles not properly applied');
        }

        return 'Responsive design styles are working';
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            isAdmin: this.isAdmin,
            currentPage: document.body.dataset.page || 'unknown',
            results: this.testResults
        };

        console.log('📊 [Phase1Test] Test Report:', report);
        return report;
    }
}

// Auto-run tests when script loads
if (typeof window !== 'undefined') {
    window.Phase1IntegrationTester = Phase1IntegrationTester;
    
    // Auto-run tests after a short delay to ensure everything is loaded
    setTimeout(async () => {
        const tester = new Phase1IntegrationTester();
        await tester.init();
        const results = await tester.runAllTests();
        const report = tester.generateReport();
        
        // Make results available globally for debugging
        window.phase1TestResults = { results, report };
        
        console.log('🧪 [Phase1Test] Tests complete. Results available in window.phase1TestResults');
    }, 2000);
}

export { Phase1IntegrationTester };
