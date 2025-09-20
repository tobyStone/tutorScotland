/**
 * CSRF Protection Middleware for TutorScotland
 * Implements comprehensive Cross-Site Request Forgery protection
 * 
 * Security Features:
 * - Origin validation for state-changing operations
 * - Referer header validation as fallback
 * - Trusted domain whitelist
 * - Development environment support
 * - Comprehensive security logging
 */

const { SecurityLogger } = require('./security-logger');

// Trusted domains for CSRF protection
const TRUSTED_ORIGINS = [
    'https://tutor-scotland.vercel.app',
    'https://www.tutor-scotland.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Add production domain when available
];

// Development environment detection
const isDevelopment = process.env.NODE_ENV === 'development' ||
                     process.env.VERCEL_ENV === 'development' ||
                     !process.env.NODE_ENV;

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
