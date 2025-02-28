// api/addTutor.js
const mongoose = require('mongoose');
const connectToDatabase = require('./connectToDatabase');
const { verifyToken } = require('./auth');
const Tutor = require('../models/tutorModel'); // Ensure you have a tutorModel similar to your seed script

module.exports = async (req, res) => {
    // We assume this endpoint only accepts POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Use verifyToken middleware manually (or wrap in a server framework)
    verifyToken(req, res, async () => {
        // Check that the user has an admin role
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: "Access denied: Admins only" });
        }

        try {
            await connectToDatabase();

            // Read new tutor details from the request body
            const {
                name,
                subjects,
                costRange,
                badges,
                imageUrl,
                imagePath,
                description,
                postcodes
            } = req.body;

            // Create a new Tutor document
            const newTutor = new Tutor({
                name,
                subjects, // assume array is provided
                costRange,
                badges,   // assume array is provided
                imageUrl,
                imagePath,
                description,
                postcodes // assume array is provided
            });

            await newTutor.save();
            return res.status(201).json({ message: "Tutor added successfully", tutor: newTutor });
        } catch (error) {
            console.error("Error adding tutor:", error);
            return res.status(500).json({ message: "Server error" });
        }
    });
};
