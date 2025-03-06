// api/addTutor.js
const mongoose = require('mongoose');
const connectToDatabase = require('./connectToDatabase');
const { verifyToken } = require('./auth');
const Tutor = require('../models/Tutor'); // Must match your actual tutor model file name

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    verifyToken(req, res, async () => {
        // For case-insensitive check:
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
                imageUrl,
                imagePath,
                contact,     
                description,
                postcodes
            } = req.body;

            // Create new Tutor
            const newTutor = new Tutor({
                name,
                subjects,    // array
                costRange,
                badges,      // array
                imageUrl,
                imagePath,
                contact,     // store the contact field
                description,
                postcodes    // array
            });

            await newTutor.save();
            return res.status(201).json({ message: "Tutor added successfully", tutor: newTutor });
        } catch (error) {
            console.error("Error adding tutor:", error);
            return res.status(500).json({ message: "Server error" });
        }
    });
};
