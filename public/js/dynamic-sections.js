/**
 * Dynamic Sections Loader
 *
 * This script handles loading and displaying dynamic sections for all pages.
 * It ensures that dynamic sections are properly positioned at the top, middle, or bottom
 * of the page content based on the admin's selection.
 */

/**
 * Load dynamic sections for the current page
 */
function loadDynamicSections() {
    const page = location.pathname.replace(/^\//, '').split('.')[0] || 'index';

    // For pages with a slug parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug') || page;

    console.log(`Loading dynamic sections for page: ${page}`);

    fetch(`/api/sections?page=${slug}`)
        .then(r => r.json())
        .then(list => {
            if (list && list.length > 0) {
                // Get containers for different positions
                const topContainer = document.getElementById('dynamicSectionsTop');
                const middleContainer = document.getElementById('dynamicSectionsMiddle');
                const bottomContainer = document.getElementById('dynamicSections'); // Legacy container

                // Check if containers exist
                if (!topContainer) {
                    console.log('Creating top container');
                    createPositionContainer('top');
                }

                if (!middleContainer) {
                    console.log('Creating middle container');
                    createPositionContainer('middle');
                }

                if (!bottomContainer) {
                    console.error('No bottom dynamicSections container found in the page');
                    return;
                }

                // Add the dynamic-section-container class to the bottom container for consistency
                if (!bottomContainer.classList.contains('dynamic-section-container')) {
                    bottomContainer.classList.add('dynamic-section-container');
                }

                // Clear existing content
                document.getElementById('dynamicSectionsTop').innerHTML = '';
                document.getElementById('dynamicSectionsMiddle').innerHTML = '';
                bottomContainer.innerHTML = '';

                // Group sections by position
                const topSections = list.filter(s => s.position === 'top');
                const middleSections = list.filter(s => s.position === 'middle');
                const bottomSections = list.filter(s => s.position === 'bottom' || !s.position);

                // Add sections to their respective containers
                addSectionsToContainer(topSections, 'dynamicSectionsTop');
                addSectionsToContainer(middleSections, 'dynamicSectionsMiddle');
                addSectionsToContainer(bottomSections, 'dynamicSections');

                // Show/hide containers based on content
                toggleContainerVisibility('dynamicSectionsTop', topSections.length > 0);
                toggleContainerVisibility('dynamicSectionsMiddle', middleSections.length > 0);
                toggleContainerVisibility('dynamicSections', bottomSections.length > 0);

                // Show/hide separators
                const topSeparator = document.querySelector('.dynamic-sections-separator-top');
                const middleSeparator = document.querySelector('.dynamic-sections-separator-middle');
                const bottomSeparator = document.querySelector('.dynamic-sections-separator');

                if (topSeparator) topSeparator.style.display = topSections.length > 0 ? 'block' : 'none';
                if (middleSeparator) middleSeparator.style.display = middleSections.length > 0 ? 'block' : 'none';
                if (bottomSeparator) bottomSeparator.style.display = bottomSections.length > 0 ? 'block' : 'none';

                // Add a class to the body to indicate dynamic sections are present
                document.body.classList.add('has-dynamic-sections');

                // Apply observer to newly created elements
                if (window.dynamicSectionsObserver) {
                    document
                        .querySelectorAll('.dyn-block.fade-in-on-scroll')
                        .forEach(el => window.dynamicSectionsObserver.observe(el));
                }
            } else {
                // If no dynamic sections, hide all containers and separators
                hideAllContainers();
            }
        })
        .catch(error => {
            console.error('Error loading dynamic sections:', error);
            // Hide all containers and separators on error
            hideAllContainers();
        });
}

/**
 * Create containers for all positions if they don't exist
 * This function creates all three containers at once to ensure proper positioning
 */
function createPositionContainer(position) {
    // Only create containers if they don't already exist
    const main = document.querySelector('main');
    if (!main) {
        console.error('No main element found in the page');
        return;
    }

    // Remove any existing containers first to avoid duplicates
    const existingTop = document.getElementById('dynamicSectionsTop');
    const existingMiddle = document.getElementById('dynamicSectionsMiddle');
    const existingBottom = document.getElementById('dynamicSections');

    if (existingTop) existingTop.remove();
    if (existingMiddle) existingMiddle.remove();
    // Don't remove the bottom container as it might be a static placeholder

    // Get all children of main
    const mainChildren = Array.from(main.children);

    // Create all three containers

    // 1. TOP CONTAINER - Insert at the very beginning of main
    const topSeparator = document.createElement('div');
    topSeparator.className = 'dynamic-sections-separator-top';
    topSeparator.style.display = 'none';

    const topContainer = document.createElement('section');
    topContainer.id = 'dynamicSectionsTop';
    topContainer.className = 'dynamic-section-container';
    topContainer.style.display = 'none';

    // Insert at the beginning of main
    if (mainChildren.length > 0) {
        main.insertBefore(topSeparator, mainChildren[0]);
        main.insertBefore(topContainer, mainChildren[0]);
    } else {
        main.appendChild(topSeparator);
        main.appendChild(topContainer);
    }

    console.log('Top container created at the beginning of main');

    // 2. MIDDLE CONTAINER - Insert in the middle of main content
    const middleSeparator = document.createElement('div');
    middleSeparator.className = 'dynamic-sections-separator-middle';
    middleSeparator.style.display = 'none';

    const middleContainer = document.createElement('section');
    middleContainer.id = 'dynamicSectionsMiddle';
    middleContainer.className = 'dynamic-section-container';
    middleContainer.style.display = 'none';

    // Get updated children list after adding top container
    const updatedChildren = Array.from(main.children);

    // Find a good middle point
    if (updatedChildren.length >= 4) {
        // Insert roughly in the middle, but after the top container
        const middleIndex = Math.floor(updatedChildren.length / 2);
        const middleElement = updatedChildren[middleIndex];

        // Insert after the middle element
        middleElement.after(middleSeparator);
        middleSeparator.after(middleContainer);
    } else {
        // If not enough children, insert after the top container
        topContainer.after(middleSeparator);
        middleSeparator.after(middleContainer);
    }

    console.log('Middle container created in the middle of main content');

    // 3. BOTTOM CONTAINER - Use existing or create new
    if (!existingBottom) {
        // Create a new bottom container at the end of main
        const bottomSeparator = document.createElement('div');
        bottomSeparator.className = 'dynamic-sections-separator';
        bottomSeparator.style.display = 'none';

        const bottomContainer = document.createElement('section');
        bottomContainer.id = 'dynamicSections';
        bottomContainer.className = 'dynamic-section-container';
        bottomContainer.style.display = 'none';

        // Append to the end of main
        main.appendChild(bottomSeparator);
        main.appendChild(bottomContainer);

        console.log('Bottom container created at the end of main content');
    } else {
        // Add the dynamic-section-container class to the existing bottom container
        existingBottom.classList.add('dynamic-section-container');
        console.log('Using existing bottom container');
    }
}

/**
 * Add sections to a specific container
 */
function addSectionsToContainer(sections, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    sections.forEach((s, index) => {
        container.insertAdjacentHTML('beforeend', `
          <article class="dyn-block fade-in-on-scroll" style="transition-delay: ${index * 0.1}s">
            ${s.image ? `<div class="dyn-image-container"><img src="${s.image}" alt="${s.heading}" loading="lazy"></div>` : ''}
            <h2>${s.heading}</h2>
            <div class="dyn-content">${s.text}</div>
          </article>`);
    });
}

/**
 * Toggle visibility of a container based on whether it has content
 */
function toggleContainerVisibility(containerId, hasContent) {
    const container = document.getElementById(containerId);
    if (container) {
        container.style.display = hasContent ? 'block' : 'none';
    }
}

/**
 * Hide all dynamic section containers and separators
 */
function hideAllContainers() {
    const containers = [
        document.getElementById('dynamicSectionsTop'),
        document.getElementById('dynamicSectionsMiddle'),
        document.getElementById('dynamicSections')
    ];

    const separators = [
        document.querySelector('.dynamic-sections-separator-top'),
        document.querySelector('.dynamic-sections-separator-middle'),
        document.querySelector('.dynamic-sections-separator')
    ];

    containers.forEach(container => {
        if (container) container.style.display = 'none';
    });

    separators.forEach(separator => {
        if (separator) separator.style.display = 'none';
    });
}

/**
 * Initialize the dynamic sections observer
 */
function initDynamicSectionsObserver() {
    // Create the Intersection Observer for fade-in animations
    window.dynamicSectionsObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Fade it in
                entry.target.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';

                // Once triggered, stop observing so it doesn't re-animate if user scrolls away
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 }); // threshold=0.1 => trigger at 10% visibility
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initDynamicSectionsObserver();
    loadDynamicSections();
});

// Export functions for use in other scripts
export { loadDynamicSections, initDynamicSectionsObserver };
