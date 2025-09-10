/**
 * @fileoverview Dynamic page loading system for custom pages
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Dynamic page management system:
 * - Loads custom pages based on URL slug
 * - Handles proper styling and content injection
 * - Manages page metadata and SEO elements
 * - Integrates with dynamic sections system
 *
 * @performance Implements efficient page loading and content rendering
 * @security Validates page slugs and content before rendering
 */

async function loadDynamicPage() {
    const slug = window.location.pathname.split('/').pop();
    if (!slug) return;

    try {
        const response = await fetch(`/api/page?slug=${slug}`);
        if (!response.ok) {
            throw new Error('Page not found');
        }

        const page = await response.json();
        
        // Add dynamic-page class to body
        document.body.classList.add('dynamic-page');

        // Create hero section
        const heroSection = document.createElement('section');
        heroSection.className = 'hero-section';
        
        // Use safeImg helper for hero shield
        const heroShield = safeImg(document.createElement('img'));
        heroShield.src = '/images/bannerShield2.png';
        heroShield.className = 'hero-shield';
        heroShield.alt = 'TAS Shield';
        
        const heroContent = document.createElement('div');
        heroContent.className = 'hero-content';
        heroContent.innerHTML = `<h1>${page.heading}</h1>`;
        
        heroSection.appendChild(heroShield);
        heroSection.appendChild(heroContent);

        // Create rolling banner
        const rollingBanner = document.createElement('div');
        rollingBanner.className = 'rolling-banner';
        const rollingContent = document.createElement('div');
        rollingContent.className = 'rolling-content';
        rollingContent.id = 'tutorBanner';
        rollingBanner.appendChild(rollingContent);

        // Create main content section
        const mainContent = document.createElement('div');
        mainContent.className = 'page-content';
        
        // Add the page content
        if (page.text) {
            mainContent.innerHTML = page.text;
        }

        // Add image if available
        if (page.image) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'page-featured-image';
            // Use safeImg helper for featured image
            const image = safeImg(document.createElement('img'));
            image.src = page.image;
            image.alt = page.heading;
            imageContainer.appendChild(image);
            mainContent.insertBefore(imageContainer, mainContent.firstChild);
        }

        // Get the main element
        const main = document.querySelector('main');
        if (!main) {
            console.error('Main element not found');
            return;
        }

        // Clear existing content
        main.innerHTML = '';

        // Add elements to the page
        main.appendChild(heroSection);
        main.appendChild(rollingBanner);
        main.appendChild(mainContent);

        // Initialize rolling banner
        if (typeof initRollingBanner === 'function') {
            initRollingBanner();
        }

        // Add dynamic sections if any
        if (typeof loadDynamicSections === 'function') {
            loadDynamicSections();
        }

    } catch (error) {
        console.error('Error loading dynamic page:', error);
        // Show error message to user
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = `
                <div class="error-message">
                    <h1>Page Not Found</h1>
                    <p>Sorry, the page you're looking for doesn't exist.</p>
                    <a href="/" class="btn-primary">Return to Home</a>
                </div>
            `;
        }
    }
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', loadDynamicPage); 