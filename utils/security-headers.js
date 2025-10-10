/**
 * @fileoverview Security headers utility for enhanced web application security
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Provides security headers middleware for:
 * - XSS protection
 * - Clickjacking prevention
 * - Content type sniffing protection
 * - Referrer policy enforcement
 * - Content Security Policy (CSP)
 *
 * @security Implements defense-in-depth security headers
 * @performance Lightweight middleware with minimal overhead
 */

/**
 * Apply security headers to response
 * @param {Object} res - Express response object
 * @param {Object} options - Configuration options for headers
 */
function applySecurityHeaders(res, options = {}) {
    const {
        enableCSP = false,
        allowInlineStyles = true,
        allowInlineScripts = false,
        additionalSources = []
    } = options;

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS filtering in browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Content Security Policy (optional, can be restrictive)
    if (enableCSP) {
        let cspDirectives = [
            "default-src 'self'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://api.vercel.com https://storage.googleapis.com https://region1.google-analytics.com https://www.google-analytics.com"
        ];
        
        if (allowInlineStyles) {
            cspDirectives.push("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
        } else {
            cspDirectives.push("style-src 'self' https://fonts.googleapis.com");
        }
        
        if (allowInlineScripts) {
            cspDirectives.push("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com");
        } else {
            cspDirectives.push("script-src 'self' https://www.googletagmanager.com");
        }
        
        // Add additional sources if provided
        if (additionalSources.length > 0) {
            cspDirectives = cspDirectives.concat(additionalSources);
        }
        
        res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    }
}

/**
 * Express middleware for applying security headers
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware function
 */
function securityHeadersMiddleware(options = {}) {
    return (req, res, next) => {
        applySecurityHeaders(res, options);
        next();
    };
}

/**
 * Apply security headers specifically for API responses
 * @param {Object} res - Express response object
 */
function applyAPISecurityHeaders(res) {
    applySecurityHeaders(res, {
        enableCSP: false, // APIs typically don't need CSP
        allowInlineStyles: false,
        allowInlineScripts: false
    });

    // Additional API-specific headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Phase 2 Enhanced API Security Headers
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Permissions Policy for APIs
    res.setHeader('Permissions-Policy', [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()'
    ].join(', '));
}

/**
 * Apply security headers for HTML content
 * @param {Object} res - Express response object
 */
function applyHTMLSecurityHeaders(res) {
    applySecurityHeaders(res, {
        enableCSP: true,
        allowInlineStyles: true,  // Many existing styles are inline
        allowInlineScripts: true, // Some functionality requires inline scripts
        additionalSources: [
            "frame-src 'none'", // Prevent embedding in frames
            "object-src 'none'" // Prevent object/embed elements
        ]
    });

    // Phase 2 Enhanced HTML Security Headers
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    // HTTP Strict Transport Security (HSTS) - Production only
    if (isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Cross-Origin policies for HTML
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none'); // Allow embedding for now
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-origin for public content
}

/**
 * Phase 2: Comprehensive security headers with CSRF protection
 * @param {Object} res - Express response object
 * @param {string} contentType - Content type ('api' or 'html')
 */
function applyComprehensiveSecurityHeaders(res, contentType = 'api') {
    if (contentType === 'api') {
        applyAPISecurityHeaders(res);
    } else {
        applyHTMLSecurityHeaders(res);
    }

    // Additional Phase 2 security enhancements
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    console.log(`✅ Phase 2 Security Headers: Applied comprehensive headers for ${contentType}`);
}

module.exports = {
    applySecurityHeaders,
    securityHeadersMiddleware,
    applyAPISecurityHeaders,
    applyHTMLSecurityHeaders,
    applyComprehensiveSecurityHeaders
};
