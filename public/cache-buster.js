/**
 * Cache Buster Utility
 * Adds timestamp-based cache busting to prevent browser caching issues
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
