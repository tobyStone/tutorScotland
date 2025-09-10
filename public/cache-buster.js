/**
 * @fileoverview Cache busting utility for preventing browser caching issues
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Client-side cache busting system:
 * - Adds timestamp-based cache busting parameters
 * - Prevents browser caching of dynamic content
 * - Hour-based timestamp generation for efficiency
 * - Automatic script and stylesheet cache busting
 *
 * @performance Implements efficient hour-based cache invalidation
 */

(function() {
    'use strict';
    
    // Generate a cache-busting timestamp (updates every hour)
    const cacheTimestamp = Math.floor(Date.now() / (1000 * 60 * 60)); // Hour-based
    
    console.log('🔄 Cache Buster active - timestamp:', cacheTimestamp);
    
    // Function to add cache busting to URLs
    function addCacheBuster(url) {
        if (url.includes('?')) {
            return url + '&cb=' + cacheTimestamp;
        } else {
            return url + '?cb=' + cacheTimestamp;
        }
    }
    
    // Add cache busting to dynamically loaded scripts
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        
        if (tagName.toLowerCase() === 'script') {
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name, value) {
                if (name === 'src' && value.includes('/js/') && !value.includes('cb=')) {
                    value = addCacheBuster(value);
                    console.log('🔄 Cache-busted script:', value);
                }
                return originalSetAttribute.call(this, name, value);
            };
        }
        
        return element;
    };
    
    // Export for manual use
    window.cacheBuster = {
        addTimestamp: addCacheBuster,
        timestamp: cacheTimestamp
    };
    
})();
