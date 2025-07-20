import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/config/setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
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
      'tests/mocks/**'
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
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
      MONGODB_URI: 'mongodb://localhost:27017/tutorscotland-test'
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
