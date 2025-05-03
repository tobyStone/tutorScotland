// api/addTutor.js
const connectToDatabase = require('./connectToDatabase');
const { verifyToken } = require('./auth');
const Tutor = require('../models/Tutor');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    verifyToken(req, res, async () => {
        const userRole = (req.user.role || '').toLowerCase();
        if (userRole !== 'admin') {
            return res.status(403).json({ message: "Access denied: Admin only" });
        }

        try {
            await connectToDatabase();

            // Extract fields from request body
            const {
                name,
                subjects,
                costRange,
                badges,
                contact,     
                description,
                postcodes,
                imagePath = ''
            } = req.body;

            // Create new Tutor
            const newTutor = new Tutor({
                name,
                subjects: Array.isArray(subjects) ? subjects : [subjects],
                costRange,
                badges: Array.isArray(badges) ? badges : [badges],
                contact,
                description,
                postcodes: Array.isArray(postcodes) ? postcodes : [postcodes],
                imagePath
            });

            await newTutor.save();
            return res.status(201).json({ 
                message: "Tutor added successfully", 
                tutor: newTutor 
            });
        } catch (error) {
            console.error("Error adding tutor:", error);
            return res.status(500).json({ 
                message: "Server error",
                error: error.message
            });
        }
    });
};
