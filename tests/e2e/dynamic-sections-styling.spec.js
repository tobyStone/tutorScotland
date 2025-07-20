import { test, expect } from '@playwright/test';

/**
 * Dynamic Section Styling Tests
 * 
 * These tests ensure consistent styling across all dynamic section types
 * and protect against regressions when adding new section types (list, testimonial).
 * 
 * Test Strategy:
 * 1. Capture current "golden state" styling for standard and team sections
 * 2. Test responsive behavior across different viewports
 * 3. Validate CSS alignment and positioning rules
 * 4. Prepare framework for testing future section types
 */

test.describe('Dynamic Section Styling Consistency', () => {
  
  // Test pages that might have dynamic sections
  const testPages = [
    { url: '/', name: 'Homepage' },
    { url: '/about-us.html', name: 'About Us' },
    { url: '/tutors.html', name: 'Tutors' },
    { url: '/contact.html', name: 'Contact' }
  ];

  // Viewport configurations for responsive testing
  const viewports = [
    { name: 'iPhone XR Portrait', width: 414, height: 896, orientation: 'portrait' },
    { name: 'iPhone XR Landscape', width: 896, height: 414, orientation: 'landscape' },
    { name: 'Samsung Galaxy Portrait', width: 360, height: 740, orientation: 'portrait' },
    { name: 'iPad Portrait', width: 768, height: 1024, orientation: 'portrait' },
    { name: 'Desktop', width: 1200, height: 800, orientation: 'landscape' }
  ];

  test.describe('Standard Dynamic Sections', () => {
    
    for (const viewport of viewports) {
      test(`standard sections align correctly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        
        let foundStandardSections = false;
        
        for (const testPage of testPages) {
          await page.goto(testPage.url);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(3000); // Allow dynamic content to load
          
          // Look for standard dynamic sections (non-team sections)
          const standardSections = page.locator('.dyn-block:not(:has(.strive-team-card)):not(:has(.team-grid))');
          const sectionCount = await standardSections.count();
          
          if (sectionCount > 0) {
            foundStandardSections = true;
            console.log(`Found ${sectionCount} standard sections on ${testPage.name} (${viewport.name})`);
            
            // Test each standard section
            for (let i = 0; i < sectionCount; i++) {
              const section = standardSections.nth(i);
              
              // Check section is visible and properly positioned
              await expect(section).toBeVisible();
              
              // Get computed styles for alignment validation
              const boundingBox = await section.boundingBox();
              expect(boundingBox).toBeTruthy();
              
              // Validate section width and positioning for portrait orientation
              if (viewport.orientation === 'portrait' && viewport.width <= 1200) {
                // Standard sections should use 83% width with -9% transform
                const containerStyles = await section.evaluate(el => {
                  const container = el.closest('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
                  if (!container) return null;
                  
                  const computedStyle = window.getComputedStyle(container);
                  return {
                    width: computedStyle.width,
                    transform: computedStyle.transform,
                    marginLeft: computedStyle.marginLeft,
                    marginRight: computedStyle.marginRight
                  };
                });
                
                if (containerStyles) {
                  console.log(`Standard section container styles on ${testPage.name}:`, containerStyles);
                  
                  // Validate that transform is applied (should contain translateX)
                  expect(containerStyles.transform).toContain('translateX');
                }
              }
              
              // Check section has proper styling classes
              const sectionClasses = await section.getAttribute('class');
              expect(sectionClasses).toContain('dyn-block');
              
              // Validate section content structure
              const hasTitle = await section.locator('h2, h3, h4').count() > 0;
              const hasContent = await section.locator('p, div, img').count() > 0;
              expect(hasTitle || hasContent).toBeTruthy();
            }
          }
        }
        
        // Log if no standard sections were found (not necessarily an error)
        if (!foundStandardSections) {
          console.log(`No standard dynamic sections found for ${viewport.name} - this may be expected`);
        }
      });
    }
  });

  test.describe('Team Member Dynamic Sections', () => {
    
    for (const viewport of viewports) {
      test(`team sections align correctly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        
        let foundTeamSections = false;
        
        for (const testPage of testPages) {
          await page.goto(testPage.url);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(3000);
          
          // Look for team member sections
          const teamSections = page.locator('.strive-team-card, .team-grid, .team-members');
          const teamCount = await teamSections.count();
          
          if (teamCount > 0) {
            foundTeamSections = true;
            console.log(`Found ${teamCount} team sections on ${testPage.name} (${viewport.name})`);
            
            // Test each team section
            for (let i = 0; i < teamCount; i++) {
              const teamSection = teamSections.nth(i);
              
              await expect(teamSection).toBeVisible();
              
              const boundingBox = await teamSection.boundingBox();
              expect(boundingBox).toBeTruthy();
              
              // Validate team section positioning for portrait orientation
              if (viewport.orientation === 'portrait' && viewport.width <= 1200) {
                // Team sections should use 99% width with -1% transform
                const containerStyles = await teamSection.evaluate(el => {
                  const container = el.closest('.dynamic-section-container') || 
                                  el.closest('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
                  if (!container) return null;
                  
                  const computedStyle = window.getComputedStyle(container);
                  return {
                    width: computedStyle.width,
                    transform: computedStyle.transform,
                    marginLeft: computedStyle.marginLeft,
                    marginRight: computedStyle.marginRight
                  };
                });
                
                if (containerStyles) {
                  console.log(`Team section container styles on ${testPage.name}:`, containerStyles);
                  
                  // Team sections should have minimal transform
                  expect(containerStyles.transform).toContain('translateX');
                }
              }
              
              // Check for team-specific elements
              const hasTeamCard = await teamSection.locator('.strive-team-card').count() > 0;
              const hasTeamGrid = await teamSection.locator('.team-grid').count() > 0;
              expect(hasTeamCard || hasTeamGrid).toBeTruthy();
            }
          }
        }
        
        if (!foundTeamSections) {
          console.log(`No team dynamic sections found for ${viewport.name} - this may be expected`);
        }
      });
    }
  });

  test.describe('Section Container Consistency', () => {
    
    test('all dynamic section containers have consistent base styling', async ({ page }) => {
      await page.setViewportSize({ width: 414, height: 896 }); // iPhone XR Portrait
      
      for (const testPage of testPages) {
        await page.goto(testPage.url);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        
        // Check all dynamic section containers
        const containers = page.locator('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
        const containerCount = await containers.count();
        
        if (containerCount > 0) {
          console.log(`Found ${containerCount} dynamic section containers on ${testPage.name}`);
          
          for (let i = 0; i < containerCount; i++) {
            const container = containers.nth(i);
            
            // Check container has proper class
            const containerClasses = await container.getAttribute('class');
            expect(containerClasses).toContain('dynamic-section-container');
            
            // Validate container positioning
            const containerStyles = await container.evaluate(el => {
              const computedStyle = window.getComputedStyle(el);
              return {
                display: computedStyle.display,
                position: computedStyle.position,
                maxWidth: computedStyle.maxWidth,
                margin: computedStyle.margin
              };
            });
            
            console.log(`Container ${i} styles on ${testPage.name}:`, containerStyles);
            
            // Containers should be block-level and centered
            expect(containerStyles.display).not.toBe('none');
            expect(containerStyles.maxWidth).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Future Section Type Preparation', () => {
    
    test('framework ready for list and testimonial section types', async ({ page }) => {
      // This test validates our CSS framework can handle new section types
      await page.setViewportSize({ width: 414, height: 896 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      // Inject mock list and testimonial sections to test CSS framework
      await page.evaluate(() => {
        const container = document.getElementById('dynamicSections');
        if (container) {
          // Mock list section
          const listSection = document.createElement('div');
          listSection.className = 'dyn-block list-section';
          listSection.innerHTML = `
            <h2>Test List Section</h2>
            <ul>
              <li>List item 1</li>
              <li>List item 2</li>
              <li>List item 3</li>
            </ul>
          `;
          
          // Mock testimonial section
          const testimonialSection = document.createElement('div');
          testimonialSection.className = 'dyn-block testimonial-section';
          testimonialSection.innerHTML = `
            <h2>Test Testimonial</h2>
            <blockquote>
              <p>"This is a test testimonial quote."</p>
              <cite>Test Author</cite>
            </blockquote>
          `;
          
          container.appendChild(listSection);
          container.appendChild(testimonialSection);
        }
      });
      
      // Wait for elements to be added
      await page.waitForTimeout(1000);
      
      // Test that mock sections inherit proper styling
      const listSection = page.locator('.list-section');
      const testimonialSection = page.locator('.testimonial-section');
      
      await expect(listSection).toBeVisible();
      await expect(testimonialSection).toBeVisible();
      
      // Both should inherit dyn-block styling
      const listBoundingBox = await listSection.boundingBox();
      const testimonialBoundingBox = await testimonialSection.boundingBox();
      
      expect(listBoundingBox).toBeTruthy();
      expect(testimonialBoundingBox).toBeTruthy();
      
      console.log('List section positioning:', listBoundingBox);
      console.log('Testimonial section positioning:', testimonialBoundingBox);
    });
  });
});
