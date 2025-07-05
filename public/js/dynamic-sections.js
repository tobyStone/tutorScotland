/**
 * Dynamic Sections Loader
 *
 * This script handles loading and displaying dynamic sections for all pages.
 * It ensures that dynamic sections are properly positioned at the top, middle, or bottom
 * of the page content based on the admin's selection.
 */

// Helper function to create URL-friendly slugs
function slugify(str) {
    return str.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

// Helper function to generate button HTML
function buttonHtml(s) {
    return s.buttonLabel && s.buttonUrl
        ? `<div class="button-group" style="margin-top:1rem;">
             <a class="button aurora" href="${s.buttonUrl}">${s.buttonLabel}</a>
           </div>`
        : '';
}

// ✅ NEW: Add a UUID generator utility function
function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// ✅ NEW: Add a helper to inject IDs into an HTML string
function ensureBlockIds(htmlString) {
    if (!htmlString) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    const editableTags = ['p', 'img', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'];
    editableTags.forEach(tag => {
        tempDiv.querySelectorAll(tag).forEach(el => {
            if (!el.hasAttribute('data-ve-block-id')) {
                el.setAttribute('data-ve-block-id', uuidv4());
            }
        });
    });
    return tempDiv.innerHTML;
}

/**
 * Load dynamic sections for the current page
 */
function loadDynamicSections() {
    // 1️⃣ Take whatever the <body> claims first (lets you hard-code data-page="contact")
    // 2️⃣ Else use pathname without trailing slash or extension
    // 3️⃣ Normalise to lower-case
    const rawPath = location.pathname.replace(/\/$/, '');   // drop trailing /
    let page = (document.body.dataset.page ||
                    (rawPath ? rawPath.split('/').pop().replace(/\.html?$/, '') : 'index')
                   ).toLowerCase();

    // Trust ?slug= ONLY if it exists AND is non-empty
    const urlParams = new URLSearchParams(location.search);
    const slugParam = urlParams.get('slug');
    const slug = slugParam ? slugParam.toLowerCase() : page;

    // Debug logging
    console.log('Dynamic Sections Debug:', {
        rawPath,
        dataPage: document.body.dataset.page,
        parsedPage: page,
        urlSlug: urlParams.get('slug'),
        finalSlug: slug
    });

    // Warn if using URL parameter
    if (urlParams.has('slug')) {
        console.warn('Using ?slug= parameter for dynamic sections. This may override the intended page.');
    }

    console.log(`Loading dynamic sections for page: ${page}`);

    fetch(`/api/sections?page=${slug}`)
        .then(r => r.json())
        .then(list => {
            // ✅ IMPROVED: Add debugging to verify we're only getting actual sections
            console.log(`[DynSec] Fetched ${list?.length || 0} sections for page "${slug}":`, list);

            if (list && list.length > 0) {
                // Create containers if they don't exist
                createPositionContainer('all');

                // Get containers for different positions
                const topContainer = document.getElementById('dynamicSectionsTop');
                const middleContainer = document.getElementById('dynamicSectionsMiddle');
                const bottomContainer = document.getElementById('dynamicSections');

                // Verify all containers exist
                if (!topContainer || !middleContainer || !bottomContainer) {
                    console.error('One or more dynamic section containers not found');
                    return;
                }

                // Clear existing content
                topContainer.innerHTML = '';
                middleContainer.innerHTML = '';
                bottomContainer.innerHTML = '';

                // Group sections by position
                const topSections = list.filter(s => s.position === 'top');
                const middleSections = list.filter(s => s.position === 'middle');
                const bottomSections = list.filter(s => s.position === 'bottom' || !s.position);

                console.log(`Found ${topSections.length} top sections, ${middleSections.length} middle sections, ${bottomSections.length} bottom sections`);

                // Add sections to their respective containers
                if (topSections.length > 0) {
                    topSections.forEach((s, index) => {
                        topContainer.appendChild(createDynamicSectionElement(s, index));
                    });
                    topContainer.style.display = 'block';
                    const topSeparator = document.querySelector('.dynamic-sections-separator-top');
                    if (topSeparator) topSeparator.style.display = 'block';
                } else {
                    topContainer.style.display = 'none';
                    const topSeparator = document.querySelector('.dynamic-sections-separator-top');
                    if (topSeparator) topSeparator.style.display = 'none';
                }

                if (middleSections.length > 0) {
                    middleSections.forEach((s, index) => {
                        middleContainer.appendChild(createDynamicSectionElement(s, index));
                    });
                    middleContainer.style.display = 'block';
                    const middleSeparator = document.querySelector('.dynamic-sections-separator-middle');
                    if (middleSeparator) middleSeparator.style.display = 'block';
                } else {
                    middleContainer.style.display = 'none';
                    const middleSeparator = document.querySelector('.dynamic-sections-separator-middle');
                    if (middleSeparator) middleSeparator.style.display = 'none';
                }

                if (bottomSections.length > 0) {
                    bottomSections.forEach((s, index) => {
                        bottomContainer.appendChild(createDynamicSectionElement(s, index));
                    });
                    bottomContainer.style.display = 'block';
                    const bottomSeparator = document.querySelector('.dynamic-sections-separator');
                    if (bottomSeparator) bottomSeparator.style.display = 'block';
                } else {
                    bottomContainer.style.display = 'none';
                    const bottomSeparator = document.querySelector('.dynamic-sections-separator');
                    if (bottomSeparator) bottomSeparator.style.display = 'none';
                }

                // Add a class to the body to indicate dynamic sections are present
                document.body.classList.add('has-dynamic-sections');

                // Apply observer to newly created elements
                if (window.dynamicSectionsObserver) {
                    document
                        .querySelectorAll('.dyn-block.fade-in-on-scroll')
                        .forEach(el => window.dynamicSectionsObserver.observe(el));
                }

                // If we arrived with #hash, jump once sections are in the DOM
                if (location.hash) {
                    const target = document.getElementById(location.hash.slice(1));
                    if (target) {
                        target.scrollIntoView({behavior: 'smooth', block: 'start'});
                    }
                }
            } else {
                // If no dynamic sections, hide all containers and separators
                hideAllContainers();
            }

            // After processing everything...
            // let anyone who cares know that dynamic sections are now in the DOM
            console.log(`🏁 [RACE] About to dispatch dyn-sections-loaded event at ${Date.now()}`);
            window.dispatchEvent(new CustomEvent('dyn-sections-loaded'));
            document.body.classList.add('dyn-ready');
            console.log(`🏁 [RACE] Dispatched "dyn-sections-loaded" event at ${Date.now()}`);
        })
        .catch(error => {
            console.error('Error loading dynamic sections:', error);
            // Hide all containers and separators on error
            hideAllContainers();
            // Also dispatch on error to unblock the visual editor
            console.log(`🏁 [RACE] About to dispatch dyn-sections-loaded event (ERROR CASE) at ${Date.now()}`);
            window.dispatchEvent(new CustomEvent('dyn-sections-loaded'));
            document.body.classList.add('dyn-ready');
            console.log(`🏁 [RACE] Dispatched "dyn-sections-loaded" event (ERROR CASE) at ${Date.now()}`);
        });
}

/**
 * Create containers for all positions if they don't exist
 * This function creates all three containers at once to ensure proper positioning
 */
function createPositionContainer(position) {

    // 👉  If the page opted-in to manual placement just bail-out
    if (document.body.dataset.dynManual === 'true') {
        console.log('[DynSec] Manual placement – using containers provided in HTML');
        return;
    }
    // Only create containers if they don't already exist
    const main = document.querySelector('main');
    if (!main) {
        console.error('No main element found in the page');
        return;
    }

    // Check for existing containers
    const existingTop = document.getElementById('dynamicSectionsTop');
    const existingMiddle = document.getElementById('dynamicSectionsMiddle');
    const existingBottom = document.getElementById('dynamicSections');

    // If all containers already exist, just use them
    if (existingTop && existingMiddle && existingBottom) {
        console.log('All dynamic section containers already exist in the page');

        // Make sure they have the correct class
        existingTop.classList.add('dynamic-section-container');
        existingMiddle.classList.add('dynamic-section-container');
        existingBottom.classList.add('dynamic-section-container');

        return;
    }

    // Get all children of main
    const mainChildren = Array.from(main.children);

    // Create any missing containers

    // 1. TOP CONTAINER - Create if it doesn't exist
    if (!existingTop) {
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
    } else {
        console.log('Using existing top container');
    }

    // 2. MIDDLE CONTAINER - Create if it doesn't exist
    if (!existingMiddle) {
        const middleSeparator = document.createElement('div');
        middleSeparator.className = 'dynamic-sections-separator-middle';
        middleSeparator.style.display = 'none';

        const middleContainer = document.createElement('section');
        middleContainer.id = 'dynamicSectionsMiddle';
        middleContainer.className = 'dynamic-section-container';
        middleContainer.style.display = 'none';

        // Get updated children list
        const updatedChildren = Array.from(main.children);

        // Find a good middle point - try to find after the first content section
        const twoColContent = main.querySelector('.two-col-content');

        if (twoColContent) {
            // Insert after the two-column content section
            twoColContent.after(middleSeparator);
            middleSeparator.after(middleContainer);
            console.log('Middle container created after two-column content');
        } else if (updatedChildren.length >= 4) {
            // Insert roughly in the middle
            const middleIndex = Math.floor(updatedChildren.length / 2);
            const middleElement = updatedChildren[middleIndex];

            // Insert after the middle element
            middleElement.after(middleSeparator);
            middleSeparator.after(middleContainer);
            console.log('Middle container created at calculated middle point');
        } else {
            // If not enough children, insert after the first third
            const insertIndex = Math.max(1, Math.floor(updatedChildren.length / 3));
            const insertElement = updatedChildren[insertIndex];

            if (insertElement) {
                insertElement.after(middleSeparator);
                middleSeparator.after(middleContainer);
            } else {
                main.appendChild(middleSeparator);
                main.appendChild(middleContainer);
            }
            console.log('Middle container created at fallback position');
        }
    } else {
        console.log('Using existing middle container');
    }

    // 3. BOTTOM CONTAINER - Create if it doesn't exist
    if (!existingBottom) {
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
 * Helper function to create a dynamic section element
 */
function createDynamicSectionElement(section, index) {
    const article = document.createElement('article');
    // Use two-col-content class to match about section styling
    article.className = 'two-col-content fade-in-section';
    article.style.transitionDelay = `${index * 0.1}s`;
    article.dataset.veSectionId = section._id || slugify(section.heading);

    // Add anchor ID for navigation linking
    if (section.navAnchor) {
        article.id = section.navAnchor;  // ✅ ALWAYS use server-side anchor
    } else if (section.heading) {
        article.id = slugify(section.heading);  // fallback for legacy rows
    }

    // Handle team layout
    if (section.layout === 'team') {
        article.classList.add('team-grid');
        article.setAttribute('role', 'region');
        article.setAttribute('aria-label', 'Team Members');

        if (section.heading) {
            const heading = document.createElement('h2');
            heading.textContent = section.heading;
            article.appendChild(heading);
        }

        const grid = document.createElement('div');
        grid.className = 'team-members';
        grid.setAttribute('role', 'list');

        if (section.team?.length) {
            grid.innerHTML = section.team.map(m => `
                <div class="team-member" role="listitem">
                    <h3 class="tm-title">${m.name}</h3>
                    <div class="avatar" role="img" aria-label="${m.name}'s photo">
                        <img src="${m.image || '/images/default-avatar.png'}"
                             alt=""
                             loading="lazy">
                    </div>
                    <div class="tm-content">
                        <p class="tm-bio">${m.bio}</p>
                        ${m.quote ? `<p><span class="tm-quote">${m.quote}</span></p>` : ''}

                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p class="no-members">No team members to display</p>';
        }

        article.appendChild(grid);

        // Add button if available
        if (section.buttonLabel && section.buttonUrl) {
            article.insertAdjacentHTML('beforeend', buttonHtml(section));
        }

        return article;
    }

    // Image handling is now done in the two-column structure below

    // Create two-column structure to match about section
    const leftColumn = document.createElement('div');
    const rightColumn = document.createElement('div');

    // Add heading to left column (use stable block ID from database)
    const headingBlockId = section.headingBlockId || uuidv4();
    const existingManagedHeading = document.querySelector(`[data-ve-block-id="${headingBlockId}"][data-ve-managed="true"]`);
    if (!existingManagedHeading) {
        const heading = document.createElement('h2');
        heading.textContent = section.heading;
        heading.setAttribute('data-ve-block-id', headingBlockId);
        leftColumn.appendChild(heading);
    } else {
        console.log(`[VE Integration] Preserving editor-managed heading for block ID: ${headingBlockId}`);
        leftColumn.appendChild(existingManagedHeading);
    }

    // Add content to left column (use stable block ID from database and ensure nested IDs)
    const contentBlockId = section.contentBlockId || uuidv4();
    const existingManagedContent = document.querySelector(`[data-ve-block-id="${contentBlockId}"][data-ve-managed="true"]`);
    if (!existingManagedContent) {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = ensureBlockIds(section.text);
        contentDiv.setAttribute('data-ve-block-id', contentBlockId);
        leftColumn.appendChild(contentDiv);
    } else {
        console.log(`[VE Integration] Preserving editor-managed content for block ID: ${contentBlockId}`);
        leftColumn.appendChild(existingManagedContent);
    }

    // Add button to left column (if present, use stable block ID from database)
    if (section.buttonLabel && section.buttonUrl) {
        const buttonBlockId = section.buttonBlockId || uuidv4();
        const existingManagedButton = document.querySelector(`[data-ve-button-id="${buttonBlockId}"][data-ve-managed="true"]`);
        if (!existingManagedButton) {
            leftColumn.insertAdjacentHTML('beforeend', buttonHtml({ ...section, buttonBlockId }));
        } else {
            console.log(`[VE Integration] Preserving editor-managed button for block ID: ${buttonBlockId}`);
        }
    }

    // Add image to right column if present
    if (section.image) {
        const imageBlockId = section.imageBlockId || uuidv4();
        const existingManagedImage = document.querySelector(`[data-ve-block-id="${imageBlockId}"][data-ve-managed="true"]`);
        if (!existingManagedImage) {
            const img = document.createElement('img');
            img.src = section.image;
            img.alt = section.heading || 'Dynamic section image';
            img.setAttribute('data-ve-block-id', imageBlockId);
            rightColumn.appendChild(img);
        } else {
            console.log(`[VE Integration] Preserving editor-managed image for block ID: ${imageBlockId}`);
            rightColumn.appendChild(existingManagedImage);
        }
    }

    // Append columns to article
    article.appendChild(leftColumn);
    if (section.image) {
        article.appendChild(rightColumn);
    }

    // Add debug logging
    console.log('Creating dynamic section:', {
        layout: section.layout,
        heading: section.heading,
        hasTeam: section.team?.length > 0,
        hasImage: !!section.image,
        hasButton: !!(section.buttonLabel && section.buttonUrl)
    });

    return article;
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

// Export functions for use in other scripts
export { loadDynamicSections, initDynamicSectionsObserver };

/* ------------------------------------------------------------------------- */
/*  BOOTSTRAP  ✧  runs exactly once no matter how the script was loaded      */
function startDynamicSections() {
  console.log('[DynSec] init');
  initDynamicSectionsObserver();
  loadDynamicSections();
}

if (document.readyState === 'loading') {
  // script executed before DOMContentLoaded → wait
  document.addEventListener('DOMContentLoaded', startDynamicSections);
} else {
  // DOM is already ready (defer / module scenario) → run immediately
  startDynamicSections();
}
