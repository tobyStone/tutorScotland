// seedUsers.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectToDatabase = require('./api/connectToDatabase');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['parent', 'admin'], required: true }
});

const User = mongoose.model('User', userSchema);

async function seedUsers() {
    try {
        await connectToDatabase();
        await User.deleteMany({});

        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash("adminSecret", salt);
        const parentPassword = await bcrypt.hash("parentSecret", salt);

        const users = [
            {
                name: 'Alice Admin',
                email: 'admin@example.com',
                password: adminPassword,
                role: 'admin'
            },
            {
                name: 'Peter Parent',
                email: 'parent@example.com',
                password: parentPassword,
                role: 'parent'
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
