/**
 * @fileoverview Authentication API for Tutors Alliance Scotland admin access
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Secure authentication system supporting:
 * - Admin login with bcrypt password hashing
 * - JWT token generation and validation
 * - HTTP-only cookie management
 * - Role-based access control
 *
 * @security Implements secure password hashing and JWT tokens
 * @performance Efficient database queries and token validation
 */

// api/login.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { serialize, parse } = require('cookie');  // <-- important for setting cookies manually
const connectToDatabase = require('./connectToDatabase');
const { SecurityLogger } = require('../utils/security-logger');

// Import User model - use try/catch approach similar to tutors.js
let User;
try {
    // Try to get the existing model first
    User = require('mongoose').model('User');
} catch {
    // If it doesn't exist, import it from the models directory
    try {
        User = require('../models/User.js');
    } catch (error) {
        console.error('Error importing User model:', error);
        // This will cause the login to fail, which is appropriate
        User = null;
    }
}

// 🔒 SECURITY: Simple in-memory rate limiting for login attempts
// In production, consider using Redis or database-backed rate limiting
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// 🔍 DEBUG: Configurable debug logging (set to false in production for security)
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production' || process.env.SECURITY_DEBUG === 'true';

/**
 * Conditional debug logging - only logs when DEBUG_ENABLED is true
 * @param {string} message - Debug message
 * @param {any} data - Optional data to log
 */
function debugLog(message, data = null) {
    if (DEBUG_ENABLED) {
        if (data) {
            console.log(`🔍 DEBUG: ${message}`, data);
        } else {
            console.log(`🔍 DEBUG: ${message}`);
        }
    }
}

// Note: Security logging now handled by SecurityLogger utility (serverless-compatible)

/**
 * ✅ SECURITY FIX: Atomic rate limit check with attempt reservation
 * Reserves an attempt slot atomically to prevent race condition attacks
 * @param {string} clientIP - Client IP address
 * @param {string} email - Email being attempted
 * @returns {Object} - { allowed: boolean, reservationToken: string|null }
 */
function checkRateLimitAndReserve(clientIP, email) {
    const key = `${clientIP}:${email}`;
    const now = Date.now();
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: now, lastAttempt: 0 };

    debugLog(`checkRateLimitAndReserve for ${email} from ${clientIP} - current count: ${attempts.count}`);

    // Reset if window has expired
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        debugLog(`Rate limit window expired, resetting attempts for ${email}`);
        attempts.count = 0;
        attempts.firstAttempt = now;
    }

    // Check if rate limited BEFORE incrementing (block after MAX_ATTEMPTS failed attempts)
    if (attempts.count >= MAX_ATTEMPTS) {
        const timeRemaining = RATE_LIMIT_WINDOW - (now - attempts.firstAttempt);
        if (timeRemaining > 0) {
            // ALWAYS log rate limiting events (security-critical)
            console.warn(`🚨 RATE LIMIT: ${email} from ${clientIP} - ${attempts.count} attempts, ${Math.ceil(timeRemaining / 60000)} minutes remaining`);
            return { allowed: false, reservationToken: null };
        }
        // If time window expired, reset the attempts
        debugLog(`Rate limit window expired after max attempts, resetting for ${email}`);
        attempts.count = 0;
        attempts.firstAttempt = now;
    }

    // ✅ ATOMIC RESERVATION: Increment counter immediately to reserve the slot
    attempts.count++;
    attempts.lastAttempt = now;
    loginAttempts.set(key, attempts);

    // Generate reservation token for rollback on success
    const reservationToken = `${key}:${now}:${attempts.count}`;

    debugLog(`Rate limit check PASSED and slot RESERVED for ${email} from ${clientIP} - new count: ${attempts.count}`);
    return { allowed: true, reservationToken };
}

/**
 * ✅ SECURITY FIX: Release reservation on successful login
 * @param {string} reservationToken - Token from checkRateLimitAndReserve
 */
function releaseReservation(reservationToken) {
    if (!reservationToken) return;

    try {
        const [keyPart1, keyPart2, timestamp, expectedCount] = reservationToken.split(':');
        const key = `${keyPart1}:${keyPart2}`;
        const attempts = loginAttempts.get(key);

        if (attempts && attempts.count > 0) {
            attempts.count--;
            loginAttempts.set(key, attempts);
            debugLog(`Released reservation for ${key} - new count: ${attempts.count}`);
        }
    } catch (error) {
        console.error('Error releasing reservation:', error);
    }
}

/**
 * @deprecated - Use checkRateLimitAndReserve instead
 * Legacy function kept for backward compatibility
 */
function checkRateLimit(clientIP, email) {
    const result = checkRateLimitAndReserve(clientIP, email);
    return result.allowed;
}

/**
 * Record a failed login attempt
 * @param {string} clientIP - Client IP address
 * @param {string} email - Email that failed
 * @param {Object} req - Express request object for security logging
 */
function recordFailedAttempt(clientIP, email, req) {
    const key = `${clientIP}:${email}`;
    const now = Date.now();
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: now, lastAttempt: 0 };

    debugLog(`recordFailedAttempt for ${email} from ${clientIP} - before increment: ${attempts.count}`);

    // Reset if window has expired
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        debugLog(`recordFailedAttempt - window expired, resetting`);
        attempts.count = 0;
        attempts.firstAttempt = now;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    loginAttempts.set(key, attempts);

    // ALWAYS log failed login attempts (security-critical)
    console.warn(`🚨 FAILED LOGIN: ${email} from ${clientIP} - Attempt ${attempts.count}/${MAX_ATTEMPTS}`);

    // Write to persistent log using SecurityLogger
    SecurityLogger.loginFailed(email, req, attempts.count);
}

/**
 * Clear successful login attempts
 * @param {string} clientIP - Client IP address
 * @param {string} email - Email that succeeded
 */
function clearAttempts(clientIP, email) {
    const key = `${clientIP}:${email}`;
    loginAttempts.delete(key);
    console.log(`✅ LOGIN SUCCESS: Cleared rate limit for ${email} from ${clientIP}`);
}

// Clean up old entries every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of loginAttempts.entries()) {
        if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW * 2) {
            loginAttempts.delete(key);
        }
    }
}, 30 * 60 * 1000);

/**
 * Main authentication API handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response with authentication result
 *
 * @description Handles authentication operations:
 * - GET ?check=admin: Verify admin authentication status
 * - POST: Admin login with credentials validation
 *
 * @example
 * // GET /api/login?check=admin
 * // POST /api/login with { username, password }
 *
 * @security Uses bcrypt for password hashing and JWT for session management
 * @throws {Error} 401 - Invalid credentials or authentication failure
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    // Get client IP for security logging
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    debugLog(`===== NEW LOGIN REQUEST =====`);
    debugLog(`Method: ${req.method}, IP: ${clientIP}`);

    // Handle auth check requests
    if (req.method === 'GET' && req.query.check === 'admin') {
        debugLog(`Handling admin check request`);
        return handleAdminCheck(req, res);
    }

    if (req.method !== 'POST') {
        debugLog(`Method not allowed: ${req.method}`);
        res.setHeader('Allow', ['POST', 'GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { email, password } = req.body;
    debugLog(`POST login request for email: ${email}`);

    // ✅ SECURITY FIX: Atomic rate limiting with reservation
    const rateLimitResult = checkRateLimitAndReserve(clientIP, email);

    if (!rateLimitResult.allowed) {
        debugLog(`Rate limit check FAILED - returning 429`);

        // Calculate actual time remaining for this specific user
        const key = `${clientIP}:${email}`;
        const attempts = loginAttempts.get(key);
        const timeRemaining = attempts ? RATE_LIMIT_WINDOW - (Date.now() - attempts.firstAttempt) : RATE_LIMIT_WINDOW;
        const minutesRemaining = Math.ceil(timeRemaining / 60000);

        // Log with accurate time remaining
        SecurityLogger.loginRateLimited(email, req, attempts ? attempts.count : MAX_ATTEMPTS, minutesRemaining);

        return res.status(429).json({
            message: `Too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
            error: 'RATE_LIMITED',
            retryAfter: Math.ceil(timeRemaining / 1000), // seconds (actual remaining time)
            minutesRemaining: minutesRemaining // for client-side use
        });
    }

    debugLog(`Rate limit check PASSED - proceeding with authentication`);

    try {
        await connectToDatabase();

        // Check if User model is available
        if (!User) {
            console.error('User model is not available');
            return res.status(500).json({ message: 'Server error: User model not available' });
        }

        // Search for the user by email (case-insensitive)
        const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
        if (!user) {
            // ✅ SECURITY FIX: Failed attempt - reservation becomes permanent (no rollback)
            SecurityLogger.loginFailed(email, 'User not found', req);
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare passwords using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // ✅ SECURITY FIX: Failed attempt - reservation becomes permanent (no rollback)
            SecurityLogger.loginFailed(email, 'Invalid credentials', req);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // ✅ SECURITY FIX: Success - release reservation and clear all attempts
        releaseReservation(rateLimitResult.reservationToken);
        clearAttempts(clientIP, email);
        SecurityLogger.loginSuccess(email, user.role, req);

        // Ensure JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'Internal server error: JWT_SECRET not set' });
        }

        // Generate a JWT token with the user's ID and role
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );

        // Manually set the HTTP-only cookie with enhanced security
        // In Vercel serverless, res.cookie() is not available.
        const serializedCookie = serialize('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',  // CSRF protection - prevents cross-site requests
            maxAge: 3 * 60 * 60, // 3 hours in seconds
            path: '/'            // cookie valid on entire site
        });
        res.setHeader('Set-Cookie', serializedCookie);

        // If admin => /admin.html, else if tutor => /tutorszone.html
        let redirectUrl = '/tutorszone.html';
        if (user.role === 'admin') {
            redirectUrl = '/admin.html';
        } else if (user.role === 'blogwriter') {
            // For example, go to /blogwriter.html or /blog-writer (your choice)
            redirectUrl = '/blogWriter.html';
        } else if (user.role === 'tutor') {
            redirectUrl = '/tutorszone.html';
        }


        // Log successful login
        SecurityLogger.loginSuccess(user.email, user.role, req);

        return res.status(200).json({
            user: { id: user._id, email: user.email, name: user.name, role: user.role },
            redirectUrl
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Function to check if user is admin
async function handleAdminCheck(req, res) {
    try {
        // Parse cookies from request headers
        const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
        const token = cookies.token;

        if (!token) {
            return res.status(200).json({ isAdmin: false });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user is admin
        const isAdmin = decoded.role === 'admin';

        return res.status(200).json({
            isAdmin,
            user: { id: decoded.id, role: decoded.role }
        });
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(200).json({ isAdmin: false });
    }
}
