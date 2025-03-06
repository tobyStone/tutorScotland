// api/auth.js
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    if (!SECRET_KEY) {
        return res.status(500).json({ message: "JWT_SECRET not set in environment" });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }
        req.user = decoded; // e.g., { id: ..., role: 'parent' }
        next();
    });
}

module.exports = { verifyToken };

