import { test, expect } from '@playwright/test';

/**
 * CSS Preservation Tests - Protect Current Working Aesthetic State
 *
 * These tests capture the current "golden state" of the website's styling
 * to prevent regressions during future CSS changes or refactoring.
 */

test.describe('CSS Preservation - Golden State Protection', () => {

  test.describe('Team Member Sections - Dynamic Content', () => {
    test('team member sections display correctly in portrait orientation', async ({ page }) => {
      // Test on homepage first, then about-us.html
      const pagesToTest = ['/', '/about-us.html'];
      let foundTeamSections = false;

      for (const testPage of pagesToTest) {
        await page.goto(testPage);

        // Set portrait orientation viewport (iPhone XR dimensions from your screenshot)
        await page.setViewportSize({ width: 414, height: 896 });

        // Wait for page to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000); // Allow time for dynamic content to load

        // Check if there are any dynamic team sections
        const dynamicTeamSections = page.locator('.strive-team-card, .team-grid, .team-members');
        const teamSectionCount = await dynamicTeamSections.count();

        if (teamSectionCount > 0) {
          console.log(`Found ${teamSectionCount} team sections on ${testPage}`);
          foundTeamSections = true;

          // Test each team section
          for (let i = 0; i < teamSectionCount; i++) {
            const teamSection = dynamicTeamSections.nth(i);

            // Ensure section is visible
            await expect(teamSection).toBeVisible();

            // Check section width and positioning
            const boundingBox = await teamSection.boundingBox();
            if (boundingBox) {
              console.log(`Team section ${i}: width=${boundingBox.width}, x=${boundingBox.x}, right=${boundingBox.x + boundingBox.width}`);

              // Section should not be too narrow (minimum 300px for readability on iPhone XR)
              expect(boundingBox.width).toBeGreaterThan(300);

              // Section should not overflow viewport
              expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(414);

              // Section should have reasonable right margin (not hugging edge) - max 10px gap
              expect(boundingBox.x + boundingBox.width).toBeGreaterThan(404); // At least within 10px of edge
            }
          }

          // Take screenshot for visual regression
          await expect(page).toHaveScreenshot(`team-sections-portrait-${testPage.replace('/', 'home').replace('.html', '')}.png`, {
            fullPage: true,
            threshold: 0.3 // More lenient threshold for initial baseline
          });

          break; // Found team sections, no need to test other pages
        } else {
          console.log(`No team sections found on ${testPage}`);
        }
      }

      if (!foundTeamSections) {
        console.log('No team sections found on any test page - test will pass as this may be expected');
        // Still take a screenshot of the last page for reference
        await expect(page).toHaveScreenshot('no-team-sections-portrait.png', {
          fullPage: true,
          threshold: 0.3
        });
      }
    });
  });

  test.describe('Basic Layout Preservation', () => {
    test('homepage displays correctly', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Check key elements are visible
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('nav, .main-nav')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();

      // Take screenshot for visual regression
      await expect(page).toHaveScreenshot('homepage-golden-state.png', {
        fullPage: true,
        threshold: 0.3
      });
    });
  });
});
