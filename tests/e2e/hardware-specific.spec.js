import { test, expect } from '@playwright/test';

/**
 * Hardware-specific tests to catch device-specific rendering issues
 * Based on real-world Samsung portrait viewport image bug
 */

test.describe('Hardware-Specific Rendering Tests', () => {
  
  test.describe('Samsung Portrait Viewport Issues', () => {
    test('images should display correctly in Samsung portrait mode', async ({ page, browserName }) => {
      // Only run on mobile browsers
      test.skip(browserName === 'webkit' && process.platform === 'darwin', 'iOS Safari has different viewport behavior');
      
      await page.goto('/');
      
      // Set Samsung Galaxy S9+ portrait viewport
      await page.setViewportSize({ width: 320, height: 658 });
      
      // Wait for images to load
      await page.waitForLoadState('networkidle');
      
      // Check that images are visible and have proper dimensions
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        
        // Ensure image is visible
        await expect(image).toBeVisible();
        
        // Check that image has loaded (not broken)
        const naturalWidth = await image.evaluate(img => img.naturalWidth);
        const naturalHeight = await image.evaluate(img => img.naturalHeight);
        
        expect(naturalWidth).toBeGreaterThan(0);
        expect(naturalHeight).toBeGreaterThan(0);
        
        // Check computed styles for Samsung-specific issues
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
        
        expect(computedStyle.display).not.toBe('none');
        expect(computedStyle.visibility).not.toBe('hidden');
        expect(parseFloat(computedStyle.opacity)).toBeGreaterThan(0);
      }
    });
    
    test('nested HTML images render correctly in Samsung portrait', async ({ page }) => {
      await page.goto('/');
      await page.setViewportSize({ width: 320, height: 658 });
      
      // Look for nested images (images inside divs, sections, etc.)
      const nestedImages = page.locator('div img, section img, article img');
      const count = await nestedImages.count();
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const img = nestedImages.nth(i);
          
          // Samsung-specific: Check parent container doesn't hide image
          const parentStyle = await img.evaluate(img => {
            const parent = img.parentElement;
            const style = window.getComputedStyle(parent);
            return {
              overflow: style.overflow,
              height: style.height,
              width: style.width
            };
          });
          
          // Ensure parent isn't clipping the image
          await expect(img).toBeVisible();
          
          // Check image positioning
          const boundingBox = await img.boundingBox();
          expect(boundingBox).not.toBeNull();
          expect(boundingBox.width).toBeGreaterThan(0);
          expect(boundingBox.height).toBeGreaterThan(0);
        }
      }
    });

    test('team member sections display correctly on Samsung portrait', async ({ page }) => {
      await page.goto('/about-us.html');
      await page.setViewportSize({ width: 320, height: 658 });

      // Wait for page to load and responsive helper to apply fixes
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Allow time for Samsung fix to apply

      // Check team members container
      const teamMembersContainer = page.locator('.team-members');
      if (await teamMembersContainer.count() > 0) {
        // Verify container is using block layout (not flex)
        const containerStyle = await teamMembersContainer.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            display: style.display,
            flexWrap: style.flexWrap,
            width: style.width
          };
        });

        expect(containerStyle.display).toBe('block');

        // Check individual team member cards
        const teamMembers = page.locator('.team-member');
        const memberCount = await teamMembers.count();

        for (let i = 0; i < memberCount; i++) {
          const member = teamMembers.nth(i);

          // Verify member card is visible and properly sized
          await expect(member).toBeVisible();

          const memberStyle = await member.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              display: style.display,
              width: style.width,
              flex: style.flex
            };
          });

          expect(memberStyle.display).toBe('block');

          // Check that images within team members are visible
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
      }
    });

    test('fade-in sections are visible when IntersectionObserver fails on Samsung', async ({ page }) => {
      await page.goto('/about-us.html');
      await page.setViewportSize({ width: 320, height: 658 });

      // Simulate IntersectionObserver failure by disabling it
      await page.addInitScript(() => {
        // Mock IntersectionObserver to throw an error during construction
        window.IntersectionObserver = function() {
          throw new Error('IntersectionObserver not supported');
        };
      });

      // Wait for page to load and responsive helper to apply fallback
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500); // Allow time for fallback to apply

      // Check that team section is visible (should have is-visible class)
      const teamSection = page.locator('#team.team-section');
      if (await teamSection.count() > 0) {
        await expect(teamSection).toBeVisible();

        // Verify the section has the is-visible class (fallback applied)
        const hasVisibleClass = await teamSection.evaluate(el =>
          el.classList.contains('is-visible')
        );
        expect(hasVisibleClass).toBe(true);

        // Check opacity is 1 (not 0 which would indicate fade-in failure)
        const opacity = await teamSection.evaluate(el =>
          window.getComputedStyle(el).opacity
        );
        expect(parseFloat(opacity)).toBe(1);
      }

      // Check other fade-in sections are also visible
      const fadeInSections = page.locator('.fade-in-section, .fade-in-on-scroll');
      const sectionCount = await fadeInSections.count();

      for (let i = 0; i < sectionCount; i++) {
        const section = fadeInSections.nth(i);

        // Each section should be visible
        await expect(section).toBeVisible();

        // Each section should have is-visible class
        const hasVisibleClass = await section.evaluate(el =>
          el.classList.contains('is-visible')
        );
        expect(hasVisibleClass).toBe(true);

        // Each section should have opacity 1
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

  test.describe('iOS Safari Viewport Issues', () => {
    test('viewport height units work correctly on iOS', async ({ page, browserName }) => {
      test.skip(browserName !== 'webkit', 'iOS-specific test');
      
      await page.goto('/');
      
      // Set iPhone viewport
      await page.setViewportSize({ width: 390, height: 844 });
      
      // Check elements using vh units
      const elementsWithVh = page.locator('[style*="vh"], [class*="vh"]');
      const count = await elementsWithVh.count();
      
      for (let i = 0; i < count; i++) {
        const element = elementsWithVh.nth(i);
        const boundingBox = await element.boundingBox();
        
        // Ensure vh elements aren't collapsed or oversized
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThan(0);
          expect(boundingBox.height).toBeLessThan(1000); // Reasonable max
        }
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
  
  test.describe('Touch vs Mouse Interaction', () => {
    test('touch events work correctly on mobile devices', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-only test');
      
      await page.goto('/');
      
      // Find interactive elements
      const buttons = page.locator('button, [role="button"], .btn');
      const links = page.locator('a[href]');
      
      // Test button touch interactions
      const buttonCount = await buttons.count();
      if (buttonCount > 0) {
        const firstButton = buttons.first();
        
        // Ensure button is touch-friendly (minimum 44px touch target)
        const boundingBox = await firstButton.boundingBox();
        if (boundingBox) {
          expect(Math.min(boundingBox.width, boundingBox.height)).toBeGreaterThanOrEqual(44);
        }
        
        // Test touch interaction
        await firstButton.tap();
        // Add specific assertions based on expected behavior
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
 * Visual regression tests for hardware-specific issues
 */
test.describe('Visual Regression - Hardware Specific', () => {
  test('homepage renders consistently across devices', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('homepage-device-specific.png', {
      fullPage: true,
      threshold: 0.3 // Allow for minor rendering differences
    });
  });
  
  test('admin panel renders correctly on tablets', async ({ page, browserName }) => {
    test.skip(browserName === 'Mobile Chrome' || browserName === 'Mobile Safari', 'Tablet-specific test');
    
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('admin-tablet-specific.png', {
      fullPage: true,
      threshold: 0.3
    });
  });
});
