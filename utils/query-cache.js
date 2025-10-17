/**
 * Query Cache Utility for TutorScotland
 * Implements in-memory caching for MongoDB queries to reduce database load
 * 
 * Features:
 * - TTL-based expiration (default 5 minutes)
 * - Pattern-based invalidation
 * - LRU eviction when cache grows too large
 * - Automatic cleanup of expired entries
 * - Disabled in test environment
 */

class QueryCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
        this.maxEntries = 500; // Prevent memory overflow
        this.maxMemoryMB = 100; // Approximate max memory usage
        
        // Disable caching in test environment
        this.enabled = process.env.NODE_ENV !== 'test';
        
        // Start periodic cleanup
        this.startCleanup();
    }

    /**
     * Generate cache key from collection name and query parameters
     */
    generateKey(collection, query, options = {}) {
        const queryStr = JSON.stringify(query);
        const optionsStr = JSON.stringify(options);
        return `${collection}:${queryStr}:${optionsStr}`;
    }

    /**
     * Get cached result
     * @returns {*|null} Cached data or null if not found/expired
     */
    get(key) {
        if (!this.enabled) return null;
        
        const cached = this.cache.get(key);
        if (!cached) return null;

        // Check if expired
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        console.log(`✅ Cache HIT: ${key.substring(0, 80)}...`);
        return cached.data;
    }

    /**
     * Set cache result
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, data, ttl = this.defaultTTL) {
        if (!this.enabled) return;
        
        // Enforce max entries limit (LRU eviction)
        if (this.cache.size >= this.maxEntries) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            console.log(`🗑️ Cache EVICTED (LRU): ${firstKey.substring(0, 80)}...`);
        }
        
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now(),
            size: this._estimateSize(data)
        });
        
        console.log(`📦 Cache SET: ${key.substring(0, 80)}... (TTL: ${ttl}ms)`);
    }

    /**
     * Invalidate cache entries matching a pattern
     * @param {string} pattern - Pattern to match (e.g., 'tutors', 'blogs')
     * @returns {number} Number of entries invalidated
     */
    invalidate(pattern) {
        if (!this.enabled) return 0;
        
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        
        if (count > 0) {
            console.log(`🗑️ Cache INVALIDATED: ${pattern} (${count} entries)`);
        }
        
        return count;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🧹 Cache CLEARED: ${size} entries removed`);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const entries = Array.from(this.cache.entries());
        const totalSize = entries.reduce((sum, [, value]) => sum + (value.size || 0), 0);
        
        return {
            enabled: this.enabled,
            size: this.cache.size,
            maxEntries: this.maxEntries,
            totalSizeKB: Math.round(totalSize / 1024),
            entries: entries.map(([key, value]) => ({
                key: key.substring(0, 100),
                expiresIn: Math.max(0, value.expiresAt - Date.now()),
                sizeKB: Math.round((value.size || 0) / 1024)
            }))
        };
    }

    /**
     * Start periodic cleanup of expired entries
     */
    startCleanup() {
        // Run cleanup every 10 minutes
        setInterval(() => {
            if (!this.enabled) return;
            
            let removed = 0;
            const now = Date.now();
            
            for (const [key, value] of this.cache.entries()) {
                if (now > value.expiresAt) {
                    this.cache.delete(key);
                    removed++;
                }
            }
            
            if (removed > 0) {
                console.log(`🧹 Cache CLEANUP: ${removed} expired entries removed`);
            }
        }, 10 * 60 * 1000);
    }

    /**
     * Estimate size of data in bytes (rough approximation)
     */
    _estimateSize(data) {
        try {
            return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
        } catch (e) {
            return 0;
        }
    }
}

// Singleton instance
const queryCache = new QueryCache();

module.exports = queryCache;

