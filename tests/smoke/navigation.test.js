import { test, expect } from '@playwright/test';

test.describe('Navigation Tests', () => {
  test('main navigation links work', async ({ page }) => {
    await page.goto('/');
    
    // Test main nav links
    const navLinks = [
      { text: 'For Tutors', expectedUrl: '/tutorDirectory.html' },
      { text: 'For Parents', expectedUrl: 'https://membermojo.co.uk/tas' },
      { text: 'About TAS', expectedUrl: '/about.html' },
      { text: 'Contact Us', expectedUrl: '/contact.html' }
    ];
    
    for (const link of navLinks) {
      await page.goto('/');
      await page.click(`text=${link.text}`);
      await expect(page).toHaveURL(new RegExp(link.expectedUrl));
    }
  });

  test('smooth scrolling to sections works', async ({ page }) => {
    await page.goto('/');
    
    // Check if there are anchor links that should smooth scroll
    const anchorLinks = page.locator('a[href^="#"]');
    const count = await anchorLinks.count();
    
    if (count > 0) {
      const firstAnchor = anchorLinks.first();
      const href = await firstAnchor.getAttribute('href');
      
      await firstAnchor.click();
      
      // Check that we're still on the same page but scrolled
      await expect(page).toHaveURL(new RegExp(`#${href.substring(1)}`));
      
      // Check that target section is visible
      const targetSection = page.locator(href);
      await expect(targetSection).toBeVisible();
    }
  });

  test('no broken links on main pages', async ({ page }) => {
    const pagesToTest = [
      '/',
      '/tutorDirectory.html',
      'https://membermojo.co.uk/tas',
      '/blog.html'
    ];
    
    for (const pageUrl of pagesToTest) {
      await page.goto(pageUrl);
      
      // Get all internal links
      const links = page.locator('a[href^="/"], a[href^="./"], a[href^="../"]');
      const linkCount = await links.count();
      
      for (let i = 0; i < Math.min(linkCount, 10); i++) { // Test first 10 links
        const link = links.nth(i);
        const href = await link.getAttribute('href');
        
        if (href && !href.includes('#') && !href.includes('mailto:')) {
          const response = await page.request.get(href);
          expect(response.status()).toBeLessThan(400);
        }
      }
    }
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login.html');
    
    // Check login form exists
    const loginForm = page.locator('form');
    await expect(loginForm).toBeVisible();
    
    // Check required form fields
    const emailField = page.locator('input[type="email"], input[name="email"]');
    const passwordField = page.locator('input[type="password"], input[name="password"]');
    
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
  });
});
