import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

describe('Database Connection Integration Test', () => {
  let mongoServer;

  beforeAll(async () => {
    // This test verifies that MongoDB Memory Server works correctly in CI
    console.log('Starting MongoDB Memory Server...');
    
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: undefined, // Let it choose automatically
        launchTimeout: 60000, // 60 seconds for CI
      },
      binary: {
        skipMD5: true,
        downloadTimeout: 120000, // 2 minutes for CI
      }
    });
    
    const mongoUri = mongoServer.getUri();
    console.log('MongoDB Memory Server started at:', mongoUri);
    
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Connect with appropriate timeouts
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    
    console.log('Connected to test database successfully');
  });

  afterAll(async () => {
    console.log('Tearing down test database...');
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(true);
    }
    
    if (mongoServer) {
      await mongoServer.stop({ force: true, doCleanup: false });
    }
    
    console.log('Test database torn down successfully');
  });

  it('should connect to MongoDB Memory Server successfully', async () => {
    expect(mongoose.connection.readyState).toBe(1); // Connected
    expect(mongoServer).toBeDefined();
    expect(mongoServer.getUri()).toMatch(/^mongodb:\/\/127\.0\.0\.1:\d+\/.*$/);
  });

  it('should be able to perform basic database operations', async () => {
    // Create a simple test collection
    const TestModel = mongoose.model('Test', new mongoose.Schema({
      name: String,
      value: Number
    }));

    // Insert a document
    const testDoc = await TestModel.create({
      name: 'test-document',
      value: 42
    });

    expect(testDoc).toBeDefined();
    expect(testDoc.name).toBe('test-document');
    expect(testDoc.value).toBe(42);

    // Query the document
    const foundDoc = await TestModel.findOne({ name: 'test-document' });
    expect(foundDoc).toBeDefined();
    expect(foundDoc.value).toBe(42);

    // Update the document
    await TestModel.updateOne({ name: 'test-document' }, { value: 100 });
    const updatedDoc = await TestModel.findOne({ name: 'test-document' });
    expect(updatedDoc.value).toBe(100);

    // Delete the document
    await TestModel.deleteOne({ name: 'test-document' });
    const deletedDoc = await TestModel.findOne({ name: 'test-document' });
    expect(deletedDoc).toBeNull();
  });

  it('should handle multiple collections', async () => {
    const Collection1 = mongoose.model('Collection1', new mongoose.Schema({
      data: String
    }));
    
    const Collection2 = mongoose.model('Collection2', new mongoose.Schema({
      info: String
    }));

    await Collection1.create({ data: 'test1' });
    await Collection2.create({ info: 'test2' });

    const doc1 = await Collection1.findOne({ data: 'test1' });
    const doc2 = await Collection2.findOne({ info: 'test2' });

    expect(doc1).toBeDefined();
    expect(doc2).toBeDefined();
    expect(doc1.data).toBe('test1');
    expect(doc2.info).toBe('test2');
  });

  it('should provide database statistics', async () => {
    const stats = await mongoose.connection.db.stats();
    
    expect(stats).toBeDefined();
    expect(typeof stats.collections).toBe('number');
    expect(typeof stats.dataSize).toBe('number');
    expect(stats.ok).toBe(1);
  });
});
