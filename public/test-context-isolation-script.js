/**
 * Context Isolation Test Script
 * 
 * This script tests the context-aware selector system to ensure that:
 * 1. Header, main, and footer links are properly isolated
 * 2. Identical URLs in different contexts generate unique selectors
 * 3. Context detection works correctly
 * 4. No cross-contamination occurs when editing
 */

class ContextIsolationTester {
    constructor() {
        this.results = [];
        this.testCases = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        this.results.push(logEntry);
        console.log(logEntry);
    }

    async runAllTests() {
        this.log('Starting Context Isolation Tests', 'test');
        
        try {
            await this.testContextDetection();
            await this.testSelectorGeneration();
            await this.testSelectorUniqueness();
            await this.testEditableElementScanning();
            await this.testLinkDisabling();
            
            this.log('All tests completed', 'test');
            this.generateReport();
            
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
        }
    }

    async testContextDetection() {
        this.log('Testing context detection...', 'test');
        
        const testElements = [
            { selector: 'header a[href="/contact.html"]', expectedContext: 'header' },
            { selector: 'main a[href="/contact.html"]', expectedContext: 'main' },
            { selector: 'footer a[href="/contact.html"]', expectedContext: 'footer' },
            { selector: '.main-nav a', expectedContext: 'nav' }
        ];

        for (const test of testElements) {
            const element = document.querySelector(test.selector);
            if (!element) {
                this.log(`❌ Element not found: ${test.selector}`, 'error');
                continue;
            }

            const actualContext = window.testComponents?.overrideEngine?.getElementContext(element);
            if (actualContext === test.expectedContext) {
                this.log(`✅ Context detection: ${test.selector} → ${actualContext}`, 'pass');
            } else {
                this.log(`❌ Context detection failed: ${test.selector} → expected ${test.expectedContext}, got ${actualContext}`, 'fail');
            }
        }
    }

    async testSelectorGeneration() {
        this.log('Testing selector generation...', 'test');
        
        const testLinks = [
            document.querySelector('header a[href="/contact.html"]'),
            document.querySelector('main a[href="/contact.html"]'),
            document.querySelector('footer a[href="/contact.html"]')
        ];

        const selectors = [];
        
        for (const link of testLinks) {
            if (!link) {
                this.log('❌ Test link not found', 'error');
                continue;
            }

            const selector = window.testComponents?.overrideEngine?.getStableSelector(link, 'link');
            selectors.push(selector);
            
            const context = window.testComponents?.overrideEngine?.getElementContext(link);
            this.log(`Selector for ${context} context: ${selector}`, 'info');
        }

        return selectors;
    }

    async testSelectorUniqueness() {
        this.log('Testing selector uniqueness...', 'test');
        
        const selectors = await this.testSelectorGeneration();
        const uniqueSelectors = new Set(selectors);
        
        if (uniqueSelectors.size === selectors.length) {
            this.log(`✅ All ${selectors.length} selectors are unique`, 'pass');
        } else {
            this.log(`❌ Selector collision detected: ${selectors.length} selectors, ${uniqueSelectors.size} unique`, 'fail');
            
            // Find duplicates
            const seen = new Set();
            const duplicates = new Set();
            for (const selector of selectors) {
                if (seen.has(selector)) {
                    duplicates.add(selector);
                } else {
                    seen.add(selector);
                }
            }
            
            duplicates.forEach(dup => {
                this.log(`❌ Duplicate selector: ${dup}`, 'fail');
            });
        }
    }

    async testEditableElementScanning() {
        this.log('Testing editable element scanning...', 'test');
        
        if (!window.testComponents?.uiManager) {
            this.log('❌ UI Manager not available', 'error');
            return;
        }

        const editableElements = window.testComponents.uiManager.scanEditableElements();
        
        // Count elements by context
        const contextCounts = {
            header: 0,
            main: 0,
            footer: 0,
            nav: 0
        };

        editableElements.forEach(el => {
            const context = window.testComponents.overrideEngine.getElementContext(el);
            contextCounts[context] = (contextCounts[context] || 0) + 1;
        });

        this.log(`Editable elements found: ${editableElements.length}`, 'info');
        Object.entries(contextCounts).forEach(([context, count]) => {
            if (count > 0) {
                this.log(`  ${context}: ${count} elements`, 'info');
            }
        });

        // Verify header and footer links are included
        const headerLinks = editableElements.filter(el => el.closest('header') && el.tagName === 'A');
        const footerLinks = editableElements.filter(el => el.closest('footer') && el.tagName === 'A');
        const navLinks = editableElements.filter(el => el.closest('.main-nav') && el.tagName === 'A');

        if (headerLinks.length > 0) {
            this.log(`✅ Header links included: ${headerLinks.length}`, 'pass');
        } else {
            this.log('❌ No header links found in editable elements', 'fail');
        }

        if (footerLinks.length > 0) {
            this.log(`✅ Footer links included: ${footerLinks.length}`, 'pass');
        } else {
            this.log('❌ No footer links found in editable elements', 'fail');
        }

        if (navLinks.length === 0) {
            this.log('✅ Navigation links properly excluded', 'pass');
        } else {
            this.log(`❌ Navigation links should be excluded but found ${navLinks.length}`, 'fail');
        }
    }

    async testLinkDisabling() {
        this.log('Testing link disabling in edit mode...', 'test');
        
        // Get original hrefs
        const testLinks = [
            document.querySelector('header a[href="/contact.html"]'),
            document.querySelector('main a[href="/contact.html"]'),
            document.querySelector('footer a[href="/contact.html"]'),
            document.querySelector('.main-nav a') // Should not be disabled
        ];

        const originalHrefs = testLinks.map(link => link?.href);

        // Simulate entering edit mode
        if (window.testComponents?.uiManager) {
            window.testComponents.uiManager.disableLinks();
            
            // Check if links are disabled (except nav)
            testLinks.forEach((link, index) => {
                if (!link) return;
                
                const isNav = link.closest('.main-nav');
                const isDisabled = link.href === 'javascript:void(0)';
                const hasOriginal = link.dataset.originalHref;
                
                if (isNav) {
                    if (!isDisabled) {
                        this.log(`✅ Navigation link not disabled: ${link.href}`, 'pass');
                    } else {
                        this.log(`❌ Navigation link should not be disabled`, 'fail');
                    }
                } else {
                    if (isDisabled && hasOriginal) {
                        this.log(`✅ Link properly disabled: ${link.dataset.originalHref} → ${link.href}`, 'pass');
                    } else {
                        this.log(`❌ Link not properly disabled: ${link.href}`, 'fail');
                    }
                }
            });

            // Re-enable links
            window.testComponents.uiManager.enableLinks();
            
            // Verify links are restored
            testLinks.forEach((link, index) => {
                if (!link || originalHrefs[index] === undefined) return;
                
                if (link.href === originalHrefs[index]) {
                    this.log(`✅ Link restored: ${link.href}`, 'pass');
                } else {
                    this.log(`❌ Link not restored: expected ${originalHrefs[index]}, got ${link.href}`, 'fail');
                }
            });
        }
    }

    generateReport() {
        const passCount = this.results.filter(r => r.includes('✅')).length;
        const failCount = this.results.filter(r => r.includes('❌')).length;
        const totalTests = passCount + failCount;
        
        this.log('='.repeat(50), 'test');
        this.log('CONTEXT ISOLATION TEST REPORT', 'test');
        this.log('='.repeat(50), 'test');
        this.log(`Total Tests: ${totalTests}`, 'test');
        this.log(`Passed: ${passCount}`, 'test');
        this.log(`Failed: ${failCount}`, 'test');
        this.log(`Success Rate: ${totalTests > 0 ? Math.round((passCount / totalTests) * 100) : 0}%`, 'test');
        
        if (failCount === 0) {
            this.log('🎉 ALL TESTS PASSED - Context isolation is working correctly!', 'pass');
        } else {
            this.log('⚠️  Some tests failed - Review the failures above', 'fail');
        }
        
        // Display results in the test page if available
        const testOutput = document.getElementById('test-output');
        if (testOutput) {
            const summary = `Tests: ${totalTests} | Passed: ${passCount} | Failed: ${failCount}`;
            const status = failCount === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED';
            testOutput.innerHTML = `${status}<br>${summary}<br><small>Check console for details</small>`;
        }
    }
}

// Make tester available globally
window.ContextIsolationTester = ContextIsolationTester;

// Auto-run tests when page loads (if test components are available)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.testComponents) {
            const tester = new ContextIsolationTester();
            window.contextTester = tester;
            console.log('Context isolation tester ready. Run window.contextTester.runAllTests() to test.');
        }
    }, 1000);
});

// Override the simple test function
window.runContextTest = function() {
    if (window.contextTester) {
        window.contextTester.runAllTests();
    } else {
        console.error('Context tester not available');
    }
};
