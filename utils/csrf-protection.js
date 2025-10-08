/**
 * CSRF Protection Middleware for TutorScotland
 * Implements comprehensive Cross-Site Request Forgery protection with dynamic origin support
 *
 * Security Features:
 * - Origin validation for state-changing operations
 * - Dynamic Vercel preview/production URL support
 * - Environment-driven trusted domain configuration
 * - Referer header validation as fallback
 * - Development environment support
 * - Comprehensive security logging
 */

const { SecurityLogger } = require('./security-logger');

// Base trusted domains for CSRF protection (always trusted)
const BASE_TRUSTED_ORIGINS = [
    'https://tutor-scotland.vercel.app',
    'https://www.tutor-scotland.vercel.app',
    'https://tutorsalliancescotland.co.uk',
    'https://www.tutorsalliancescotland.co.uk',
    // Local development domains (always trusted)
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://localhost:5000',
    'http://localhost:4000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:4000',
];

/**
 * Normalize a URL to a proper origin format
 * @param {string} url - URL to normalize
 * @returns {string|null} Normalized origin or null if invalid
 */
function normalizeOrigin(url) {
    if (!url || typeof url !== 'string') return null;

    try {
        // Add https:// if no protocol specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }

        const urlObj = new URL(url);
        return urlObj.origin;
    } catch (error) {
        console.warn(`⚠️ CSRF: Invalid URL format: ${url}`);
        return null;
    }
}

/**
 * Load dynamic trusted origins from environment variables
 * This runs once at module load to build the complete trusted origins list
 * @returns {string[]} Complete array of trusted origins
 */
function loadDynamicTrustedOrigins() {
    const dynamicOrigins = [...BASE_TRUSTED_ORIGINS];
    const addedOrigins = [];

    // 1. VERCEL_URL - Automatically provided by Vercel for preview/production deployments
    if (process.env.VERCEL_URL) {
        const vercelOrigin = normalizeOrigin(process.env.VERCEL_URL);
        if (vercelOrigin && !dynamicOrigins.includes(vercelOrigin)) {
            dynamicOrigins.push(vercelOrigin);
            addedOrigins.push(`VERCEL_URL: ${vercelOrigin}`);
        }
    }

    // 2. PUBLIC_SITE_URL - Explicitly configured production domain
    if (process.env.PUBLIC_SITE_URL) {
        const publicOrigin = normalizeOrigin(process.env.PUBLIC_SITE_URL);
        if (publicOrigin && !dynamicOrigins.includes(publicOrigin)) {
            dynamicOrigins.push(publicOrigin);
            addedOrigins.push(`PUBLIC_SITE_URL: ${publicOrigin}`);
        }
    }

    // 3. ADDITIONAL_TRUSTED_ORIGINS - Comma-separated list for staging/custom domains
    if (process.env.ADDITIONAL_TRUSTED_ORIGINS) {
        const additionalOrigins = process.env.ADDITIONAL_TRUSTED_ORIGINS
            .split(',')
            .map(origin => normalizeOrigin(origin.trim()))
            .filter(origin => origin && !dynamicOrigins.includes(origin));

        dynamicOrigins.push(...additionalOrigins);
        if (additionalOrigins.length > 0) {
            addedOrigins.push(`ADDITIONAL: ${additionalOrigins.join(', ')}`);
        }
    }

    // 4. Legacy CSRF_TRUSTED_ORIGINS support (for backward compatibility)
    if (process.env.CSRF_TRUSTED_ORIGINS) {
        const legacyOrigins = process.env.CSRF_TRUSTED_ORIGINS
            .split(',')
            .map(origin => normalizeOrigin(origin.trim()))
            .filter(origin => origin && !dynamicOrigins.includes(origin));

        dynamicOrigins.push(...legacyOrigins);
        if (legacyOrigins.length > 0) {
            addedOrigins.push(`LEGACY: ${legacyOrigins.join(', ')}`);
        }
    }

    // Log configuration for debugging (but not in production)
    if (process.env.NODE_ENV !== 'production' && addedOrigins.length > 0) {
        console.log('🔒 CSRF Dynamic Origins Added:', {
            base: BASE_TRUSTED_ORIGINS.length,
            added: addedOrigins.length,
            total: dynamicOrigins.length,
            details: addedOrigins
        });
    }

    return dynamicOrigins;
}

// Initialize trusted origins with dynamic support (runs once at module load)
const TRUSTED_ORIGINS = loadDynamicTrustedOrigins();

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development' ||
                     process.env.VERCEL_ENV === 'development' ||
                     !process.env.NODE_ENV ||
                     process.env.NODE_ENV === 'local';

// Test environment detection - bypass CSRF for automated tests
const isTestEnvironment = process.env.NODE_ENV === 'test' ||
                          process.env.VITEST === 'true' ||
                          process.env.CI === 'true';

/**
 * Extract origin from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} Origin URL or null
 */
function extractOrigin(req) {
    const headers = req.headers || {};
    return headers.origin || 
           headers.referer?.split('/').slice(0, 3).join('/') || 
           null;
}

/**
 * Validate if origin is trusted
 * @param {string} origin - Origin to validate
 * @returns {boolean} True if trusted
 */
function isTrustedOrigin(origin) {
    if (!origin) return false;
    
    // Exact match check
    if (TRUSTED_ORIGINS.includes(origin)) return true;
    
    // Development localhost variations
    if (isDevelopment) {
        const localhostPatterns = [
            /^http:\/\/localhost:\d+$/,
            /^http:\/\/127\.0\.0\.1:\d+$/,
            /^http:\/\/\[::1\]:\d+$/
        ];
        
        return localhostPatterns.some(pattern => pattern.test(origin));
    }
    
    return false;
}

/**
 * Check if request method requires CSRF protection
 * @param {string} method - HTTP method
 * @returns {boolean} True if protection required
 */
function requiresCSRFProtection(method) {
    const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    return protectedMethods.includes(method?.toUpperCase());
}

/**
 * CSRF Protection Middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function csrfProtection(req, res, next) {
    try {
        const method = req.method?.toUpperCase();
        
        // Skip CSRF protection for safe methods
        if (!requiresCSRFProtection(method)) {
            return next();
        }

        // ✅ TEST ENVIRONMENT BYPASS: Allow tests to run without CSRF validation
        if (isTestEnvironment) {
            console.log(`🧪 CSRF protection bypassed for test environment (${method} ${req.url})`);
            return next();
        }

        // ✅ TEMPORARY DEBUG BYPASS: Uncomment the next 3 lines to temporarily disable CSRF for debugging
        // console.log(`🚨 TEMPORARY: CSRF protection bypassed for debugging (${method} ${req.url})`);
        // return next();
        
        const origin = extractOrigin(req);
        const userAgent = req.headers?.['user-agent'] || 'unknown';
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        
        // Log CSRF validation attempt
        SecurityLogger.csrfValidation({
            method,
            origin,
            userAgent,
            ip,
            url: req.url,
            timestamp: new Date().toISOString()
        });
        
        // ✅ TEMPORARY DEBUG: Log detailed CSRF validation info
        console.log('🔍 CSRF Debug Info:', {
            method,
            origin,
            trustedOrigins: TRUSTED_ORIGINS,
            isDevelopment,
            isTrusted: isTrustedOrigin(origin),
            headers: {
                origin: req.headers?.origin,
                referer: req.headers?.referer,
                host: req.headers?.host
            }
        });

        // Validate origin
        if (!isTrustedOrigin(origin)) {
            // Log security violation
            SecurityLogger.securityViolation({
                type: 'CSRF_VIOLATION',
                method,
                origin,
                userAgent,
                ip,
                url: req.url,
                severity: 'HIGH',
                message: `Untrusted origin attempted ${method} request`,
                timestamp: new Date().toISOString()
            });

            console.error('❌ CSRF BLOCKED:', {
                method,
                origin,
                trustedOrigins: TRUSTED_ORIGINS,
                isDevelopment,
                url: req.url
            });

            return res.status(403).json({
                error: 'Forbidden',
                message: 'Invalid request origin',
                code: 'CSRF_PROTECTION'
            });
        }
        
        // CSRF protection passed
        console.log(`✅ CSRF Protection: ${method} request from ${origin} validated`);
        next();
        
    } catch (error) {
        console.error('CSRF Protection Error:', error);
        
        // Log error but don't block request in case of middleware failure
        SecurityLogger.error({
            type: 'CSRF_MIDDLEWARE_ERROR',
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        });
        
        // In production, be more strict
        if (!isDevelopment) {
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Security validation failed'
            });
        }
        
        next();
    }
}

/**
 * Add CSRF token to response headers (for future token-based implementation)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function addCSRFHeaders(req, res, next) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
}

/**
 * Get CSRF configuration for debugging
 * @returns {Object} CSRF configuration
 */
function getCSRFConfig() {
    return {
        trustedOrigins: TRUSTED_ORIGINS,
        isDevelopment,
        protectedMethods: ['POST', 'PUT', 'DELETE', 'PATCH']
    };
}

module.exports = {
    csrfProtection,
    addCSRFHeaders,
    isTrustedOrigin,
    requiresCSRFProtection,
    getCSRFConfig,
    TRUSTED_ORIGINS
};
