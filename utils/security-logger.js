/**
 * @fileoverview Security event logging utility for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Centralized security logging system for:
 * - Failed login attempts and rate limiting
 * - Unauthorized access attempts
 * - File upload security events
 * - Admin action auditing
 * - Suspicious activity detection
 *
 * @security Implements secure logging with data sanitization
 * @performance Lightweight logging with optional file persistence
 * @serverless Compatible with Vercel and other serverless environments (console logging only)
 */

const fs = require('fs');
const path = require('path');
const { logSecurityEvent: sentryLogSecurityEvent, logError: sentryLogError } = require('./sentry-integration');

/**
 * Security event types for categorization
 * @enum {string}
 */
const SecurityEventType = {
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_RATE_LIMITED: 'LOGIN_RATE_LIMITED',
    UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
    UNAUTHORIZED_UPLOAD: 'UNAUTHORIZED_UPLOAD',
    UNAUTHORIZED_CONTENT: 'UNAUTHORIZED_CONTENT',
    ADMIN_ACTION: 'ADMIN_ACTION',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    FILE_UPLOAD: 'FILE_UPLOAD',
    CONTENT_MODIFICATION: 'CONTENT_MODIFICATION'
};

/**
 * Security event severity levels
 * @enum {string}
 */
const SecuritySeverity = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Sanitize log data to prevent log injection attacks
 * @param {any} data - Data to sanitize
 * @param {Set} visited - Set to track visited objects (prevent circular references)
 * @param {number} depth - Current recursion depth (prevent deep recursion)
 * @returns {any} Sanitized data
 */
function sanitizeLogData(data, visited = new Set(), depth = 0) {
    // Prevent infinite recursion
    if (depth > 5) {
        return '[Object too deep]';
    }

    if (typeof data === 'string') {
        // Remove control characters and limit length
        return data.replace(/[\x00-\x1f\x7f-\x9f]/g, '').substring(0, 1000);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
        return data;
    }

    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'object') {
        // Prevent circular references
        if (visited.has(data)) {
            return '[Circular Reference]';
        }

        // Handle arrays
        if (Array.isArray(data)) {
            visited.add(data);
            const sanitized = data.slice(0, 10).map(item =>
                sanitizeLogData(item, visited, depth + 1)
            );
            visited.delete(data);
            return sanitized;
        }

        // Handle regular objects
        visited.add(data);
        const sanitized = {};
        let count = 0;

        for (const [key, value] of Object.entries(data)) {
            // Limit number of properties to prevent huge logs
            if (count >= 20) {
                sanitized['...'] = '[More properties truncated]';
                break;
            }

            // Sanitize keys and values
            const cleanKey = String(key).replace(/[\x00-\x1f\x7f-\x9f]/g, '').substring(0, 100);
            sanitized[cleanKey] = sanitizeLogData(value, visited, depth + 1);
            count++;
        }

        visited.delete(data);
        return sanitized;
    }

    // For functions, symbols, etc.
    return String(data).substring(0, 100);
}

/**
 * Extract client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */
function extractClientInfo(req) {
    const headers = req.headers || {};
    return {
        ip: req.ip || req.connection?.remoteAddress || headers['x-forwarded-for'] || 'unknown',
        userAgent: headers['user-agent'] || 'unknown',
        referer: headers.referer || 'unknown',
        method: req.method || 'unknown',
        url: req.url || 'unknown',
        timestamp: new Date().toISOString()
    };
}

/**
 * Log a security event
 * @param {string} eventType - Type of security event (use SecurityEventType enum)
 * @param {string} severity - Severity level (use SecuritySeverity enum)
 * @param {string} message - Human-readable message
 * @param {Object} details - Additional event details
 * @param {Object} req - Express request object (optional)
 */
function logSecurityEvent(eventType, severity, message, details = {}, req = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        eventType: sanitizeLogData(eventType),
        severity: sanitizeLogData(severity),
        message: sanitizeLogData(message),
        details: sanitizeLogData(details),
        client: req ? extractClientInfo(req) : null,
        environment: process.env.NODE_ENV || 'development'
    };

    // Console logging with color coding
    const severityColors = {
        [SecuritySeverity.LOW]: '\x1b[32m',      // Green
        [SecuritySeverity.MEDIUM]: '\x1b[33m',   // Yellow
        [SecuritySeverity.HIGH]: '\x1b[31m',     // Red
        [SecuritySeverity.CRITICAL]: '\x1b[35m'  // Magenta
    };
    
    const color = severityColors[severity] || '\x1b[0m';
    const reset = '\x1b[0m';
    
    console.log(`${color}🔒 SECURITY [${severity}] ${eventType}: ${message}${reset}`);
    console.log(`   Details:`, JSON.stringify(logEntry.details, null, 2));

    if (req && logEntry.client) {
        console.log(`   Client: ${logEntry.client.ip} - ${logEntry.client.userAgent}`);
    }

    // File logging (only when explicitly enabled and not in serverless environment)
    // Skip file logging in Vercel/serverless environments as they don't have persistent file systems
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_WORKER;

    if (!isServerless && process.env.LOG_SECURITY_TO_FILE === 'true') {
        try {
            const logDir = path.join(process.cwd(), 'logs');
            const logFile = path.join(logDir, 'security.log');

            // Ensure logs directory exists
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Append to log file
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(logFile, logLine);

        } catch (error) {
            // Only log file system errors in development - in production, this is expected in serverless
            if (process.env.NODE_ENV !== 'production') {
                console.error('Failed to write security log to file:', error.message);
            }
        }
    }

    // Phase 2: Log to Sentry for production monitoring
    try {
        sentryLogSecurityEvent(eventType, {
            severity,
            message,
            details: sanitizedDetails,
            timestamp: logEntry.timestamp
        }, req);
    } catch (sentryError) {
        console.error('Failed to log security event to Sentry:', sentryError);
    }

    // Critical events should trigger immediate alerts (in production)
    if (severity === SecuritySeverity.CRITICAL && process.env.NODE_ENV === 'production') {
        // Phase 2: Enhanced critical event handling with Sentry
        console.error('🚨 CRITICAL SECURITY EVENT - IMMEDIATE ATTENTION REQUIRED');
        console.error('Event:', JSON.stringify(logEntry, null, 2));

        // Log critical events to Sentry with high priority
        try {
            sentryLogSecurityEvent(`CRITICAL_${eventType}`, {
                severity: 'CRITICAL',
                message: `CRITICAL SECURITY EVENT: ${message}`,
                details: sanitizedDetails,
                timestamp: logEntry.timestamp,
                priority: 'HIGH'
            }, req);
        } catch (sentryError) {
            console.error('Failed to log critical security event to Sentry:', sentryError);
        }
    }
}

/**
 * Convenience methods for common security events
 */
const SecurityLogger = {
    /**
     * Log failed login attempt
     */
    loginFailed: (email, req, attempts = 1) => {
        logSecurityEvent(
            SecurityEventType.LOGIN_FAILED,
            attempts >= 3 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
            `Failed login attempt for email: ${email}`,
            { email, attempts },
            req
        );
    },

    /**
     * Log successful login
     */
    loginSuccess: (email, role, req) => {
        logSecurityEvent(
            SecurityEventType.LOGIN_SUCCESS,
            SecuritySeverity.LOW,
            `Successful login for ${role}: ${email}`,
            { email, role },
            req
        );
    },

    /**
     * Log rate limited login attempt
     */
    loginRateLimited: (email, req, attempts, minutesRemaining = 15) => {
        logSecurityEvent(
            SecurityEventType.LOGIN_RATE_LIMITED,
            SecuritySeverity.HIGH,
            `Rate limited login attempt for email: ${email}`,
            {
                email,
                attempts,
                rateLimitWindow: `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`
            },
            req
        );
    },

    /**
     * Log unauthorized access attempt
     */
    unauthorizedAccess: (endpoint, req, userInfo = null) => {
        logSecurityEvent(
            SecurityEventType.UNAUTHORIZED_ACCESS,
            SecuritySeverity.HIGH,
            `Unauthorized access attempt to ${endpoint}`,
            { endpoint, userInfo },
            req
        );
    },

    /**
     * Log unauthorized file upload attempt
     */
    unauthorizedUpload: (filename, req, userInfo = null) => {
        logSecurityEvent(
            SecurityEventType.UNAUTHORIZED_UPLOAD,
            SecuritySeverity.CRITICAL,
            `Unauthorized file upload attempt: ${filename}`,
            { filename, userInfo },
            req
        );
    },

    /**
     * Log successful file upload
     */
    fileUpload: (filename, fileSize, userInfo, req) => {
        logSecurityEvent(
            SecurityEventType.FILE_UPLOAD,
            SecuritySeverity.LOW,
            `File uploaded: ${filename}`,
            { filename, fileSize, userInfo },
            req
        );
    },

    /**
     * Log admin action
     */
    adminAction: (action, userInfo, req, details = {}) => {
        logSecurityEvent(
            SecurityEventType.ADMIN_ACTION,
            SecuritySeverity.MEDIUM,
            `Admin action: ${action}`,
            { action, userInfo, ...details },
            req
        );
    },

    /**
     * Log content modification
     */
    contentModification: (contentType, userInfo, req, details = {}) => {
        logSecurityEvent(
            SecurityEventType.CONTENT_MODIFICATION,
            SecuritySeverity.MEDIUM,
            `Content modified: ${contentType}`,
            { contentType, userInfo, ...details },
            req
        );
    },

    /**
     * Log malicious file upload attempt blocked
     */
    maliciousFileBlocked: (filename, threatType, userInfo, req, details = {}) => {
        logSecurityEvent(
            SecurityEventType.UNAUTHORIZED_UPLOAD,
            SecuritySeverity.CRITICAL,
            `MALICIOUS FILE BLOCKED: ${threatType} detected in ${filename}`,
            {
                filename: sanitizeLogData(filename),
                threatType,
                userInfo,
                blocked: true,
                ...details
            },
            req
        );
    },

    /**
     * Log CSRF validation attempt
     */
    csrfValidation: (data) => {
        logSecurityEvent(
            'CSRF_VALIDATION',
            SecuritySeverity.LOW,
            'CSRF protection validation',
            data
        );
    },

    /**
     * Log security violation
     */
    securityViolation: (data) => {
        logSecurityEvent(
            'SECURITY_VIOLATION',
            SecuritySeverity.CRITICAL,
            'Security violation detected',
            data
        );
    },

    /**
     * Log error events
     */
    error: (data) => {
        logSecurityEvent(
            'ERROR',
            SecuritySeverity.HIGH,
            'System error occurred',
            data
        );
    }
};

module.exports = {
    logSecurityEvent,
    SecurityLogger,
    SecurityEventType,
    SecuritySeverity
};
