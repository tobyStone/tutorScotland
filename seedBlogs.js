// seedBlogs.js
const mongoose = require('mongoose');
const connectToDatabase = require('./api/connectToDatabase');
const Blog = require('./models/Blog');

async function seedBlogs() {
    try {
        await connectToDatabase();
        await Blog.deleteMany({}); // optional: remove old data

        const blogs = [
            {
                title: '5 Tips for Effective Math Tutoring',
                content: 'Mathematics can be a tricky subject, but with the right approach...',
                imagePath: '/images/tutor2.jpg'
            },
            {
                title: 'Improving Literacy Skills at Home',
                content: 'Encouraging reading and writing from a young age helps build strong literacy...',
                imagePath: '/images/tutor1.jpg'
            },
            {
                title: 'Online vs. In-Person Tutoring',
                content: 'In an ever-connected world, online tutoring has become a popular choice...',
                imagePath: '/images/tutor0.jpg'
            }
        ];

        await Blog.insertMany(blogs);
        console.log('Blog posts seeded successfully.');
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Error seeding blogs:', err);
        process.exit(1);
    }
}

seedBlogs();
