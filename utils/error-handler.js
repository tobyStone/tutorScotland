/**
 * @fileoverview Enhanced error handling utility for secure error responses
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Provides secure error handling with:
 * - Production error sanitization
 * - Development debugging information
 * - Security-conscious error logging
 * - Consistent error response formats
 *
 * @security Prevents information disclosure in production
 * @performance Lightweight error processing
 */

/**
 * Sanitize error messages for production environment
 * @param {Error|string} error - Error object or message
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(error) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
        // In development, return full error details
        return error instanceof Error ? error.message : String(error);
    }
    
    // In production, return generic messages to prevent information disclosure
    const errorString = error instanceof Error ? error.message : String(error);
    
    // Map specific error types to safe messages
    const errorMappings = {
        'ValidationError': 'Invalid input data provided',
        'CastError': 'Invalid data format',
        'MongoError': 'Database operation failed',
        'JsonWebTokenError': 'Authentication failed',
        'TokenExpiredError': 'Session expired',
        'MulterError': 'File upload failed',
        'SyntaxError': 'Invalid request format'
    };
    
    // Check for known error types
    for (const [errorType, safeMessage] of Object.entries(errorMappings)) {
        if (errorString.includes(errorType) || (error instanceof Error && error.name === errorType)) {
            return safeMessage;
        }
    }
    
    // Default safe message for unknown errors
    return 'An unexpected error occurred';
}

/**
 * Create a standardized error response
 * @param {Error|string} error - Error object or message
 * @param {number} statusCode - HTTP status code
 * @param {Object} additionalInfo - Additional safe information to include
 * @returns {Object} Standardized error response
 */
function createErrorResponse(error, statusCode = 500, additionalInfo = {}) {
    const sanitizedMessage = sanitizeErrorMessage(error);
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
        success: false,
        message: sanitizedMessage,
        statusCode,
        timestamp: new Date().toISOString(),
        ...additionalInfo
    };
    
    // Add debug information in development
    if (!isProduction && error instanceof Error) {
        response.debug = {
            originalMessage: error.message,
            stack: error.stack,
            name: error.name
        };
    }
    
    return response;
}

/**
 * Handle API errors with consistent response format
 * @param {Object} res - Express response object
 * @param {Error|string} error - Error object or message
 * @param {number} statusCode - HTTP status code
 * @param {Object} additionalInfo - Additional safe information
 */
function handleAPIError(res, error, statusCode = 500, additionalInfo = {}) {
    const errorResponse = createErrorResponse(error, statusCode, additionalInfo);
    
    // Log error for monitoring (but don't expose in response)
    console.error('API Error:', {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        statusCode,
        timestamp: errorResponse.timestamp,
        additionalInfo
    });
    
    return res.status(statusCode).json(errorResponse);
}

/**
 * Handle validation errors specifically
 * @param {Object} res - Express response object
 * @param {Array} validationErrors - Array of validation error messages
 */
function handleValidationError(res, validationErrors) {
    return handleAPIError(res, 'Validation failed', 400, {
        errors: validationErrors,
        type: 'validation'
    });
}

/**
 * Handle authentication errors
 * @param {Object} res - Express response object
 * @param {string} message - Optional custom message
 */
function handleAuthError(res, message = 'Authentication required') {
    return handleAPIError(res, message, 401, {
        type: 'authentication'
    });
}

/**
 * Handle authorization errors
 * @param {Object} res - Express response object
 * @param {string} message - Optional custom message
 */
function handleAuthorizationError(res, message = 'Insufficient permissions') {
    return handleAPIError(res, message, 403, {
        type: 'authorization'
    });
}

/**
 * Handle not found errors
 * @param {Object} res - Express response object
 * @param {string} resource - Resource that was not found
 */
function handleNotFoundError(res, resource = 'Resource') {
    return handleAPIError(res, `${resource} not found`, 404, {
        type: 'not_found'
    });
}

/**
 * Handle database errors
 * @param {Object} res - Express response object
 * @param {Error} error - Database error
 */
function handleDatabaseError(res, error) {
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    return handleAPIError(res, error, statusCode, {
        type: 'database'
    });
}

module.exports = {
    sanitizeErrorMessage,
    createErrorResponse,
    handleAPIError,
    handleValidationError,
    handleAuthError,
    handleAuthorizationError,
    handleNotFoundError,
    handleDatabaseError
};
