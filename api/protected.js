// api/protected.js
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

/* Small helper keeps everything in one file, so auth.js can disappear */
function verify(req, res) {
    console.log('Verifying token from cookies...');

    // Check if cookies exist
    if (!req.cookies) {
        console.log('No cookies object found in request');

        // Try to manually parse cookies from header
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) {
            console.log('No cookie header found');
            return [false, "No cookies found in request"];
        }

        // Manually parse cookies
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            cookies[name] = value;
        });

        req.cookies = cookies;
        console.log('Manually parsed cookies:', cookies);
    }

    // Get token from cookies
    const token = req.cookies.token;
    if (!token) {
        console.log('No token found in cookies:', req.cookies);
        return [false, "No authentication token found"];
    }

    // Check if JWT_SECRET is set
    if (!SECRET) {
        console.log('JWT_SECRET is not set');
        return [false, "Server configuration error: JWT_SECRET missing"];
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, SECRET);
        console.log('Token verified successfully:', decoded);
        return [true, decoded];   // -> decoded payload
    } catch (error) {
        console.error('Token verification error:', error.message);
        return [false, `Invalid authentication token: ${error.message}`];
    }
}

// Export verify for use in other routes
exports.verify = verify;

const handler = async (req, res) => {
    console.log('Protected route accessed with headers:', req.headers);

    /* Which role is required?   /api/protected?role=admin   (default = tutor) */
    const requiredRole = (req.query.role || 'tutor').toLowerCase();
    console.log(`Required role: ${requiredRole}`);

    const [ok, payloadOrMsg] = verify(req, res);
    if (!ok) {
        console.log(`Authentication failed: ${payloadOrMsg}`);
        return res.status(401).json({ message: payloadOrMsg });
    }

    console.log(`User authenticated with payload:`, payloadOrMsg);

    // Check if user has the required role
    const userRole = (payloadOrMsg.role || '').toLowerCase();
    if (userRole !== requiredRole) {
        console.log(`Access denied: User role is ${userRole}, required role is ${requiredRole}`);
        return res.status(403).json({ message: `Access denied: ${requiredRole} only` });
    }

    console.log(`Access granted to ${userRole} user: ${payloadOrMsg.username || 'unknown'}`);

    /* Success return whatever you need */
    return res
        .status(200)
        .json({
            message: `Welcome, ${requiredRole}!`,
            user: payloadOrMsg,
            timestamp: new Date().toISOString()
        });
};

module.exports = handler;

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
