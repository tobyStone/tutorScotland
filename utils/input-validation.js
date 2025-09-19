/**
 * @fileoverview Comprehensive input validation utility for TutorScotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Provides input validation and sanitization functions for:
 * - Email validation
 * - String sanitization and length validation
 * - SQL injection prevention
 * - XSS prevention
 * - File path validation
 * - URL validation
 *
 * @security Implements defense-in-depth input validation
 * @performance Lightweight validation with minimal overhead
 */

const { SecurityLogger } = require('./security-logger');

/**
 * Sanitize string input to prevent XSS and injection attacks
 * @param {string} input - Input string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
        return '';
    }

    const {
        maxLength = 1000,
        allowHTML = false,
        allowSpecialChars = true
    } = options;

    let sanitized = input.trim();

    // Truncate if too long
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // Remove HTML tags if not allowed
    if (!allowHTML) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove dangerous characters if not allowed
    if (!allowSpecialChars) {
        sanitized = sanitized.replace(/[<>'"&]/g, '');
    }

    // Escape HTML entities
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    return sanitized;
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
function validateEmail(email) {
    if (typeof email !== 'string') {
        return { valid: false, error: 'Email must be a string' };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const sanitized = sanitizeString(email, { maxLength: 254, allowSpecialChars: true });

    if (!emailRegex.test(sanitized)) {
        return { valid: false, error: 'Invalid email format' };
    }

    if (sanitized.length > 254) {
        return { valid: false, error: 'Email too long' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
function validatePassword(password) {
    if (typeof password !== 'string') {
        return { valid: false, error: 'Password must be a string' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
        return { valid: false, error: 'Password too long' };
    }

    // Check for basic complexity (at least one letter and one number)
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
        return { valid: false, error: 'Password must contain at least one letter and one number' };
    }

    return { valid: true };
}

/**
 * Validate and sanitize text content
 * @param {string} text - Text to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateText(text, options = {}) {
    const {
        required = false,
        minLength = 0,
        maxLength = 10000,
        allowHTML = false,
        fieldName = 'text'
    } = options;

    if (required && (!text || typeof text !== 'string' || text.trim().length === 0)) {
        return { valid: false, error: `${fieldName} is required` };
    }

    if (!text) {
        return { valid: true, sanitized: '' };
    }

    if (typeof text !== 'string') {
        return { valid: false, error: `${fieldName} must be a string` };
    }

    const sanitized = sanitizeString(text, { maxLength, allowHTML });

    if (sanitized.length < minLength) {
        return { valid: false, error: `${fieldName} must be at least ${minLength} characters long` };
    }

    if (sanitized.length > maxLength) {
        return { valid: false, error: `${fieldName} must be no more than ${maxLength} characters long` };
    }

    return { valid: true, sanitized };
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateURL(url, options = {}) {
    const { allowedProtocols = ['http', 'https'], maxLength = 2048 } = options;

    if (typeof url !== 'string') {
        return { valid: false, error: 'URL must be a string' };
    }

    if (url.length > maxLength) {
        return { valid: false, error: 'URL too long' };
    }

    try {
        const urlObj = new URL(url);
        
        if (!allowedProtocols.includes(urlObj.protocol.slice(0, -1))) {
            return { valid: false, error: 'Invalid URL protocol' };
        }

        return { valid: true, sanitized: url };
    } catch (error) {
        return { valid: false, error: 'Invalid URL format' };
    }
}

/**
 * Validate file path to prevent directory traversal
 * @param {string} path - File path to validate
 * @returns {Object} Validation result
 */
function validateFilePath(path) {
    if (typeof path !== 'string') {
        return { valid: false, error: 'File path must be a string' };
    }

    // Check for directory traversal attempts
    if (path.includes('..') || path.includes('//') || path.startsWith('/')) {
        return { valid: false, error: 'Invalid file path' };
    }

    // Only allow safe characters
    if (!/^[a-zA-Z0-9._/-]+$/.test(path)) {
        return { valid: false, error: 'File path contains invalid characters' };
    }

    return { valid: true, sanitized: path };
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {Object} Validation result
 */
function validateObjectId(id) {
    if (typeof id !== 'string') {
        return { valid: false, error: 'ID must be a string' };
    }

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return { valid: false, error: 'Invalid ID format' };
    }

    return { valid: true, sanitized: id };
}

/**
 * Validate numeric input
 * @param {any} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateNumber(value, options = {}) {
    const { min, max, integer = false, fieldName = 'number' } = options;

    const num = Number(value);
    
    if (isNaN(num)) {
        return { valid: false, error: `${fieldName} must be a valid number` };
    }

    if (integer && !Number.isInteger(num)) {
        return { valid: false, error: `${fieldName} must be an integer` };
    }

    if (min !== undefined && num < min) {
        return { valid: false, error: `${fieldName} must be at least ${min}` };
    }

    if (max !== undefined && num > max) {
        return { valid: false, error: `${fieldName} must be no more than ${max}` };
    }

    return { valid: true, sanitized: num };
}

/**
 * Comprehensive validation for login credentials
 * @param {Object} credentials - Login credentials
 * @param {Object} req - Request object for logging
 * @returns {Object} Validation result
 */
function validateLoginCredentials(credentials, req) {
    const { email, password } = credentials;
    const errors = [];

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        errors.push(emailValidation.error);
    }

    // Validate password (basic validation for login)
    if (!password || typeof password !== 'string') {
        errors.push('Password is required');
    } else if (password.length > 128) {
        errors.push('Password too long');
    }

    // Log validation attempt
    if (errors.length > 0) {
        SecurityLogger.securityEvent('VALIDATION_FAILED', {
            endpoint: '/api/login',
            errors: errors.length,
            email: email ? 'provided' : 'missing'
        }, req);
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized: emailValidation.valid ? {
            email: emailValidation.sanitized,
            password // Don't sanitize password, just validate
        } : null
    };
}

module.exports = {
    sanitizeString,
    validateEmail,
    validatePassword,
    validateText,
    validateURL,
    validateFilePath,
    validateObjectId,
    validateNumber,
    validateLoginCredentials
};
