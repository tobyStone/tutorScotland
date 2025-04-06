// api/addTutor.js
const { connectToDatabase, uploadImage } = require('./connectToDatabase');
const { verifyToken } = require('./auth');
const Tutor = require('../models/Tutor');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

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

        // Handle file upload
        upload.single('tutorImage')(req, res, async (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ 
                    message: err.message || 'Error uploading file',
                    error: err
                });
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
                    postcodes
                } = req.body;

                // Upload image to Vercel Blob if present
                let imageUrl = '';
                if (req.file) {
                    try {
                        imageUrl = await uploadImage(req.file, 'tutor-images');
                    } catch (uploadError) {
                        console.error('Image upload error:', uploadError);
                        return res.status(500).json({ 
                            message: "Error uploading image to Blob storage",
                            error: uploadError.message
                        });
                    }
                }

                // Create new Tutor
                const newTutor = new Tutor({
                    name,
                    subjects: Array.isArray(subjects) ? subjects : [subjects],
                    costRange,
                    badges: Array.isArray(badges) ? badges : [badges],
                    imageUrl,
                    contact,
                    description,
                    postcodes: Array.isArray(postcodes) ? postcodes : [postcodes]
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
    });
};
