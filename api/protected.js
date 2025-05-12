// api/protected.js
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

/* Small helper keeps everything in one file, so auth.js can disappear */
function verify(req, res) {
    const token = req.cookies?.token;
    if (!token) return [false, "No token"];
    if (!SECRET) return [false, "JWT_SECRET missing"];

    try {
        return [true, jwt.verify(token, SECRET)];   // -> decoded payload
    } catch {
        return [false, "Bad token"];
    }
}

// Export verify for use in other routes
exports.verify = verify;

const handler = async (req, res) => {
    /* Which role is required?   /api/protected?role=admin   (default = tutor) */
    const requiredRole = (req.query.role || 'tutor').toLowerCase();

    const [ok, payloadOrMsg] = verify(req, res);
    if (!ok) return res.status(401).json({ message: payloadOrMsg });

    if ((payloadOrMsg.role || '').toLowerCase() !== requiredRole) {
        return res.status(403).json({ message: `Access denied: ${requiredRole} only` });
    }

    /* Success return whatever you need */
    return res
        .status(200)
        .json({ message: `Welcome, ${requiredRole}!`, user: payloadOrMsg });
};

module.exports = handler;
