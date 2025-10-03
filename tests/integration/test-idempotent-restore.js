/**
 * Test script to verify idempotent restore functionality
 * This tests the fix for the 404 error when restoring already-deleted overrides
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('vitest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Import the content manager API
const contentManager = require('./api/content-manager.js');

// Mock Section model for testing
const Section = require('./models/Section');

describe('Idempotent Override Restore', () => {
    let mongod;
    let app;
    let testOverrideId;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api/content-manager', contentManager);
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongod.stop();
    });

    beforeEach(async () => {
        // Create a test override
        const testOverride = new Section({
            page: 'test-page',
            targetPage: 'test-page',
            targetSelector: '[data-test="test-element"]',
            contentType: 'image',
            image: 'https://example.com/test-image.jpg',
            isContentOverride: true,
            isActive: true,
            originalContent: {
                src: 'https://example.com/original.jpg',
                alt: 'Original image'
            }
        });
        
        const saved = await testOverride.save();
        testOverrideId = saved._id.toString();
    });

    afterEach(async () => {
        // Clean up test data
        await Section.deleteMany({});
    });

    test('should successfully delete an existing override', async () => {
        const response = await request(app)
            .delete(`/api/content-manager?id=${testOverrideId}`)
            .expect(200);

        expect(response.body).toMatchObject({
            message: 'Override deleted successfully',
            deleted: true
        });

        // Verify the override is actually deleted
        const override = await Section.findById(testOverrideId);
        expect(override).toBeNull();
    });

    test('should return success when trying to delete already-deleted override', async () => {
        // First delete
        await request(app)
            .delete(`/api/content-manager?id=${testOverrideId}`)
            .expect(200);

        // Second delete should still return success (idempotent)
        const response = await request(app)
            .delete(`/api/content-manager?id=${testOverrideId}`)
            .expect(200);

        expect(response.body).toMatchObject({
            message: 'Override already deleted or not found',
            alreadyDeleted: true
        });
    });

    test('should return success when trying to delete non-existent override', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        
        const response = await request(app)
            .delete(`/api/content-manager?id=${fakeId}`)
            .expect(200);

        expect(response.body).toMatchObject({
            message: 'Override already deleted or not found',
            alreadyDeleted: true
        });
    });

    test('should return 400 for missing ID parameter', async () => {
        const response = await request(app)
            .delete('/api/content-manager')
            .expect(400);

        expect(response.body).toMatchObject({
            message: 'ID parameter required'
        });
    });
});

console.log('✅ Idempotent restore test created successfully');
console.log('Run with: npm test test-idempotent-restore.js');
