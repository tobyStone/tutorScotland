import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.spec.js', '**/smoke/**/*.test.js'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // TODO: Update with your actual test environment URL
    // baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile devices - critical for tutoring site
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Samsung Galaxy',
      use: { ...devices['Galaxy S9+'] },
    },
    // Portrait orientation testing (Samsung issue defense)
    {
      name: 'iPhone Portrait',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
    },
    {
      name: 'Samsung Portrait',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 320, height: 658 }
      },
    },
    // Tablet testing for admin interface
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    }
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Global test configuration
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      mode: 'strict',
      threshold: 0.2,
    },
  },
  timeout: 30000,
});
