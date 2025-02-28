// api/auth.js
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || "SOME_SUPER_SECRET_KEY";

// Middleware to verify JWT from cookies
function verifyToken(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }
        req.user = decoded; // e.g., { id: ..., role: 'admin' } 
        next();
    });
}

module.exports = { verifyToken };
