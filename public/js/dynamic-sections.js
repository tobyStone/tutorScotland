/**
 * Dynamic Sections Loader
 *
 * This script handles loading and displaying dynamic sections for all pages.
 * It ensures that dynamic sections are properly positioned below all pre-existing content.
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
 * Create a container for a specific position if it doesn't exist
 */
function createPositionContainer(position) {
    // Find appropriate insertion point
    let insertionPoint;

    if (position === 'top') {
        // Insert after the header/nav elements
        const header = document.querySelector('header');
        const nav = document.querySelector('nav');
        const rollingBanner = document.querySelector('.rolling-banner');

        if (rollingBanner) {
            insertionPoint = rollingBanner;
        } else if (nav) {
            insertionPoint = nav;
        } else if (header) {
            insertionPoint = header;
        } else {
            // Fallback to the first child of body
            insertionPoint = document.body.firstElementChild;
        }

        // Create separator and container
        const separator = document.createElement('div');
        separator.className = 'dynamic-sections-separator-top';
        separator.style.display = 'none';

        const container = document.createElement('section');
        container.id = 'dynamicSectionsTop';
        container.style.display = 'none';

        // Insert after the insertion point
        insertionPoint.after(separator);
        separator.after(container);
    } else if (position === 'middle') {
        // Find a good middle point in the page
        const main = document.querySelector('main');

        if (main) {
            // Try to find a natural midpoint in the main content
            const mainChildren = Array.from(main.children);

            if (mainChildren.length >= 4) {
                // Insert roughly in the middle
                insertionPoint = mainChildren[Math.floor(mainChildren.length / 2) - 1];
            } else {
                // If not enough children, insert after the first child
                insertionPoint = mainChildren[0] || main;
            }
        } else {
            // Fallback to inserting after the first third of body children
            const bodyChildren = Array.from(document.body.children);
            insertionPoint = bodyChildren[Math.floor(bodyChildren.length / 3)] || document.body.firstElementChild;
        }

        // Create separator and container
        const separator = document.createElement('div');
        separator.className = 'dynamic-sections-separator-middle';
        separator.style.display = 'none';

        const container = document.createElement('section');
        container.id = 'dynamicSectionsMiddle';
        container.style.display = 'none';

        // Insert after the insertion point
        insertionPoint.after(separator);
        separator.after(container);
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
            ${s.image ? `<img src="${s.image}" alt="${s.heading}" loading="lazy">` : ''}
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
