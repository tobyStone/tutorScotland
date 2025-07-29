import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export async function setupTestDB() {
    try {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        // Close any existing connections
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        
        await mongoose.connect(mongoUri);
        console.log('Test database connected successfully');
    } catch (error) {
        console.error('Failed to setup test database:', error);
        throw error;
    }
}

export async function teardownTestDB() {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        
        if (mongoServer) {
            await mongoServer.stop();
        }
        console.log('Test database torn down successfully');
    } catch (error) {
        console.error('Failed to teardown test database:', error);
        throw error;
    }
}

export async function clearTestDB() {
    try {
        if (mongoose.connection.readyState === 0) {
            throw new Error('Database not connected');
        }
        
        const collections = mongoose.connection.collections;
        const clearPromises = Object.keys(collections).map(key => 
            collections[key].deleteMany({})
        );
        
        await Promise.all(clearPromises);
        console.log('Test database cleared successfully');
    } catch (error) {
        console.error('Failed to clear test database:', error);
        throw error;
    }
}

// Helper function to create test data
export async function seedTestData() {
    let User;
    try {
        User = mongoose.model('User');
    } catch {
        const userModule = await import('../../models/user.js');
        User = userModule.default;
    }
    const bcrypt = require('bcryptjs');
    
    // Create test admin user
    const adminUser = await User.create({
        name: 'Test Admin',
        email: 'admin@tutorscotland.test',
        password: await bcrypt.hash('testpassword123', 10),
        role: 'admin'
    });
    
    // Create test parent user
    const parentUser = await User.create({
        name: 'Test Parent',
        email: 'parent@tutorscotland.test',
        password: await bcrypt.hash('testpassword123', 10),
        role: 'parent'
    });
    
    return { adminUser, parentUser };
}
