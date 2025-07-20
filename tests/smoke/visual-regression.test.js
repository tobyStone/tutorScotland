import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('homepage loads with correct styling', async ({ page }) => {
    await page.goto('/');
    
    // Check header is present and styled
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    // Check main navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check hero section
    const heroSection = page.locator('main section').first();
    await expect(heroSection).toBeVisible();
    
    // Check footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    
    // Check mobile navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check content is readable on mobile
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    
    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });

  test('tutor directory displays correctly', async ({ page }) => {
    await page.goto('/tutorDirectory.html');
    
    // Check tutor cards load
    await page.waitForSelector('.tutor-card', { timeout: 10000 });
    
    const tutorCards = page.locator('.tutor-card');
    await expect(tutorCards.first()).toBeVisible();
    
    await expect(page).toHaveScreenshot('tutor-directory.png');
  });

  test('blog page displays correctly', async ({ page }) => {
    await page.goto('/blog.html');
    
    // Check blog posts load
    await page.waitForSelector('.blog-post', { timeout: 10000 });
    
    const blogPosts = page.locator('.blog-post');
    await expect(blogPosts.first()).toBeVisible();
    
    await expect(page).toHaveScreenshot('blog-page.png');
  });
});
