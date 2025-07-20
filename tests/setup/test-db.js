import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

export async function setupTestDatabase() {
  // Set test environment variables
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.NODE_ENV = 'test';

  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  console.log('Test database connected successfully');
}

export async function teardownTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
    console.log('Test database torn down successfully');
  }
}

export async function clearTestDatabase() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    console.log('Test database cleared successfully');
  }
}
