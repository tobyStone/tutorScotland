/**
 * Sentry.io Integration for TutorScotland
 * Provides comprehensive error monitoring and security event tracking
 * 
 * Features:
 * - Error tracking and performance monitoring
 * - Security event logging
 * - User context tracking
 * - Custom tags and metadata
 * - Production-ready configuration
 */

// Environment detection
const isProduction = process.env.NODE_ENV === 'production' || 
                    process.env.VERCEL_ENV === 'production';

const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.VERCEL_ENV === 'development' ||
                     !process.env.NODE_ENV;

// Sentry configuration
let Sentry = null;
let sentryInitialized = false;

/**
 * Initialize Sentry with production configuration
 */
function initializeSentry() {
    if (sentryInitialized) return;
    
    try {
        // Only initialize in production or when DSN is provided
        if (!process.env.SENTRY_DSN && isProduction) {
            console.warn('⚠️ Sentry DSN not configured for production environment');
            return;
        }
        
        if (process.env.SENTRY_DSN) {
            Sentry = require('@sentry/node');
            
            Sentry.init({
                dsn: process.env.SENTRY_DSN,
                environment: process.env.NODE_ENV || 'development',
                
                // Performance monitoring
                tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in dev
                
                // Error filtering
                beforeSend(event, hint) {
                    // Filter out common non-critical errors
                    const error = hint.originalException;
                    
                    if (error && error.message) {
                        // Skip rate limiting errors (expected behavior)
                        if (error.message.includes('Too many requests') || 
                            error.message.includes('Rate limit exceeded')) {
                            return null;
                        }
                        
                        // Skip CSRF protection errors (expected security behavior)
                        if (error.message.includes('CSRF protection failed') ||
                            error.message.includes('Invalid request origin')) {
                            return null;
                        }
                        
                        // Skip authentication errors (expected behavior)
                        if (error.message.includes('Authentication required') ||
                            error.message.includes('Invalid credentials')) {
                            return null;
                        }
                    }
                    
                    return event;
                },
                
                // Additional configuration
                release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
                integrations: [
                    // Add HTTP integration for API monitoring
                    new Sentry.Integrations.Http({ tracing: true }),
                ],
                
                // Tags for better organization
                initialScope: {
                    tags: {
                        component: 'tutorscotland-api',
                        platform: 'vercel',
                        charity: 'tutors-alliance-scotland'
                    }
                }
            });
            
            sentryInitialized = true;
            console.log('✅ Sentry initialized for error monitoring');
        } else {
            console.log('ℹ️ Sentry DSN not provided - error monitoring disabled');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize Sentry:', error);
    }
}

/**
 * Log security events to Sentry
 * @param {string} eventType - Type of security event
 * @param {Object} data - Event data
 * @param {Object} req - Express request object (optional)
 */
function logSecurityEvent(eventType, data, req = null) {
    if (!Sentry || !sentryInitialized) return;
    
    try {
        Sentry.withScope((scope) => {
            scope.setTag('event_type', 'security');
            scope.setTag('security_event', eventType);
            scope.setLevel('warning');
            
            // Add request context if available
            if (req) {
                scope.setContext('request', {
                    method: req.method,
                    url: req.url,
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.headers?.['user-agent']
                });
            }
            
            // Add event data
            scope.setContext('security_data', data);
            
            Sentry.captureMessage(`Security Event: ${eventType}`, 'warning');
        });
        
    } catch (error) {
        console.error('Failed to log security event to Sentry:', error);
    }
}

/**
 * Log application errors to Sentry
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 * @param {Object} req - Express request object (optional)
 */
function logError(error, context = {}, req = null) {
    if (!Sentry || !sentryInitialized) {
        console.error('Error (Sentry not available):', error);
        return;
    }
    
    try {
        Sentry.withScope((scope) => {
            scope.setTag('event_type', 'error');
            
            // Add request context if available
            if (req) {
                scope.setContext('request', {
                    method: req.method,
                    url: req.url,
                    ip: req.ip || req.connection?.remoteAddress,
                    userAgent: req.headers?.['user-agent']
                });
            }
            
            // Add additional context
            if (Object.keys(context).length > 0) {
                scope.setContext('additional_context', context);
            }
            
            Sentry.captureException(error);
        });
        
    } catch (sentryError) {
        console.error('Failed to log error to Sentry:', sentryError);
        console.error('Original error:', error);
    }
}

/**
 * Log performance metrics to Sentry
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
function logPerformance(operation, duration, metadata = {}) {
    if (!Sentry || !sentryInitialized) return;
    
    try {
        Sentry.withScope((scope) => {
            scope.setTag('event_type', 'performance');
            scope.setTag('operation', operation);
            
            scope.setContext('performance', {
                operation,
                duration,
                ...metadata
            });
            
            // Only log slow operations to avoid spam
            if (duration > 1000) { // > 1 second
                Sentry.captureMessage(`Slow Operation: ${operation} (${duration}ms)`, 'info');
            }
        });
        
    } catch (error) {
        console.error('Failed to log performance to Sentry:', error);
    }
}

/**
 * Set user context for Sentry
 * @param {Object} user - User information
 */
function setUserContext(user) {
    if (!Sentry || !sentryInitialized) return;
    
    try {
        Sentry.setUser({
            id: user.id,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error('Failed to set user context in Sentry:', error);
    }
}

/**
 * Express middleware for Sentry error handling
 */
function sentryErrorHandler() {
    if (!Sentry || !sentryInitialized) {
        return (err, req, res, next) => {
            console.error('Error (Sentry not available):', err);
            next(err);
        };
    }
    
    return Sentry.Handlers.errorHandler();
}

/**
 * Express middleware for Sentry request handling
 */
function sentryRequestHandler() {
    if (!Sentry || !sentryInitialized) {
        return (req, res, next) => next();
    }
    
    return Sentry.Handlers.requestHandler();
}

/**
 * Get Sentry configuration status
 * @returns {Object} Configuration status
 */
function getSentryStatus() {
    return {
        initialized: sentryInitialized,
        available: !!Sentry,
        environment: process.env.NODE_ENV || 'development',
        dsnConfigured: !!process.env.SENTRY_DSN
    };
}

// Initialize Sentry on module load
initializeSentry();

module.exports = {
    initializeSentry,
    logSecurityEvent,
    logError,
    logPerformance,
    setUserContext,
    sentryErrorHandler,
    sentryRequestHandler,
    getSentryStatus
};
