/**
 * Quick Context Isolation Verification Script
 * 
 * Run this in the browser console on any page to verify context isolation is working.
 * Usage: Copy and paste into browser console, then run verifyContextIsolation()
 */

function verifyContextIsolation() {
    console.log('🔍 Verifying Context Isolation...');
    
    const results = [];
    
    try {
        // Check if visual editor components are available
        if (!window.overrideEngine) {
            console.error('❌ Override engine not available. Make sure visual editor is loaded.');
            return;
        }
        
        // Test 1: Context Detection
        console.log('\n📍 Testing Context Detection...');
        
        const testElements = [
            { selector: 'header a', expectedContext: 'header', name: 'Header Link' },
            { selector: 'footer a', expectedContext: 'footer', name: 'Footer Link' },
            { selector: 'main a', expectedContext: 'main', name: 'Main Link' },
            { selector: '.main-nav a', expectedContext: 'nav', name: 'Nav Link' }
        ];
        
        testElements.forEach(test => {
            const element = document.querySelector(test.selector);
            if (element) {
                const context = window.overrideEngine.getElementContext(element);
                const status = context === test.expectedContext ? '✅' : '❌';
                console.log(`${status} ${test.name}: ${context} (expected: ${test.expectedContext})`);
                results.push({ test: test.name, status: status === '✅', expected: test.expectedContext, actual: context });
            } else {
                console.log(`⚠️  ${test.name}: Element not found`);
            }
        });
        
        // Test 2: Selector Generation
        console.log('\n🎯 Testing Selector Generation...');
        
        const headerLinks = Array.from(document.querySelectorAll('header a'));
        const footerLinks = Array.from(document.querySelectorAll('footer a'));
        const mainLinks = Array.from(document.querySelectorAll('main a')).slice(0, 3); // Limit to first 3
        
        const allTestLinks = [
            ...headerLinks.map(el => ({ element: el, context: 'header' })),
            ...footerLinks.map(el => ({ element: el, context: 'footer' })),
            ...mainLinks.map(el => ({ element: el, context: 'main' }))
        ];
        
        const selectors = [];
        
        allTestLinks.forEach(({ element, context }, index) => {
            try {
                const selector = window.overrideEngine.getStableSelector(element, 'link');
                selectors.push(selector);
                console.log(`${context.toUpperCase()} Link ${index + 1}: ${selector}`);
            } catch (error) {
                console.log(`❌ Error generating selector for ${context} link: ${error.message}`);
            }
        });
        
        // Test 3: Selector Uniqueness
        console.log('\n🔄 Testing Selector Uniqueness...');
        
        const uniqueSelectors = new Set(selectors);
        const isUnique = uniqueSelectors.size === selectors.length;
        
        console.log(`Total selectors: ${selectors.length}`);
        console.log(`Unique selectors: ${uniqueSelectors.size}`);
        console.log(`${isUnique ? '✅' : '❌'} Uniqueness test: ${isUnique ? 'PASSED' : 'FAILED'}`);
        
        if (!isUnique) {
            // Find duplicates
            const seen = new Set();
            const duplicates = new Set();
            selectors.forEach(selector => {
                if (seen.has(selector)) {
                    duplicates.add(selector);
                } else {
                    seen.add(selector);
                }
            });
            
            console.log('❌ Duplicate selectors found:');
            duplicates.forEach(dup => console.log(`   - ${dup}`));
        }
        
        // Test 4: Context Prefix Verification
        console.log('\n🏷️  Testing Context Prefixes...');
        
        const contextPrefixes = {
            header: selectors.filter(s => s.startsWith('header ')).length,
            footer: selectors.filter(s => s.startsWith('footer ')).length,
            main: selectors.filter(s => !s.startsWith('header ') && !s.startsWith('footer ') && !s.startsWith('.main-nav')).length
        };
        
        console.log('Context prefix distribution:');
        Object.entries(contextPrefixes).forEach(([context, count]) => {
            console.log(`  ${context}: ${count} selectors`);
        });
        
        // Summary
        console.log('\n📊 SUMMARY');
        console.log('='.repeat(40));
        
        const passedTests = results.filter(r => r.status).length;
        const totalTests = results.length;
        const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
        
        console.log(`Context Detection: ${passedTests}/${totalTests} passed (${successRate}%)`);
        console.log(`Selector Uniqueness: ${isUnique ? 'PASSED' : 'FAILED'}`);
        
        if (passedTests === totalTests && isUnique) {
            console.log('🎉 ALL TESTS PASSED - Context isolation is working correctly!');
        } else {
            console.log('⚠️  Some tests failed - Context isolation may have issues');
        }
        
        return {
            contextDetection: { passed: passedTests, total: totalTests, rate: successRate },
            selectorUniqueness: isUnique,
            selectors: selectors,
            summary: passedTests === totalTests && isUnique ? 'PASSED' : 'FAILED'
        };
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        return { error: error.message };
    }
}

// Auto-run if this script is loaded directly
if (typeof window !== 'undefined') {
    console.log('Context isolation verification script loaded.');
    console.log('Run verifyContextIsolation() to test the current page.');
    
    // Make it available globally
    window.verifyContextIsolation = verifyContextIsolation;
}
