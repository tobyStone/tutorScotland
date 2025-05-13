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
                // Only show the dynamic sections container if there are sections to display
                const host = document.getElementById('dynamicSections');
                if (!host) {
                    console.error('No dynamicSections container found in the page');
                    return;
                }
                
                // Clear any existing content
                host.innerHTML = '';
                
                // Add each section with proper spacing and styling
                list.forEach((s, index) => {
                    host.insertAdjacentHTML('beforeend', `
                      <article class="dyn-block fade-in-on-scroll" style="transition-delay: ${index * 0.1}s">
                        ${s.image ? `<img src="${s.image}" alt="${s.heading}" loading="lazy">` : ''}
                        <h2>${s.heading}</h2>
                        <div class="dyn-content">${s.text}</div>
                      </article>`);
                });
                
                // Make sure the dynamic sections container is visible
                host.style.display = 'block';
                
                // Ensure the separator is visible
                const separator = document.querySelector('.dynamic-sections-separator');
                if (separator) {
                    separator.style.display = 'block';
                }
                
                // Scroll to ensure visibility of the first dynamic section
                setTimeout(() => {
                    // Force layout recalculation to ensure proper positioning
                    document.body.offsetHeight;
                    
                    // Add a class to the body to indicate dynamic sections are present
                    document.body.classList.add('has-dynamic-sections');
                }, 100);
                
                // Apply observer to newly created elements
                if (window.dynamicSectionsObserver) {
                    document
                        .querySelectorAll('.dyn-block.fade-in-on-scroll')
                        .forEach(el => window.dynamicSectionsObserver.observe(el));
                }
            } else {
                // If no dynamic sections, hide the container and separator
                const host = document.getElementById('dynamicSections');
                if (host) {
                    host.style.display = 'none';
                }
                
                const separator = document.querySelector('.dynamic-sections-separator');
                if (separator) {
                    separator.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error('Error loading dynamic sections:', error);
            // Hide the container and separator on error
            const host = document.getElementById('dynamicSections');
            if (host) {
                host.style.display = 'none';
            }
            
            const separator = document.querySelector('.dynamic-sections-separator');
            if (separator) {
                separator.style.display = 'none';
            }
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
