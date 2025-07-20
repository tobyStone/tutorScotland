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
      await page.goto('/');
      
      // Set portrait orientation viewport (Samsung Galaxy S9+ portrait)
      await page.setViewportSize({ width: 320, height: 658 });
      
      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000); // Allow time for any dynamic content
      
      // Check if there are any dynamic team sections
      const dynamicTeamSections = page.locator('.team-grid, .strive-team-card');
      const teamSectionCount = await dynamicTeamSections.count();
      
      if (teamSectionCount > 0) {
        // Test each team section
        for (let i = 0; i < teamSectionCount; i++) {
          const teamSection = dynamicTeamSections.nth(i);
          
          // Ensure section is visible
          await expect(teamSection).toBeVisible();
          
          // Check section width and positioning
          const boundingBox = await teamSection.boundingBox();
          if (boundingBox) {
            // Section should not be too narrow (minimum 280px for readability)
            expect(boundingBox.width).toBeGreaterThan(280);
            
            // Section should not overflow viewport
            expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(320);
            
            // Section should have reasonable right margin (not hugging edge)
            expect(boundingBox.x + boundingBox.width).toBeLessThan(315);
          }
          
          // Check team member cards within section
          const teamMembers = teamSection.locator('.team-member');
          const memberCount = await teamMembers.count();
          
          for (let j = 0; j < memberCount; j++) {
            const member = teamMembers.nth(j);
            await expect(member).toBeVisible();
            
            // Check member card styling
            const memberBox = await member.boundingBox();
            if (memberBox) {
              expect(memberBox.width).toBeGreaterThan(200); // Reasonable minimum width
            }
          }
        }
      }
      
      // Take screenshot for visual regression
      await expect(page).toHaveScreenshot('team-sections-portrait.png', {
        fullPage: true,
        threshold: 0.2
      });
    });
    
    test('team member sections display correctly in landscape orientation', async ({ page }) => {
      await page.goto('/');
      
      // Set landscape orientation viewport
      await page.setViewportSize({ width: 658, height: 320 });
      
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Check dynamic team sections in landscape
      const dynamicTeamSections = page.locator('.team-grid, .strive-team-card');
      const teamSectionCount = await dynamicTeamSections.count();
      
      if (teamSectionCount > 0) {
        for (let i = 0; i < teamSectionCount; i++) {
          const teamSection = dynamicTeamSections.nth(i);
          await expect(teamSection).toBeVisible();
          
          // In landscape, sections should have more width available
          const boundingBox = await teamSection.boundingBox();
          if (boundingBox) {
            expect(boundingBox.width).toBeGreaterThan(400);
          }
        }
      }
      
      await expect(page).toHaveScreenshot('team-sections-landscape.png', {
        fullPage: true,
        threshold: 0.2
      });
    });
  });
  
  test.describe('Overall Layout Preservation', () => {
    test('homepage maintains correct styling across viewports', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Test multiple viewport sizes to ensure responsive design integrity
      const viewports = [
        { width: 1920, height: 1080, name: 'desktop-large' },
        { width: 1200, height: 800, name: 'desktop-medium' },
        { width: 768, height: 1024, name: 'tablet-portrait' },
        { width: 390, height: 844, name: 'iphone-portrait' },
        { width: 320, height: 658, name: 'samsung-portrait' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500); // Allow layout to settle
        
        // Check key elements are visible and positioned correctly
        await expect(page.locator('header')).toBeVisible();
        await expect(page.locator('nav')).toBeVisible();
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('footer')).toBeVisible();
        
        // Take screenshot for each viewport
        await expect(page).toHaveScreenshot(`homepage-${viewport.name}.png`, {
          fullPage: true,
          threshold: 0.2
        });
      }
    });
    
    test('dynamic sections maintain consistent styling', async ({ page }) => {
      // Test a page that likely has dynamic sections
      await page.goto('/about.html');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Check for dynamic section containers
      const dynamicContainers = page.locator('#dynamicSections, #dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSectionsBottom');
      const containerCount = await dynamicContainers.count();
      
      if (containerCount > 0) {
        for (let i = 0; i < containerCount; i++) {
          const container = dynamicContainers.nth(i);
          
          // Check container is properly positioned
          const boundingBox = await container.boundingBox();
          if (boundingBox) {
            // Container should not be off-screen
            expect(boundingBox.x).toBeGreaterThanOrEqual(0);
            expect(boundingBox.width).toBeGreaterThan(0);
          }
          
          // Check individual dynamic sections within container
          const sections = container.locator('.dynamic-section-container, .dyn-block');
          const sectionCount = await sections.count();
          
          for (let j = 0; j < sectionCount; j++) {
            const section = sections.nth(j);
            await expect(section).toBeVisible();
            
            // Check section styling consistency
            const sectionStyles = await section.evaluate(el => {
              const styles = window.getComputedStyle(el);
              return {
                backgroundColor: styles.backgroundColor,
                borderRadius: styles.borderRadius,
                padding: styles.padding,
                margin: styles.margin
              };
            });
            
            // Sections should have consistent styling
            expect(sectionStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
            expect(sectionStyles.borderRadius).not.toBe('0px'); // Should have rounded corners
          }
        }
      }
      
      await expect(page).toHaveScreenshot('dynamic-sections-styling.png', {
        fullPage: true,
        threshold: 0.2
      });
    });
  });
  
  test.describe('Critical UI Elements', () => {
    test('navigation maintains consistent styling', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      const nav = page.locator('nav, .main-nav');
      await expect(nav).toBeVisible();
      
      // Check navigation styling
      const navStyles = await nav.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          position: styles.position,
          zIndex: styles.zIndex
        };
      });
      
      // Navigation should have proper styling
      expect(navStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(parseInt(navStyles.zIndex)).toBeGreaterThan(0);
      
      await expect(page).toHaveScreenshot('navigation-styling.png', {
        threshold: 0.1
      });
    });
    
    test('footer maintains consistent styling', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      const footer = page.locator('footer, .site-footer');
      await expect(footer).toBeVisible();
      
      // Check footer social icons
      const socialIcons = footer.locator('.footer-icons a, .social-icons a');
      const iconCount = await socialIcons.count();
      
      // Should have Facebook and Instagram icons only
      expect(iconCount).toBeLessThanOrEqual(2);
      
      if (iconCount > 0) {
        for (let i = 0; i < iconCount; i++) {
          const icon = socialIcons.nth(i);
          await expect(icon).toBeVisible();
        }
      }
      
      await expect(page).toHaveScreenshot('footer-styling.png', {
        threshold: 0.1
      });
    });
  });
});
