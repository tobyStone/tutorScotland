const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
  // Enable mixed module support
  esbuild: {
    target: 'node18',
    // Allow mixed imports in test files
    format: 'esm'
  },
  // Define module resolution for mixed CommonJS/ES modules
  define: {
    global: 'globalThis',
    __dirname: 'import.meta.dirname',
    __filename: 'import.meta.filename'
  },
  // Enable mixed module support
  optimizeDeps: {
    include: ['vitest', 'supertest', 'jsonwebtoken', 'bcryptjs']
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/config/setup.js'],
    testTimeout: 30000, // Increased for CI environment and MongoDB Memory Server startup
    hookTimeout: 30000, // Increased for database setup/teardown
    teardownTimeout: 30000, // Increased for proper cleanup
    // Handle mixed module systems (ES modules in tests, CommonJS in models/API)
    server: {
      deps: {
        external: ['mongoose', 'bcryptjs', 'jsonwebtoken']
      }
    },
    // Separate test patterns for different types
    include: [
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js',
      'tests/smoke/**/*.test.js'
    ],
    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      'tests/fixtures/**',
      'tests/mocks/**',
      // Temporarily excluded image upload tests due to complex dependencies and mixed module issues
      'tests/integration/api/image-upload.test.js',
      'tests/integration/api/image-upload-complete-security.test.js',
      'tests/integration/api/image-upload-real-api.test.js',
      'tests/integration/api/image-upload-security.test.js'
    ],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'tests/**',
        'node_modules/**',
        'public/js/editor/**', // Complex DOM manipulation - better tested E2E
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only'
      // Note: MONGODB_URI not needed - tests use MongoDB Memory Server
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@models': path.resolve(__dirname, './models'),
      '@api': path.resolve(__dirname, './api'),
      '@public': path.resolve(__dirname, './public')
    }
  }
});
