// seedUsers.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectToDatabase = require('./api/connectToDatabase');
const User = require('./models/User');


async function seedUsers() {
    try {
        await connectToDatabase();
        await User.deleteMany({});

        const salt = await bcrypt.genSalt(10);
        // Example admin
        const adminPassword = await bcrypt.hash("adminSecret", salt);
        // Example tutor
        const tutorPassword = await bcrypt.hash("tutorSecret", salt);
        // Example blog writer
        const blogWriterPassword = await bcrypt.hash("blogWriterSecret", salt);



        const users = [
            {
                name: 'Alice Admin',
                email: 'admin@example.com',
                password: adminPassword,
                role: 'admin'
            },
            {
                name: 'Toby Tutor',
                email: 'tutor@example.com',
                password: tutorPassword,
                role: 'tutor'
            },
            {
                name: 'Bella Blogger',
                email: 'blogwriter@example.com',
                password: blogWriterPassword,
                role: 'blogwriter'
            }
        ];

        await User.insertMany(users);
        console.log('User accounts seeded successfully.');
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
}

seedUsers();
