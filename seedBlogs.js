// seedBlogs.js
const mongoose = require('mongoose');
const connectToDatabase = require('./api/connectToDatabase');
const Blog = require('./models/Blog');

async function seedBlogs() {
    try {
        await connectToDatabase();
        await Blog.deleteMany({}); // Remove old data (optional)

        const blogs = [
            {
                title: '5 Tips for Effective Math Tutoring',
                content: 'Mathematics can be a tricky subject, but with the right approach...',
                imagePath: '/images/tutor2.jpg',
                category: ['secondary', 'primary']
            },
            {
                title: 'Improving Literacy Skills at Home',
                content: 'Encouraging reading and writing from a young age helps build strong literacy...',
                imagePath: '/images/tutor1.jpg',
                category: ['secondary']
            },
            {
                title: 'Online vs. In-Person Tutoring',
                content: 'In an ever-connected world, online tutoring has become a popular choice...',
                imagePath: '/images/tutor0.jpg',
                category: ['primary']
            },
            {
                title: 'General Advice on Study Techniques',
                content: 'General study strategies can help students achieve success in all subjects...',
                imagePath: '/images/flag.PNG',
                category: ['secondary', 'primary']
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
