import { test, expect } from '@playwright/test';

/**
 * Cross-Browser Dynamic Section Tests
 * 
 * These tests ensure dynamic sections render consistently across different
 * browsers and devices, with special focus on mobile portrait orientation
 * where we've been fine-tuning the alignment.
 */

test.describe('Cross-Browser Dynamic Section Consistency', () => {
  
  // Critical test configurations based on real user devices
  const testConfigurations = [
    {
      name: 'iPhone XR Portrait',
      viewport: { width: 414, height: 896 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    {
      name: 'Samsung Galaxy Portrait',
      viewport: { width: 360, height: 740 },
      userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36'
    },
    {
      name: 'iPad Portrait',
      viewport: { width: 768, height: 1024 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    {
      name: 'Desktop Chrome',
      viewport: { width: 1200, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  ];

  // Test pages that are likely to have dynamic sections
  const testPages = [
    { url: '/', name: 'Homepage' },
    { url: '/about-us.html', name: 'About Us' },
    { url: '/contact.html', name: 'Contact' }
  ];

  test.describe('Browser-Specific Rendering', () => {
    
    for (const config of testConfigurations) {
      test(`dynamic sections render correctly on ${config.name}`, async ({ page, browserName }) => {
        // Set viewport and user agent
        await page.setViewportSize(config.viewport);
        if (config.userAgent) {
          await page.setExtraHTTPHeaders({
            'User-Agent': config.userAgent
          });
        }
        
        console.log(`Testing ${config.name} on ${browserName}`);
        
        let foundSections = false;
        
        for (const testPage of testPages) {
          await page.goto(testPage.url);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(3000); // Allow dynamic content to load
          
          // Check for dynamic sections
          const dynamicSections = page.locator('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
          const containerCount = await dynamicSections.count();
          
          if (containerCount > 0) {
            console.log(`Found ${containerCount} dynamic section containers on ${testPage.name}`);
            
            for (let i = 0; i < containerCount; i++) {
              const container = dynamicSections.nth(i);
              const hasContent = await container.locator('.dyn-block, .strive-team-card').count() > 0;
              
              if (hasContent) {
                foundSections = true;
                
                // Validate container is visible and positioned correctly
                await expect(container).toBeVisible();
                
                const boundingBox = await container.boundingBox();
                expect(boundingBox).toBeTruthy();
                
                // Check positioning is reasonable for this viewport
                expect(boundingBox.left).toBeGreaterThanOrEqual(0);
                expect(boundingBox.left).toBeLessThan(config.viewport.width);
                expect(boundingBox.width).toBeGreaterThan(0);
                expect(boundingBox.width).toBeLessThanOrEqual(config.viewport.width);
                
                // Validate CSS transforms are applied correctly for mobile
                if (config.viewport.width <= 1200) {
                  const containerStyles = await container.evaluate(el => {
                    const computedStyle = window.getComputedStyle(el);
                    return {
                      transform: computedStyle.transform,
                      width: computedStyle.width,
                      marginLeft: computedStyle.marginLeft,
                      marginRight: computedStyle.marginRight
                    };
                  });
                  
                  console.log(`${config.name} container styles:`, containerStyles);
                  
                  // Mobile devices should have transforms applied
                  if (config.viewport.height > config.viewport.width) { // Portrait
                    expect(containerStyles.transform).toContain('translateX');
                  }
                }
                
                // Test individual sections within container
                const sections = container.locator('.dyn-block, .strive-team-card');
                const sectionCount = await sections.count();
                
                for (let j = 0; j < sectionCount; j++) {
                  const section = sections.nth(j);
                  await expect(section).toBeVisible();
                  
                  const sectionBox = await section.boundingBox();
                  expect(sectionBox).toBeTruthy();
                  
                  // Sections should be within container bounds
                  expect(sectionBox.left).toBeGreaterThanOrEqual(boundingBox.left - 10); // Small tolerance
                  expect(sectionBox.left + sectionBox.width).toBeLessThanOrEqual(boundingBox.left + boundingBox.width + 10);
                }
              }
            }
          }
        }
        
        if (!foundSections) {
          console.log(`No dynamic sections found on ${config.name} - this may be expected`);
        }
      });
    }
  });

  test.describe('Mobile Portrait Orientation Focus', () => {
    
    // Special focus on mobile portrait since this is where we've been fine-tuning
    const mobilePortraitConfigs = [
      { name: 'iPhone XR', width: 414, height: 896 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'Samsung Galaxy S9+', width: 320, height: 658 },
      { name: 'Pixel 5', width: 393, height: 851 }
    ];
    
    for (const mobile of mobilePortraitConfigs) {
      test(`mobile portrait alignment on ${mobile.name}`, async ({ page }) => {
        await page.setViewportSize({ width: mobile.width, height: mobile.height });
        
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        
        // Check that our portrait-specific CSS is working
        const portraitAlignment = await page.evaluate(() => {
          const containers = document.querySelectorAll('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
          return Array.from(containers).map(container => {
            const rect = container.getBoundingClientRect();
            const style = window.getComputedStyle(container);
            
            return {
              id: container.id,
              hasContent: container.children.length > 0,
              visible: style.display !== 'none',
              positioning: {
                left: rect.left,
                width: rect.width,
                transform: style.transform,
                centerPoint: rect.left + (rect.width / 2)
              }
            };
          });
        });
        
        console.log(`${mobile.name} portrait alignment:`, portraitAlignment);
        
        // Validate alignment for containers with content
        const visibleContainers = portraitAlignment.filter(c => c.visible && c.hasContent);
        
        for (const container of visibleContainers) {
          // Container should be reasonably centered
          const viewportCenter = mobile.width / 2;
          const containerCenter = container.positioning.centerPoint;
          const centerOffset = Math.abs(containerCenter - viewportCenter);
          
          // Allow some tolerance for our intentional left-shift alignment
          expect(centerOffset).toBeLessThan(mobile.width * 0.3); // Within 30% of viewport width
          
          // Transform should be applied for portrait orientation
          expect(container.positioning.transform).toContain('translateX');
          
          console.log(`Container ${container.id} center offset: ${centerOffset}px (viewport center: ${viewportCenter}px)`);
        }
      });
    }
  });

  test.describe('Section Type Consistency Across Browsers', () => {
    
    test('standard sections render consistently across browsers', async ({ page, browserName }) => {
      await page.setViewportSize({ width: 414, height: 896 }); // iPhone XR
      
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      
      const standardSections = page.locator('.dyn-block:not(:has(.strive-team-card)):not(:has(.team-grid))');
      const count = await standardSections.count();
      
      if (count > 0) {
        console.log(`Found ${count} standard sections on ${browserName}`);
        
        for (let i = 0; i < count; i++) {
          const section = standardSections.nth(i);
          
          // Basic visibility and structure
          await expect(section).toBeVisible();
          
          // Check for expected elements
          const hasTitle = await section.locator('h2, h3, h4').count() > 0;
          const hasContent = await section.locator('p, div, img').count() > 0;
          expect(hasTitle || hasContent).toBeTruthy();
          
          // Validate styling consistency
          const sectionStyles = await section.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              backgroundColor: style.backgroundColor,
              borderRadius: style.borderRadius,
              padding: style.padding,
              margin: style.margin
            };
          });
          
          console.log(`Standard section ${i} styles on ${browserName}:`, sectionStyles);
          
          // Standard sections should have consistent styling
          expect(sectionStyles.backgroundColor).toBeTruthy();
          expect(sectionStyles.borderRadius).toBeTruthy();
        }
      }
    });
    
    test('team sections render consistently across browsers', async ({ page, browserName }) => {
      await page.setViewportSize({ width: 414, height: 896 });
      
      await page.goto('/about-us.html'); // More likely to have team sections
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      
      const teamSections = page.locator('.strive-team-card, .team-grid');
      const count = await teamSections.count();
      
      if (count > 0) {
        console.log(`Found ${count} team sections on ${browserName}`);
        
        for (let i = 0; i < count; i++) {
          const section = teamSections.nth(i);
          
          await expect(section).toBeVisible();
          
          // Team sections should have specific elements
          const hasTeamElements = await section.evaluate(el => {
            return {
              hasName: el.querySelector('.team-name, .member-name, h3, h4') !== null,
              hasRole: el.querySelector('.team-role, .member-role, .role') !== null,
              hasImage: el.querySelector('img') !== null
            };
          });
          
          console.log(`Team section ${i} elements on ${browserName}:`, hasTeamElements);
          
          // At least name should be present
          expect(hasTeamElements.hasName).toBeTruthy();
        }
      }
    });
  });

  test.describe('Performance and Loading Consistency', () => {
    
    test('dynamic sections load within acceptable time across browsers', async ({ page, browserName }) => {
      await page.setViewportSize({ width: 414, height: 896 });
      
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for dynamic sections to load and become visible
      await page.waitForFunction(() => {
        const sections = document.querySelectorAll('.dyn-block, .strive-team-card');
        return Array.from(sections).some(section => {
          const style = window.getComputedStyle(section);
          return style.opacity === '1' && style.visibility === 'visible';
        });
      }, { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      console.log(`Dynamic sections loaded in ${loadTime}ms on ${browserName}`);
      
      // Should load within reasonable time (10 seconds max)
      expect(loadTime).toBeLessThan(10000);
      
      // Validate sections are actually visible
      const visibleSections = await page.locator('.dyn-block:visible, .strive-team-card:visible').count();
      if (visibleSections > 0) {
        console.log(`${visibleSections} sections are visible on ${browserName}`);
      }
    });
  });
});
