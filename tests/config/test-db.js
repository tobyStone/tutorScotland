import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export async function setupTestDB() {
    try {
        // Configure MongoDB Memory Server for better CI compatibility
        mongoServer = await MongoMemoryServer.create({
            instance: {
                // Use a more stable port range for CI
                port: undefined, // Let it choose automatically
                // Increase startup timeout for slower CI environments
                launchTimeout: 60000,
            },
            binary: {
                // Use system MongoDB if available, otherwise download
                skipMD5: true,
                // Increase download timeout for CI
                downloadTimeout: 120000,
            }
        });
        const mongoUri = mongoServer.getUri();

        // Close any existing connections
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        // Connect with appropriate timeouts for CI
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
        });
        console.log('Test database connected successfully');
    } catch (error) {
        console.error('Failed to setup test database:', error);
        throw error;
    }
}

export async function teardownTestDB() {
    try {
        // Force close all connections
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(true); // Force close
        }

        if (mongoServer) {
            await mongoServer.stop({
                // Force stop even if connections are still open
                force: true,
                // Don't cleanup data directory (faster)
                doCleanup: false
            });
            mongoServer = null; // Clear reference
        }
        console.log('Test database torn down successfully');
    } catch (error) {
        console.error('Failed to teardown test database:', error);
        // Don't throw in teardown to avoid masking test failures
        console.warn('Continuing despite teardown error...');
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
        User = require('../../models/user.js');
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
