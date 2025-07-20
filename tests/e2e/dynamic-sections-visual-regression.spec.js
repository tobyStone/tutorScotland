import { test, expect } from '@playwright/test';

/**
 * Dynamic Section Visual Regression Tests
 * 
 * These tests capture the current "golden state" of dynamic section layouts
 * and detect visual regressions when new section types are added.
 * 
 * CRITICAL: These tests establish the baseline for our current working alignment.
 * Any failures after adding list/testimonial sections indicate layout regressions.
 */

test.describe('Dynamic Section Visual Regression - Golden State Protection', () => {
  
  // Critical viewport that we've been fine-tuning
  const criticalViewport = { width: 414, height: 896 }; // iPhone XR Portrait
  
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for all visual regression tests
    await page.setViewportSize(criticalViewport);
    
    // Ensure consistent font rendering
    await page.addStyleTag({
      content: `
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `
    });
  });

  test.describe('Homepage Dynamic Sections - Golden State', () => {
    
    test('homepage dynamic sections maintain current alignment', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for dynamic content and animations to complete
      await page.waitForTimeout(5000);
      
      // Wait for any fade-in animations to complete
      await page.waitForFunction(() => {
        const sections = document.querySelectorAll('.dyn-block');
        return Array.from(sections).every(section => {
          const style = window.getComputedStyle(section);
          return style.opacity === '1' && style.transform !== 'translateY(20px)';
        });
      }, { timeout: 10000 });
      
      // Check if we have dynamic sections
      const dynamicSections = page.locator('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
      const sectionCount = await dynamicSections.count();
      
      if (sectionCount > 0) {
        console.log(`Found ${sectionCount} dynamic section containers on homepage`);
        
        // Take screenshot of each container that has content
        for (let i = 0; i < sectionCount; i++) {
          const container = dynamicSections.nth(i);
          const hasContent = await container.locator('.dyn-block, .strive-team-card').count() > 0;
          
          if (hasContent) {
            const containerId = await container.getAttribute('id');
            console.log(`Taking screenshot of container: ${containerId}`);
            
            // Screenshot the container with some padding
            await expect(container).toHaveScreenshot(`homepage-${containerId}-golden-state.png`, {
              fullPage: false,
              clip: await container.boundingBox().then(box => ({
                x: Math.max(0, box.x - 20),
                y: Math.max(0, box.y - 20),
                width: Math.min(criticalViewport.width, box.width + 40),
                height: box.height + 40
              }))
            });
          }
        }
        
        // Take full page screenshot showing all dynamic sections in context
        await expect(page).toHaveScreenshot('homepage-all-dynamic-sections-golden-state.png', {
          fullPage: true
        });
      } else {
        console.log('No dynamic sections found on homepage - creating baseline for empty state');
        await expect(page).toHaveScreenshot('homepage-no-dynamic-sections-baseline.png');
      }
    });
  });

  test.describe('About Us Dynamic Sections - Golden State', () => {
    
    test('about-us dynamic sections maintain current alignment', async ({ page }) => {
      await page.goto('/about-us.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(5000);
      
      // Wait for animations
      await page.waitForFunction(() => {
        const sections = document.querySelectorAll('.dyn-block, .strive-team-card');
        return Array.from(sections).every(section => {
          const style = window.getComputedStyle(section);
          return style.opacity === '1';
        });
      }, { timeout: 10000 });
      
      const dynamicSections = page.locator('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
      const sectionCount = await dynamicSections.count();
      
      if (sectionCount > 0) {
        console.log(`Found ${sectionCount} dynamic section containers on about-us`);
        
        for (let i = 0; i < sectionCount; i++) {
          const container = dynamicSections.nth(i);
          const hasContent = await container.locator('.dyn-block, .strive-team-card').count() > 0;
          
          if (hasContent) {
            const containerId = await container.getAttribute('id');
            console.log(`Taking screenshot of container: ${containerId}`);
            
            await expect(container).toHaveScreenshot(`about-us-${containerId}-golden-state.png`, {
              fullPage: false,
              clip: await container.boundingBox().then(box => ({
                x: Math.max(0, box.x - 20),
                y: Math.max(0, box.y - 20),
                width: Math.min(criticalViewport.width, box.width + 40),
                height: box.height + 40
              }))
            });
          }
        }
        
        await expect(page).toHaveScreenshot('about-us-all-dynamic-sections-golden-state.png', {
          fullPage: true
        });
      } else {
        await expect(page).toHaveScreenshot('about-us-no-dynamic-sections-baseline.png');
      }
    });
  });

  test.describe('Section Type Specific Visual Baselines', () => {
    
    test('standard sections visual baseline', async ({ page }) => {
      // Test across multiple pages to find standard sections
      const pages = ['/', '/about-us.html', '/contact.html'];
      let foundStandardSections = false;
      
      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        
        // Look for standard sections (non-team sections)
        const standardSections = page.locator('.dyn-block:not(:has(.strive-team-card)):not(:has(.team-grid))');
        const count = await standardSections.count();
        
        if (count > 0) {
          foundStandardSections = true;
          console.log(`Found ${count} standard sections on ${pageUrl}`);
          
          // Screenshot each standard section
          for (let i = 0; i < count; i++) {
            const section = standardSections.nth(i);
            const pageName = pageUrl.replace('/', '').replace('.html', '') || 'home';
            
            await expect(section).toHaveScreenshot(`standard-section-${pageName}-${i}-golden-state.png`);
          }
        }
      }
      
      if (!foundStandardSections) {
        console.log('No standard sections found - this may be expected');
      }
    });
    
    test('team member sections visual baseline', async ({ page }) => {
      const pages = ['/', '/about-us.html'];
      let foundTeamSections = false;
      
      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        
        const teamSections = page.locator('.strive-team-card, .team-grid');
        const count = await teamSections.count();
        
        if (count > 0) {
          foundTeamSections = true;
          console.log(`Found ${count} team sections on ${pageUrl}`);
          
          for (let i = 0; i < count; i++) {
            const section = teamSections.nth(i);
            const pageName = pageUrl.replace('/', '').replace('.html', '') || 'home';
            
            await expect(section).toHaveScreenshot(`team-section-${pageName}-${i}-golden-state.png`);
          }
        }
      }
      
      if (!foundTeamSections) {
        console.log('No team sections found - this may be expected');
      }
    });
  });

  test.describe('Container Positioning Baselines', () => {
    
    test('dynamic section containers positioning baseline', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      
      // Get positioning data for all containers
      const containerData = await page.evaluate(() => {
        const containers = document.querySelectorAll('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
        return Array.from(containers).map(container => {
          const rect = container.getBoundingClientRect();
          const style = window.getComputedStyle(container);
          
          return {
            id: container.id,
            visible: style.display !== 'none',
            hasContent: container.children.length > 0,
            positioning: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              transform: style.transform,
              marginLeft: style.marginLeft,
              marginRight: style.marginRight
            }
          };
        });
      });
      
      console.log('Container positioning baseline data:', JSON.stringify(containerData, null, 2));
      
      // Store this data for comparison in future tests
      expect(containerData).toBeTruthy();
      
      // Validate that containers with content are positioned correctly
      const visibleContainers = containerData.filter(c => c.visible && c.hasContent);
      
      for (const container of visibleContainers) {
        // Containers should be centered (left position should be reasonable)
        expect(container.positioning.left).toBeGreaterThan(0);
        expect(container.positioning.left).toBeLessThan(criticalViewport.width);
        
        // Width should be reasonable for mobile
        expect(container.positioning.width).toBeGreaterThan(200);
        expect(container.positioning.width).toBeLessThan(criticalViewport.width);
        
        console.log(`Container ${container.id} positioning validated:`, container.positioning);
      }
    });
  });

  test.describe('Responsive Behavior Baselines', () => {
    
    test('portrait orientation alignment baseline', async ({ page }) => {
      // This test captures the current portrait alignment we've been perfecting
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      
      // Verify we're in portrait mode
      const viewport = page.viewportSize();
      expect(viewport.height).toBeGreaterThan(viewport.width);
      
      // Check that our portrait-specific CSS is applied
      const portraitStyles = await page.evaluate(() => {
        const containers = document.querySelectorAll('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
        return Array.from(containers).map(container => {
          const style = window.getComputedStyle(container);
          return {
            id: container.id,
            width: style.width,
            transform: style.transform,
            marginLeft: style.marginLeft,
            marginRight: style.marginRight
          };
        });
      });
      
      console.log('Portrait orientation styles baseline:', JSON.stringify(portraitStyles, null, 2));
      
      // Validate that portrait-specific transforms are applied
      const containersWithContent = portraitStyles.filter(style => 
        style.transform && style.transform !== 'none'
      );
      
      for (const style of containersWithContent) {
        expect(style.transform).toContain('translateX');
        console.log(`Container ${style.id} has portrait transform: ${style.transform}`);
      }
    });
  });
});
