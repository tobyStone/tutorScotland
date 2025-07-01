// Test Fix Verification Script
// This script helps verify that the image persistence fixes are working

class FixVerification {
    constructor() {
        this.overrideApplications = [];
        this.imageOverrides = [];
        this.startTime = Date.now();
        this.setupLogging();
    }

    setupLogging() {
        // Intercept console.log to track visual editor activity
        const originalLog = console.log;
        const self = this;
        
        console.log = function(...args) {
            originalLog.apply(console, args);
            
            const message = args.join(' ');
            const timestamp = Date.now() - self.startTime;
            
            // Track override applications
            if (message.includes('[VE-DBG] applyOverride')) {
                self.overrideApplications.push({
                    timestamp,
                    message,
                    type: message.includes('→ image') ? 'image' : 'other'
                });
                
                if (message.includes('→ image')) {
                    self.imageOverrides.push({
                        timestamp,
                        message,
                        selector: self.extractSelector(message)
                    });
                }
            }
            
            // Track completion events
            if (message.includes('ve-overrides-done')) {
                self.logCompletionEvent(timestamp);
            }
        };
    }

    extractSelector(message) {
        const match = message.match(/\[([^\]]+)\]/);
        return match ? match[1] : 'unknown';
    }

    logCompletionEvent(timestamp) {
        console.log(`%c[FIX-VERIFY] Override completion at ${timestamp}ms`, 'color: green; font-weight: bold;');
    }

    generateReport() {
        const report = {
            totalOverrides: this.overrideApplications.length,
            imageOverrides: this.imageOverrides.length,
            uniqueImageSelectors: [...new Set(this.imageOverrides.map(o => o.selector))],
            timespan: Date.now() - this.startTime,
            hasLoop: this.detectLoop(),
            timeline: this.overrideApplications
        };

        console.log('%c[FIX-VERIFY] REPORT:', 'color: blue; font-weight: bold;', report);
        
        if (report.hasLoop) {
            console.error('%c[FIX-VERIFY] ⚠️ LOOP DETECTED! Multiple applications of same image override.', 'color: red; font-weight: bold;');
        } else {
            console.log('%c[FIX-VERIFY] ✅ No loops detected. Fix appears to be working!', 'color: green; font-weight: bold;');
        }

        return report;
    }

    detectLoop() {
        // Check if the same image selector has been applied multiple times
        const selectorCounts = {};
        this.imageOverrides.forEach(override => {
            selectorCounts[override.selector] = (selectorCounts[override.selector] || 0) + 1;
        });

        return Object.values(selectorCounts).some(count => count > 1);
    }

    // Public method to get current status
    getStatus() {
        return {
            overrideCount: this.overrideApplications.length,
            imageOverrideCount: this.imageOverrides.length,
            hasLoop: this.detectLoop(),
            runtime: Date.now() - this.startTime
        };
    }
}

// Initialize verification when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.fixVerification = new FixVerification();
        console.log('%c[FIX-VERIFY] Verification started. Use fixVerification.generateReport() to see results.', 'color: blue;');
    });
} else {
    window.fixVerification = new FixVerification();
    console.log('%c[FIX-VERIFY] Verification started. Use fixVerification.generateReport() to see results.', 'color: blue;');
}

// Auto-generate report after 10 seconds
setTimeout(() => {
    if (window.fixVerification) {
        console.log('%c[FIX-VERIFY] Auto-generating report after 10 seconds...', 'color: blue;');
        window.fixVerification.generateReport();
    }
}, 10000);
