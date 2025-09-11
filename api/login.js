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
const fs = require('fs');
const path = require('path');

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

// 📝 LOGGING: Persistent security log file
const LOG_FILE = path.join(process.cwd(), 'logs', 'security.log');

/**
 * Write security events to persistent log file
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 */
function writeToSecurityLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...data
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
        // Ensure logs directory exists
        const logsDir = path.dirname(LOG_FILE);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Append to log file
        fs.appendFileSync(LOG_FILE, logLine);
        console.log(`📝 Logged to ${LOG_FILE}: ${message}`);
    } catch (error) {
        console.error('Failed to write to security log:', error);
        // Still log to console as fallback
        console.log(`📝 SECURITY LOG [${level}]: ${message}`, data);
    }
}

/**
 * Check and update rate limiting for login attempts
 * @param {string} clientIP - Client IP address
 * @param {string} email - Email being attempted
 * @returns {boolean} - True if request is allowed, false if rate limited
 */
function checkRateLimit(clientIP, email) {
    const key = `${clientIP}:${email}`;
    const now = Date.now();
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: now, lastAttempt: 0 };

    console.log(`🔍 DEBUG: checkRateLimit ENTRY for ${email} from ${clientIP}`);
    console.log(`🔍 DEBUG: Current attempts object:`, JSON.stringify(attempts));
    console.log(`🔍 DEBUG: MAX_ATTEMPTS: ${MAX_ATTEMPTS}, RATE_LIMIT_WINDOW: ${RATE_LIMIT_WINDOW}ms`);

    // Reset if window has expired
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        console.log(`🔍 DEBUG: Rate limit window expired, resetting attempts for ${email}`);
        attempts.count = 0;
        attempts.firstAttempt = now;
    }

    // Check if rate limited (block after MAX_ATTEMPTS failed attempts)
    if (attempts.count >= MAX_ATTEMPTS) {
        const timeRemaining = RATE_LIMIT_WINDOW - (now - attempts.firstAttempt);
        console.log(`🔍 DEBUG: Rate limit check - count: ${attempts.count}, timeRemaining: ${timeRemaining}ms`);
        if (timeRemaining > 0) {
            console.warn(`🚨 RATE LIMIT: ${email} from ${clientIP} - ${attempts.count} attempts, ${Math.ceil(timeRemaining / 60000)} minutes remaining`);
            console.log(`🔍 DEBUG: checkRateLimit RETURNING FALSE (rate limited)`);
            return false;
        }
        // If time window expired, reset the attempts
        console.log(`🔍 DEBUG: Rate limit window expired after max attempts, resetting for ${email}`);
        attempts.count = 0;
        attempts.firstAttempt = now;
        loginAttempts.set(`${clientIP}:${email}`, attempts);
    }

    console.log(`🔍 DEBUG: checkRateLimit RETURNING TRUE (allowing request) - final count: ${attempts.count}`);
    return true;
}

/**
 * Record a failed login attempt
 * @param {string} clientIP - Client IP address
 * @param {string} email - Email that failed
 */
function recordFailedAttempt(clientIP, email) {
    const key = `${clientIP}:${email}`;
    const now = Date.now();
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: now, lastAttempt: 0 };

    console.log(`🔍 DEBUG: recordFailedAttempt ENTRY for ${email} from ${clientIP}`);
    console.log(`🔍 DEBUG: Key: ${key}`);
    console.log(`🔍 DEBUG: Before increment - attempts object:`, JSON.stringify(attempts));
    console.log(`🔍 DEBUG: loginAttempts Map size before: ${loginAttempts.size}`);

    // Reset if window has expired
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        console.log(`🔍 DEBUG: recordFailedAttempt - window expired, resetting`);
        attempts.count = 0;
        attempts.firstAttempt = now;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    loginAttempts.set(key, attempts);

    console.warn(`🚨 FAILED LOGIN: ${email} from ${clientIP} - Attempt ${attempts.count}/${MAX_ATTEMPTS}`);
    console.log(`🔍 DEBUG: After increment - attempts object:`, JSON.stringify(attempts));
    console.log(`🔍 DEBUG: loginAttempts Map size after: ${loginAttempts.size}`);
    console.log(`🔍 DEBUG: recordFailedAttempt COMPLETE`);

    // Write to persistent log
    writeToSecurityLog('WARN', 'Failed login attempt recorded', {
        email,
        clientIP,
        attemptNumber: attempts.count,
        maxAttempts: MAX_ATTEMPTS,
        timeWindow: `${RATE_LIMIT_WINDOW / 60000} minutes`
    });
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
    // 🔍 DEBUG: Track every single request
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    console.log(`🔍 DEBUG: ===== NEW REQUEST =====`);
    console.log(`🔍 DEBUG: Method: ${req.method}`);
    console.log(`🔍 DEBUG: Client IP: ${clientIP}`);
    console.log(`🔍 DEBUG: User-Agent: ${req.headers['user-agent']}`);
    console.log(`🔍 DEBUG: Request body:`, req.body);
    console.log(`🔍 DEBUG: Current loginAttempts Map size: ${loginAttempts.size}`);

    // Handle auth check requests
    if (req.method === 'GET' && req.query.check === 'admin') {
        console.log(`🔍 DEBUG: Handling admin check request`);
        return handleAdminCheck(req, res);
    }

    if (req.method !== 'POST') {
        console.log(`🔍 DEBUG: Method not allowed: ${req.method}`);
        res.setHeader('Allow', ['POST', 'GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { email, password } = req.body;
    console.log(`🔍 DEBUG: POST request for email: ${email}`);

    // 🔒 SECURITY: Rate limiting check

    if (!checkRateLimit(clientIP, email)) {
        console.log(`🔍 DEBUG: Rate limit check FAILED - returning 429`);
        writeToSecurityLog('WARN', 'Login rate limited', {
            email,
            clientIP,
            attempts: MAX_ATTEMPTS,
            userAgent: req.headers['user-agent']
        });
        SecurityLogger.loginRateLimited(email, req, MAX_ATTEMPTS);
        return res.status(429).json({
            message: 'Too many failed login attempts. Please try again in 15 minutes.',
            error: 'RATE_LIMITED',
            retryAfter: 15 * 60 // seconds
        });
    }

    console.log(`🔍 DEBUG: Rate limit check PASSED - proceeding with authentication`);

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
            recordFailedAttempt(clientIP, email);
            SecurityLogger.loginFailed(email, req, 1);
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare passwords using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            recordFailedAttempt(clientIP, email);
            const attempts = loginAttempts.get(`${clientIP}:${email}`)?.count || 1;
            SecurityLogger.loginFailed(email, req, attempts);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Clear rate limiting on successful login
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

        // Manually set the HTTP-only cookie using the `cookie` library
        // In Vercel serverless, res.cookie() is not available.
        const serializedCookie = serialize('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
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
        writeToSecurityLog('INFO', 'Successful login', {
            email: user.email,
            role: user.role,
            clientIP,
            redirectUrl
        });

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
