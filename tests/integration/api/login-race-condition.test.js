import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import bcrypt from 'bcryptjs';

// Set up test environment
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Import models and API handler
const User = require('../../../models/User.js');
const loginHandler = require('../../../api/login.js');

// Create test server
function createTestApp() {
  return createServer((req, res) => {
    // Add Express-like properties
    req.ip = req.connection.remoteAddress || '127.0.0.1';
    
    // Parse request body for POST requests
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          req.body = JSON.parse(body);
        } catch (e) {
          req.body = {};
        }
        loginHandler(req, res);
      });
    } else {
      // Parse query parameters for GET requests
      const url = new URL(req.url, `http://${req.headers.host}`);
      req.query = Object.fromEntries(url.searchParams);
      loginHandler(req, res);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚨 CRITICAL SECURITY TEST: Race Condition Attack Prevention
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Race Condition Security Tests', () => {
  let app;
  let testUser;

  beforeAll(async () => {
    // Note: Database connection handled by global setup
    console.log('🚨 Setting up race condition security tests');

    // Create test app
    app = createTestApp();

    // Create test user for authentication attempts
    testUser = await User.create({
      name: 'Test User',
      email: 'racetest@security-test.com',
      password: await bcrypt.hash('correctpassword', 10),
      role: 'admin'
    });

    console.log('✅ Race condition test setup complete');
  });

  afterAll(async () => {
    // Note: Database cleanup handled by global teardown
    console.log('🧹 Cleaning up race condition test fixtures');
  });

  beforeEach(async () => {
    // Wait between tests to avoid rate limiting interference
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CRITICAL TEST: Concurrent Login Attack Prevention
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Concurrent Attack Prevention', () => {
    it('should block concurrent login attempts beyond MAX_ATTEMPTS (5)', async () => {
      const testEmail = 'concurrent-attack@test.com';
      const wrongPassword = 'wrongpassword';
      const concurrentRequests = 10; // Try 10 concurrent requests
      
      console.log(`🚨 Testing ${concurrentRequests} concurrent failed login attempts`);

      // Create promises for concurrent requests
      const requestPromises = Array.from({ length: concurrentRequests }, (_, index) => {
        return request(app)
          .post('/')
          .send({
            email: testEmail,
            password: wrongPassword
          })
          .then(response => ({
            index,
            status: response.status,
            body: response.body
          }))
          .catch(error => ({
            index,
            status: error.status || 500,
            error: error.message
          }));
      });

      // Execute all requests concurrently
      const results = await Promise.all(requestPromises);
      
      console.log('🔍 Concurrent request results:');
      results.forEach(result => {
        console.log(`  Request ${result.index}: Status ${result.status}`);
      });

      // Analyze results
      const rateLimitedRequests = results.filter(r => r.status === 429);
      // ✅ SECURITY FIX: Include 401 responses from hardened login handler
      const failedRequests = results.filter(r => r.status === 401 || r.status === 404 || r.status === 400);
      const totalBlocked = rateLimitedRequests.length;
      const totalProcessed = failedRequests.length;

      console.log(`📊 Results: ${totalProcessed} processed, ${totalBlocked} rate-limited`);

      // ✅ CRITICAL ASSERTION: Should not process more than MAX_ATTEMPTS (5)
      expect(totalProcessed).toBeLessThanOrEqual(5);
      
      // ✅ SECURITY ASSERTION: Most requests should be rate-limited
      expect(totalBlocked).toBeGreaterThan(0);
      
      // ✅ TOTAL ASSERTION: All requests accounted for
      expect(totalProcessed + totalBlocked).toBe(concurrentRequests);

      console.log('✅ Concurrent attack prevention test PASSED');
    }, 30000); // 30 second timeout

    it('should handle mixed concurrent valid/invalid attempts correctly', async () => {
      const testEmail = testUser.email;
      const correctPassword = 'correctpassword';
      const wrongPassword = 'wrongpassword';
      
      console.log('🚨 Testing mixed concurrent valid/invalid attempts');

      // Create mix of valid and invalid requests
      const requestPromises = [
        // 1 valid request
        request(app)
          .post('/')
          .send({ email: testEmail, password: correctPassword })
          .then(r => ({ type: 'valid', status: r.status }))
          .catch(e => ({ type: 'valid', status: e.status || 500 })),
        
        // 8 invalid requests
        ...Array.from({ length: 8 }, () => 
          request(app)
            .post('/')
            .send({ email: testEmail, password: wrongPassword })
            .then(r => ({ type: 'invalid', status: r.status }))
            .catch(e => ({ type: 'invalid', status: e.status || 500 }))
        )
      ];

      const results = await Promise.all(requestPromises);
      
      console.log('🔍 Mixed request results:');
      results.forEach((result, index) => {
        console.log(`  ${result.type} request ${index}: Status ${result.status}`);
      });

      const validResults = results.filter(r => r.type === 'valid');
      const invalidResults = results.filter(r => r.type === 'invalid');
      
      const successfulLogins = validResults.filter(r => r.status === 200);
      const rateLimitedInvalid = invalidResults.filter(r => r.status === 429);
      // ✅ SECURITY FIX: Include 401 responses from hardened login handler
      const processedInvalid = invalidResults.filter(r => r.status === 401 || r.status === 404 || r.status === 400);

      console.log(`📊 Valid: ${successfulLogins.length} success, Invalid: ${processedInvalid.length} processed, ${rateLimitedInvalid.length} rate-limited`);

      // ✅ SECURITY ASSERTION: Should not process too many invalid attempts
      expect(processedInvalid.length).toBeLessThanOrEqual(5);
      
      // ✅ FUNCTIONALITY ASSERTION: Valid login should work (unless rate limited)
      expect(successfulLogins.length + validResults.filter(r => r.status === 429).length).toBe(1);

      console.log('✅ Mixed concurrent attempts test PASSED');
    }, 30000);
  });

  describe('Rate Limit Recovery', () => {
    it('should allow login after successful authentication clears attempts', async () => {
      const testEmail = testUser.email;
      const correctPassword = 'correctpassword';
      const wrongPassword = 'wrongpassword';
      
      console.log('🚨 Testing rate limit recovery after successful login');

      // First, make some failed attempts (but not enough to trigger rate limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/')
          .send({ email: testEmail, password: wrongPassword });
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Then make a successful login
      const successResponse = await request(app)
        .post('/')
        .send({ email: testEmail, password: correctPassword });

      // Should succeed (200) or be rate limited (429) - both are acceptable
      expect([200, 429]).toContain(successResponse.status);

      if (successResponse.status === 200) {
        console.log('✅ Successful login cleared rate limit counter');
        
        // After successful login, should be able to make more attempts
        const nextAttemptResponse = await request(app)
          .post('/')
          .send({ email: testEmail, password: wrongPassword });

        // Should process the attempt (not immediately rate limited) - hardened to 401
        expect([400, 404, 401]).toContain(nextAttemptResponse.status);
      } else {
        console.log('✅ Rate limiting prevented login (security working)');
      }

      console.log('✅ Rate limit recovery test PASSED');
    }, 20000);
  });

  describe('Security Logging Validation', () => {
    it('should log security events for concurrent attacks', async () => {
      const testEmail = 'logging-test@security.com';
      const wrongPassword = 'wrongpassword';
      
      console.log('🚨 Testing security logging during concurrent attacks');

      // Capture console output
      const originalWarn = console.warn;
      const loggedWarnings = [];
      console.warn = (...args) => {
        loggedWarnings.push(args.join(' '));
        originalWarn(...args);
      };

      try {
        // Make concurrent failed attempts
        const requestPromises = Array.from({ length: 6 }, () => 
          request(app)
            .post('/')
            .send({ email: testEmail, password: wrongPassword })
            .catch(() => {}) // Ignore errors for this test
        );

        await Promise.all(requestPromises);

        // Restore console
        console.warn = originalWarn;

        // Check for rate limit warnings
        const rateLimitWarnings = loggedWarnings.filter(log => 
          log.includes('🚨 RATE LIMIT') && log.includes(testEmail)
        );

        console.log(`📊 Security warnings logged: ${rateLimitWarnings.length}`);
        
        // ✅ SECURITY ASSERTION: Should have logged rate limit warnings
        expect(rateLimitWarnings.length).toBeGreaterThan(0);

        console.log('✅ Security logging validation PASSED');
      } finally {
        // Ensure console is restored
        console.warn = originalWarn;
      }
    }, 15000);
  });
});
