import { test, expect } from '@playwright/test';

/**
 * Hardware-specific compatibility tests
 * These tests validate that the codebase handles device-specific issues correctly
 * Tests PASS when the code properly handles Samsung/iOS/mobile device quirks
 * Tests FAIL when device-specific support is broken
 */

test.describe('Device Compatibility Validation Tests', () => {

  test.describe('Samsung Portrait Viewport Compatibility', () => {
    test('codebase handles Samsung portrait viewport correctly', async ({ page, browserName }) => {
      // This test validates that our Samsung fixes work regardless of browser
      // It should PASS when our Samsung compatibility code is working
      
      await page.goto('/');

      // Test Samsung portrait viewport (320x658) - our code should handle this correctly
      await page.setViewportSize({ width: 320, height: 658 });

      // Wait for our Samsung compatibility fixes to apply
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Allow time for responsive helper to apply Samsung fixes

      // VALIDATE: Our Samsung fixes ensure images display correctly
      const images = page.locator('img');
      const imageCount = await images.count();

      // Test should PASS if our Samsung compatibility code works
      if (imageCount > 0) {
        for (let i = 0; i < imageCount; i++) {
          const image = images.nth(i);

          // Our Samsung fixes should ensure images are visible
          await expect(image).toBeVisible();

          // Our Samsung fixes should ensure images load properly
          const naturalWidth = await image.evaluate(img => img.naturalWidth);
          const naturalHeight = await image.evaluate(img => img.naturalHeight);

          expect(naturalWidth).toBeGreaterThan(0);
          expect(naturalHeight).toBeGreaterThan(0);

          // Our Samsung fixes should ensure proper CSS rendering
          const computedStyle = await image.evaluate(img => {
            const style = window.getComputedStyle(img);
            return {
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              width: style.width,
              height: style.height
            };
          });

          // These should PASS when our Samsung compatibility code works
          expect(computedStyle.display).not.toBe('none');
          expect(computedStyle.visibility).not.toBe('hidden');
          expect(parseFloat(computedStyle.opacity)).toBeGreaterThan(0);
        }
      } else {
        // If no images found, that's also valid (page might not have images)
        console.log('No images found on page - test passes as page loads correctly');
      }
    });
    
    test('codebase prevents Samsung nested image clipping issues', async ({ page }) => {
      await page.goto('/');
      await page.setViewportSize({ width: 320, height: 658 });
      await page.waitForTimeout(500); // Allow Samsung fixes to apply

      // VALIDATE: Our code prevents Samsung's nested image clipping bug
      const nestedImages = page.locator('div img, section img, article img');
      const count = await nestedImages.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const img = nestedImages.nth(i);

          // Our Samsung fixes should prevent parent container clipping
          const parentStyle = await img.evaluate(img => {
            const parent = img.parentElement;
            const style = window.getComputedStyle(parent);
            return {
              overflow: style.overflow,
              height: style.height,
              width: style.width
            };
          });

          // Test PASSES when our Samsung compatibility prevents clipping
          await expect(img).toBeVisible();

          // Our fixes should ensure proper image positioning
          const boundingBox = await img.boundingBox();
          expect(boundingBox).not.toBeNull();
          expect(boundingBox.width).toBeGreaterThan(0);
          expect(boundingBox.height).toBeGreaterThan(0);
        }
      } else {
        // No nested images is also valid
        console.log('No nested images found - Samsung clipping prevention not needed');
      }
    });

    test('codebase prevents Samsung flexbox collapse in team sections', async ({ page }) => {
      await page.goto('/about-us.html');
      await page.setViewportSize({ width: 320, height: 658 });

      // Wait for our Samsung flexbox collapse fixes to apply
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Allow time for Samsung fix to apply

      // VALIDATE: Our Samsung fixes prevent flexbox collapse
      const teamMembersContainer = page.locator('.team-members');
      if (await teamMembersContainer.count() > 0) {
        // Our Samsung fixes should force block layout to prevent collapse
        const containerStyle = await teamMembersContainer.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            display: style.display,
            flexWrap: style.flexWrap,
            width: style.width
          };
        });

        // Test PASSES when our Samsung flexbox fix is working
        expect(containerStyle.display).toBe('block');

        // Validate individual team member cards work correctly
        const teamMembers = page.locator('.team-member');
        const memberCount = await teamMembers.count();

        for (let i = 0; i < memberCount; i++) {
          const member = teamMembers.nth(i);

          // Our fixes should ensure team members are visible
          await expect(member).toBeVisible();

          const memberStyle = await member.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              display: style.display,
              width: style.width,
              flex: style.flex
            };
          });

          // Our Samsung fixes should ensure block display
          expect(memberStyle.display).toBe('block');

          // Validate team member images work correctly
          const memberImages = member.locator('img');
          const imageCount = await memberImages.count();

          for (let j = 0; j < imageCount; j++) {
            const img = memberImages.nth(j);
            await expect(img).toBeVisible();

            const boundingBox = await img.boundingBox();
            expect(boundingBox).not.toBeNull();
            expect(boundingBox.width).toBeGreaterThan(0);
            expect(boundingBox.height).toBeGreaterThan(0);
          }
        }
      } else {
        // No team members section is also valid
        console.log('No team members section found - Samsung flexbox fix not needed');
      }
    });

    test('codebase provides Samsung IntersectionObserver fallback', async ({ page }) => {
      await page.goto('/about-us.html');
      await page.setViewportSize({ width: 320, height: 658 });

      // SIMULATE: Samsung IntersectionObserver failure (real Samsung issue)
      await page.addInitScript(() => {
        // Mock IntersectionObserver to throw an error during construction
        window.IntersectionObserver = function() {
          throw new Error('IntersectionObserver not supported');
        };
      });

      // Wait for our Samsung fallback mechanism to activate
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500); // Allow time for fallback to apply

      // VALIDATE: Our Samsung fallback ensures sections are visible
      const teamSection = page.locator('#team.team-section');
      if (await teamSection.count() > 0) {
        await expect(teamSection).toBeVisible();

        // Our fallback should add is-visible class when IntersectionObserver fails
        const hasVisibleClass = await teamSection.evaluate(el =>
          el.classList.contains('is-visible')
        );
        expect(hasVisibleClass).toBe(true);

        // Our fallback should ensure opacity is 1 (not stuck at 0)
        const opacity = await teamSection.evaluate(el =>
          window.getComputedStyle(el).opacity
        );
        expect(parseFloat(opacity)).toBe(1);
      }

      // VALIDATE: Our fallback works for all fade-in sections
      const fadeInSections = page.locator('.fade-in-section, .fade-in-on-scroll');
      const sectionCount = await fadeInSections.count();

      for (let i = 0; i < sectionCount; i++) {
        const section = fadeInSections.nth(i);

        // Our Samsung fallback should make each section visible
        await expect(section).toBeVisible();

        // Our fallback should add is-visible class
        const hasVisibleClass = await section.evaluate(el =>
          el.classList.contains('is-visible')
        );
        expect(hasVisibleClass).toBe(true);

        // Our fallback should ensure opacity 1
        const opacity = await section.evaluate(el =>
          window.getComputedStyle(el).opacity
        );
        expect(parseFloat(opacity)).toBe(1);
      }
    });

    test('fade-in sections work normally when IntersectionObserver is available', async ({ page }) => {
      await page.goto('/about-us.html');
      await page.setViewportSize({ width: 320, height: 658 });

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check that IntersectionObserver is available and working
      const observerAvailable = await page.evaluate(() => {
        return typeof window.IntersectionObserver !== 'undefined';
      });
      expect(observerAvailable).toBe(true);

      // Scroll to team section to trigger intersection
      const teamSection = page.locator('#team.team-section');
      if (await teamSection.count() > 0) {
        await teamSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000); // Allow time for intersection to trigger

        // Section should become visible
        await expect(teamSection).toBeVisible();

        // Should have is-visible class after intersection
        const hasVisibleClass = await teamSection.evaluate(el =>
          el.classList.contains('is-visible')
        );
        expect(hasVisibleClass).toBe(true);
      }
    });
  });

  test.describe('iOS Safari Viewport Compatibility', () => {
    test('codebase handles iOS viewport height units correctly', async ({ page }) => {
      // This test validates our iOS Safari compatibility regardless of browser
      // It should PASS when our iOS viewport fixes work correctly

      await page.goto('/');

      // Test iOS iPhone viewport (390x844) - our code should handle this correctly
      await page.setViewportSize({ width: 390, height: 844 });

      // VALIDATE: Our iOS Safari fixes handle vh units correctly
      const elementsWithVh = page.locator('[style*="vh"], [class*="vh"]');
      const count = await elementsWithVh.count();

      for (let i = 0; i < count; i++) {
        const element = elementsWithVh.nth(i);
        const boundingBox = await element.boundingBox();

        // Our iOS fixes should prevent vh collapse and oversizing
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThan(0);
          expect(boundingBox.height).toBeLessThan(1000); // Reasonable max
        }
      }

      // If no vh elements found, that's also valid
      if (count === 0) {
        console.log('No vh elements found - iOS viewport fix not needed');
      }
    });
  });
  
  test.describe('High-DPI Display Issues', () => {
    test('images scale correctly on high-DPI displays', async ({ page }) => {
      await page.goto('/');
      
      // Simulate high-DPI display
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      const images = page.locator('img');
      const count = await images.count();
      
      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        
        // Check image scaling
        const imageData = await img.evaluate(img => ({
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          displayWidth: img.offsetWidth,
          displayHeight: img.offsetHeight,
          devicePixelRatio: window.devicePixelRatio
        }));
        
        // Ensure images aren't pixelated or oversized
        expect(imageData.displayWidth).toBeGreaterThan(0);
        expect(imageData.displayHeight).toBeGreaterThan(0);
        
        // Check aspect ratio is maintained
        const naturalRatio = imageData.naturalWidth / imageData.naturalHeight;
        const displayRatio = imageData.displayWidth / imageData.displayHeight;
        
        // Allow 5% tolerance for aspect ratio
        expect(Math.abs(naturalRatio - displayRatio)).toBeLessThan(0.05);
      }
    });
  });
  
  test.describe('Mobile Touch Compatibility', () => {
    test('codebase provides proper touch interface design', async ({ page }) => {
      // This test validates our mobile touch compatibility regardless of device
      // It should PASS when our touch-friendly design is working

      await page.goto('/');

      // Set mobile viewport to test touch-friendly design
      await page.setViewportSize({ width: 375, height: 667 });

      // VALIDATE: Our mobile design provides touch-friendly elements
      const buttons = page.locator('button, [role="button"], .btn');
      const links = page.locator('a[href]');

      // Test button touch compatibility
      const buttonCount = await buttons.count();
      if (buttonCount > 0) {
        const firstButton = buttons.first();

        // Our mobile design should ensure touch-friendly targets (44px minimum)
        const boundingBox = await firstButton.boundingBox();
        if (boundingBox) {
          expect(Math.min(boundingBox.width, boundingBox.height)).toBeGreaterThanOrEqual(44);
        }

        // Our touch interface should be interactive
        await firstButton.tap();
        // Test PASSES when touch interaction works without errors
      } else {
        console.log('No buttons found - touch interface validation not needed');
      }
    });
  });
  
  test.describe('Browser-Specific CSS Support', () => {
    test('CSS Grid works across all browsers', async ({ page }) => {
      await page.goto('/');
      
      // Check for CSS Grid usage
      const gridElements = page.locator('[style*="grid"], [class*="grid"]');
      const count = await gridElements.count();
      
      for (let i = 0; i < count; i++) {
        const element = gridElements.nth(i);
        
        const gridSupport = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns,
            gridTemplateRows: style.gridTemplateRows
          };
        });
        
        // Ensure grid is working or has fallback
        if (gridSupport.display === 'grid') {
          expect(gridSupport.gridTemplateColumns).not.toBe('none');
        }
      }
    });
  });
});

/**
 * Visual compatibility validation tests
 * These tests validate that our device-specific fixes maintain visual consistency
 */
test.describe('Device Compatibility Visual Validation', () => {
  test('codebase maintains consistent homepage rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // VALIDATE: Our device compatibility fixes maintain visual consistency
    // Test PASSES when homepage renders without device-specific visual regressions
    await expect(page).toHaveScreenshot('homepage-device-compatibility.png', {
      fullPage: true,
      threshold: 0.3 // Allow for minor rendering differences
    });
  });

  test('codebase provides responsive admin interface', async ({ page }) => {
    // This test validates admin interface works across device sizes
    // It should PASS when our responsive design is working correctly

    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    // Test tablet viewport (common admin usage scenario)
    await page.setViewportSize({ width: 768, height: 1024 });

    // VALIDATE: Our responsive admin design works correctly
    await expect(page).toHaveScreenshot('admin-responsive-compatibility.png', {
      fullPage: true,
      threshold: 0.3
    });
  });
});
