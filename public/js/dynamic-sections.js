/**
 * @fileoverview Dynamic Sections Loader for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Comprehensive dynamic content management system supporting:
 * - Multiple section layouts (standard, team, list, testimonials, video)
 * - Position-based rendering (top, middle, bottom)
 * - Visual editor integration with block IDs
 * - Fade-in animations and intersection observers
 * - Navigation anchor generation
 *
 * @requires UUID library for block ID generation
 * @performance Implements efficient DOM manipulation and lazy loading
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

// ✅ DYNAMIC POSITIONS CONFIGURATION
const DYNAMIC_POSITIONS = [
    'dynamicSections1',
    'dynamicSections2',
    'dynamicSections3',
    'dynamicSections4',
    'dynamicSections5',
    'dynamicSections6',
    'dynamicSections7'
];

// ✅ POSITION NORMALIZATION MAP - Defensive frontend matching
// Maps any legacy or lowercase position values to canonical camelCase format
const POSITION_NORMALIZATION_MAP = {
    'top': 'dynamicSections1',
    'middle': 'dynamicSections3',
    'bottom': 'dynamicSections7',
    'dynamicsectionstop': 'dynamicSections1',
    'dynamicsectionsmiddle': 'dynamicSections3',
    'dynamicsections': 'dynamicSections7',
    // Handle lowercase variants that may have been stored in database
    'dynamicsections1': 'dynamicSections1',
    'dynamicsections2': 'dynamicSections2',
    'dynamicsections3': 'dynamicSections3',
    'dynamicsections4': 'dynamicSections4',
    'dynamicsections5': 'dynamicSections5',
    'dynamicsections6': 'dynamicSections6',
    'dynamicsections7': 'dynamicSections7'
};

/**
 * Normalize position value to canonical camelCase format
 * @param {string} position - Raw position value from API
 * @returns {string} Canonical position name
 */
function normalizePosition(position) {
    if (!position || typeof position !== 'string') {
        return 'dynamicSections7'; // Default to position 7 (bottom)
    }

    const trimmed = position.trim();

    // If it's already a valid canonical position, return as-is
    if (DYNAMIC_POSITIONS.includes(trimmed)) {
        return trimmed;
    }

    // Try case-insensitive lookup in normalization map
    const lowercase = trimmed.toLowerCase();
    if (POSITION_NORMALIZATION_MAP[lowercase]) {
        console.log(`📍 [Frontend] Position normalization: "${position}" → "${POSITION_NORMALIZATION_MAP[lowercase]}"`);
        return POSITION_NORMALIZATION_MAP[lowercase];
    }

    // If no match found, default to position 7
    console.warn(`⚠️ [Frontend] Unknown position "${position}" - defaulting to dynamicSections7`);
    return 'dynamicSections7';
}

// ✅ NEW: Add a UUID generator utility function
function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// ✅ NEW: Add a helper to inject IDs into an HTML string with sanitization
function ensureBlockIds(htmlString) {
    if (!htmlString) return '';

    // 🔒 SECURITY FIX: Sanitize HTML before processing
    const sanitizedHTML = window.HTMLSanitizer ?
        window.HTMLSanitizer.sanitizeHTML(htmlString) :
        htmlString; // Fallback if sanitizer not loaded

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizedHTML;
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

    // Fetch both regular sections and video sections
    Promise.all([
        fetch(`/api/sections?page=${slug}`).then(r => r.json()).catch(() => []),
        fetch(`/api/video-sections?page=${slug}`).then(r => r.json()).catch(() => [])
    ])
        .then(([regularSections, videoSections]) => {
            // ✅ DEFENSIVE: Normalize all section positions before processing
            const normalizedRegularSections = regularSections.map(s => ({
                ...s,
                position: normalizePosition(s.position)
            }));
            const normalizedVideoSections = videoSections.map(s => ({
                ...s,
                position: normalizePosition(s.position)
            }));

            // Combine both types of sections and sort by position and creation order
            const list = [...normalizedRegularSections, ...normalizedVideoSections].sort((a, b) => {
                // ✅ UPDATED: Support both old (top/middle/bottom) and new (dynamicSections1-7) position names
                const posOrder = {
                    // New position names
                    'dynamicSections1': 0,
                    'dynamicSections2': 1,
                    'dynamicSections3': 2,
                    'dynamicSections4': 3,
                    'dynamicSections5': 4,
                    'dynamicSections6': 5,
                    'dynamicSections7': 6,
                    // Legacy support (will be removed after migration)
                    'top': 0,
                    'middle': 3,
                    'bottom': 6
                };
                const aPos = posOrder[a.position] ?? 999; // Unknown positions go to end
                const bPos = posOrder[b.position] ?? 999;
                if (aPos !== bPos) return aPos - bPos;
                return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            });

            // ✅ IMPROVED: Add debugging to verify we're getting all sections
            console.log(`[DynSec] Fetched ${regularSections?.length || 0} regular sections and ${videoSections?.length || 0} video sections for page "${slug}":`, list);

            if (list && list.length > 0) {
                // Create containers if they don't exist
                createPositionContainer('all');

                // ✅ REFACTORED: Get all position containers dynamically
                const containers = {};
                DYNAMIC_POSITIONS.forEach(posId => {
                    containers[posId] = document.getElementById(posId);
                });

                // Clear existing content from all containers
                Object.values(containers).forEach(container => {
                    if (container) container.innerHTML = '';
                });

                // ✅ REFACTORED: Group sections by position
                const sectionsByPosition = {};
                DYNAMIC_POSITIONS.forEach(posId => {
                    sectionsByPosition[posId] = list.filter(s => s.position === posId);
                });

                // Log section distribution
                const positionCounts = DYNAMIC_POSITIONS.map(posId =>
                    `${posId}: ${sectionsByPosition[posId].length}`
                ).join(', ');
                console.log(`[DynSec] Section distribution - ${positionCounts}`);

                // ✅ REFACTORED: Render sections to their respective containers using loop
                DYNAMIC_POSITIONS.forEach(posId => {
                    const container = containers[posId];
                    const sections = sectionsByPosition[posId];

                    if (!container) {
                        console.warn(`[DynSec] Container ${posId} not found on this page`);
                        return;
                    }

                    if (sections && sections.length > 0) {
                        sections.forEach((s, index) => {
                            const sectionElement = createDynamicSectionElement(s, index);
                            // Only wrap standard text/image sections in dyn-block
                            // Team and list sections have their own styling containers
                            // Testimonial and video sections now use standard dyn-block wrapper for consistency
                            if (s.layout === 'team' || s.layout === 'list') {
                                container.appendChild(sectionElement);
                            } else {
                                const wrapper = document.createElement('div');
                                wrapper.className = 'dyn-block fade-in-on-scroll';
                                wrapper.appendChild(sectionElement);
                                container.appendChild(wrapper);
                            }
                        });
                        container.style.display = 'block';
                    } else {
                        container.style.display = 'none';
                    }
                });

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
 * ✅ REFACTORED: Now supports 7 positions and primarily uses HTML-defined containers
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

    // ✅ REFACTORED: Check for all 7 position containers
    let allExist = true;
    const existingContainers = {};

    DYNAMIC_POSITIONS.forEach(posId => {
        const container = document.getElementById(posId);
        existingContainers[posId] = container;
        if (!container) allExist = false;
    });

    // If all containers already exist, just ensure they have the correct class
    if (allExist) {
        console.log('[DynSec] All 7 dynamic section containers already exist in the page');
        Object.values(existingContainers).forEach(container => {
            if (container) container.classList.add('dynamic-section-container');
        });
        return;
    }

    // ✅ REFACTORED: Create any missing containers dynamically
    // Since we now define containers in HTML, this is mainly a fallback for pages without them
    console.warn('[DynSec] Some containers are missing. Creating them dynamically (this should not happen if HTML is properly configured)');

    const mainChildren = Array.from(main.children);
    const numPositions = DYNAMIC_POSITIONS.length;

    DYNAMIC_POSITIONS.forEach((posId, index) => {
        if (existingContainers[posId]) {
            console.log(`[DynSec] Using existing container: ${posId}`);
            existingContainers[posId].classList.add('dynamic-section-container');
            return;
        }

        // Create missing container
        const container = document.createElement('section');
        container.id = posId;
        container.className = 'dynamic-section-container';
        container.dataset.veSectionId = posId;
        container.style.display = 'none';

        // Determine insertion point based on position index
        if (index === 0) {
            // First position: insert at beginning
            if (mainChildren.length > 0) {
                main.insertBefore(container, mainChildren[0]);
            } else {
                main.appendChild(container);
            }
        } else if (index === numPositions - 1) {
            // Last position: append to end
            main.appendChild(container);
        } else {
            // Middle positions: distribute evenly
            const updatedChildren = Array.from(main.children);
            const insertIndex = Math.floor((updatedChildren.length * (index + 1)) / (numPositions + 1));
            const insertElement = updatedChildren[insertIndex];

            if (insertElement) {
                insertElement.after(container);
            } else {
                main.appendChild(container);
            }
        }

        console.log(`[DynSec] Created container: ${posId}`);
    });
}

/**
 * Helper function to create a dynamic section element
 */
function createDynamicSectionElement(section, index) {
    const article = document.createElement('article');
    article.dataset.veSectionId = section._id || slugify(section.heading);

    // Add anchor ID for navigation linking
    if (section.navAnchor) {
        article.id = section.navAnchor;  // ✅ ALWAYS use server-side anchor
    } else if (section.heading) {
        article.id = slugify(section.heading);  // fallback for legacy rows
    }

    // Handle team layout
    if (section.layout === 'team') {
        // Create the outer wrapper with strive-overlay-card styling to match static team sections
        const teamWrapper = document.createElement('div');
        teamWrapper.className = 'strive-overlay-card strive-team-card fade-in-section';
        teamWrapper.style.transitionDelay = `${index * 0.1}s`;
        teamWrapper.dataset.veSectionId = section._id || slugify(section.heading);

        // Add anchor ID for navigation linking
        if (section.navAnchor) {
            teamWrapper.id = section.navAnchor;  // ✅ ALWAYS use server-side anchor
        } else if (section.heading) {
            teamWrapper.id = slugify(section.heading);  // fallback for legacy rows
        }

        // Create the inner article for the team content
        article.className = 'team-grid';
        article.setAttribute('role', 'region');
        article.setAttribute('aria-label', 'Team Members');

        if (section.heading) {
            const heading = document.createElement('h2');
            heading.textContent = section.heading;
            heading.style.cssText = 'color: #0057B7; text-align: center; margin-bottom: 1.5rem; font-size: 1.8rem;';
            article.appendChild(heading);
        }

        const grid = document.createElement('div');
        grid.className = 'team-members';
        grid.setAttribute('role', 'list');

        if (section.team?.length) {
            // 🔒 SECURITY FIX: Use safe DOM methods instead of innerHTML
            grid.innerHTML = ''; // Clear existing content

            section.team.forEach(m => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'team-member';
                memberDiv.setAttribute('role', 'listitem');

                // Create title element safely
                const titleElement = document.createElement('h3');
                titleElement.className = 'tm-title';
                if (window.HTMLSanitizer) {
                    window.HTMLSanitizer.safeSetTextContent(titleElement, m.name);
                } else {
                    titleElement.textContent = m.name; // Fallback
                }
                memberDiv.appendChild(titleElement);

                // Create avatar element safely
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'avatar';
                avatarDiv.setAttribute('role', 'img');
                avatarDiv.setAttribute('aria-label', `${m.name}'s photo`);

                const img = document.createElement('img');
                const imageSrc = m.image || '/images/default-avatar.png';
                if (window.HTMLSanitizer && window.HTMLSanitizer.isValidURL(imageSrc, ['http:', 'https:', '/'])) {
                    img.src = imageSrc;
                    img.alt = '';
                    img.loading = 'lazy';
                    avatarDiv.appendChild(img);
                }
                memberDiv.appendChild(avatarDiv);

                // Create content element safely
                const contentDiv = document.createElement('div');
                contentDiv.className = 'tm-content';

                const bioP = document.createElement('p');
                bioP.className = 'tm-bio';
                if (window.HTMLSanitizer) {
                    window.HTMLSanitizer.safeSetInnerHTML(bioP, m.bio);
                } else {
                    bioP.textContent = m.bio; // Fallback - no HTML
                }
                contentDiv.appendChild(bioP);

                if (m.quote) {
                    const quoteP = document.createElement('p');
                    const quoteSpan = document.createElement('span');
                    quoteSpan.className = 'tm-quote';
                    if (window.HTMLSanitizer) {
                        window.HTMLSanitizer.safeSetTextContent(quoteSpan, m.quote);
                    } else {
                        quoteSpan.textContent = m.quote; // Fallback
                    }
                    quoteP.appendChild(quoteSpan);
                    contentDiv.appendChild(quoteP);
                }

                memberDiv.appendChild(contentDiv);
                grid.appendChild(memberDiv);
            });
        } else {
            const noMembersP = document.createElement('p');
            noMembersP.className = 'no-members';
            noMembersP.textContent = 'No team members to display';
            grid.appendChild(noMembersP);
        }

        article.appendChild(grid);

        // 🔒 SECURITY FIX: Add button safely
        if (section.buttonLabel && section.buttonUrl) {
            const safeButton = window.HTMLSanitizer ?
                window.HTMLSanitizer.createSafeButton(section.buttonLabel, section.buttonUrl) :
                null;

            if (safeButton) {
                const buttonGroup = document.createElement('div');
                buttonGroup.className = 'button-group';
                buttonGroup.style.marginTop = '1rem';
                buttonGroup.appendChild(safeButton);
                article.appendChild(buttonGroup);
            }
        }

        // Wrap the article in the styled container
        teamWrapper.appendChild(article);

        return teamWrapper;
    }

    // Handle list layout (mirrors tutor-zone styling)
    if (section.layout === 'list') {
        return createListSectionElement(section, index, article);
    }

    // Handle testimonial layout (mirrors testimonials background section)
    if (section.layout === 'testimonial') {
        return createTestimonialSectionElement(section, index, article);
    }

    // Handle video layout
    if (section.layout === 'video') {
        return createVideoSectionElement(section, index);
    }

    // For non-team sections, use two-col-content class to match about section styling
    article.className = 'two-col-content';
    // Remove individual transition delay since wrapper handles the fade-in

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

    // 🔒 SECURITY FIX: Add button to left column safely (if present, use stable block ID from database)
    if (section.buttonLabel && section.buttonUrl) {
        const buttonBlockId = section.buttonBlockId || uuidv4();
        const existingManagedButton = document.querySelector(`[data-ve-button-id="${buttonBlockId}"][data-ve-managed="true"]`);
        if (!existingManagedButton) {
            const safeButton = window.HTMLSanitizer ?
                window.HTMLSanitizer.createSafeButton(section.buttonLabel, section.buttonUrl) :
                null;

            if (safeButton) {
                safeButton.setAttribute('data-ve-button-id', buttonBlockId);
                const buttonGroup = document.createElement('div');
                buttonGroup.className = 'button-group';
                buttonGroup.style.marginTop = '1rem';
                buttonGroup.appendChild(safeButton);
                leftColumn.appendChild(buttonGroup);
            }
        } else {
            console.log(`[VE Integration] Preserving editor-managed button for block ID: ${buttonBlockId}`);
        }
    }

    // 🔒 SECURITY FIX: Add image to right column safely if present
    if (section.image) {
        const imageBlockId = section.imageBlockId || uuidv4();
        const existingManagedImage = document.querySelector(`[data-ve-block-id="${imageBlockId}"][data-ve-managed="true"]`);
        if (!existingManagedImage) {
            // Validate image URL before creating element
            const isValidImageUrl = window.HTMLSanitizer ?
                window.HTMLSanitizer.isValidURL(section.image, ['http:', 'https:', '/']) :
                true; // Fallback - allow all URLs if sanitizer not loaded

            if (isValidImageUrl) {
                const img = document.createElement('img');
                img.src = section.image;
                img.alt = section.heading || 'Dynamic section image';
                img.setAttribute('data-ve-block-id', imageBlockId);
                rightColumn.appendChild(img);
            } else {
                console.warn('Blocked unsafe image URL:', section.image);
            }
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
 * Create a list section element that mirrors tutor-zone styling
 */
function createListSectionElement(section, index, article) {
    // Parse list content
    let listData;
    try {
        listData = typeof section.text === 'string' ? JSON.parse(section.text) : section.text;
    } catch (e) {
        console.error('Failed to parse list section data:', e);
        listData = { items: [], listType: 'unordered' };
    }

    // Create the outer section wrapper to match tutor-zone-section
    const listWrapper = document.createElement('section');
    listWrapper.className = 'tutor-zone-section fade-in-section';
    listWrapper.style.transitionDelay = `${index * 0.1}s`;
    listWrapper.dataset.veSectionId = section._id || slugify(section.heading);

    // Add anchor ID for navigation linking
    if (section.navAnchor) {
        listWrapper.id = section.navAnchor;
    } else if (section.heading) {
        listWrapper.id = slugify(section.heading);
    }

    // Create the gradient background container
    const gradientBg = document.createElement('div');
    gradientBg.className = 'zone-gradient-bg tutor-gradient-bg';

    // Create the list row container
    const listRow = document.createElement('div');
    listRow.className = 'zone-list-row';

    // If there's an image, use flex layout like the target design
    if (section.image) {
        listRow.style.cssText = 'display: flex; align-items: flex-start; gap: 2rem; max-width: 1080px; margin: 0 auto;';
    }

    // Create the content box (mirrors tutor-box)
    const listBox = document.createElement('div');
    listBox.className = 'tutor-box';

    // If there's an image, adjust content box styling
    if (section.image) {
        listBox.style.cssText = 'flex: 1; text-align: left;';
    }

    // Add heading
    if (section.heading) {
        const heading = document.createElement('h2');
        heading.textContent = section.heading;
        heading.setAttribute('data-ve-block-id', section.headingBlockId || uuidv4());
        listBox.appendChild(heading);
    }

    // Add description if present
    if (listData.description) {
        const description = document.createElement('p');
        description.textContent = listData.description;
        description.setAttribute('data-ve-block-id', section.descriptionBlockId || uuidv4());
        listBox.appendChild(description);
    }

    // Create the list element
    const listElement = document.createElement(listData.listType === 'ordered' ? 'ol' : 'ul');
    listElement.className = 'tutor-list';
    listElement.style.cssText = 'text-align:left; max-width: 500px; margin: 1rem auto; padding-left: 1.5rem; list-style-type: ' + (listData.listType === 'ordered' ? 'decimal' : 'disc') + ';';

    // Add list items
    if (listData.items && listData.items.length > 0) {
        listData.items.forEach((item, itemIndex) => {
            const listItem = document.createElement('li');
            listItem.textContent = item;
            listItem.style.cssText = 'margin-bottom: 0.5rem; display: list-item; list-style-position: outside;';
            listItem.setAttribute('data-ve-block-id', `li-${section._id}-${itemIndex}`);
            listElement.appendChild(listItem);
        });
    }

    listBox.appendChild(listElement);

    // 🔒 SECURITY FIX: Add button safely if available
    if (section.buttonLabel && section.buttonUrl) {
        const safeButton = window.HTMLSanitizer ?
            window.HTMLSanitizer.createSafeButton(section.buttonLabel, section.buttonUrl) :
            null;

        if (safeButton) {
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            buttonGroup.style.marginTop = '1rem';
            buttonGroup.appendChild(safeButton);
            listBox.appendChild(buttonGroup);
        }
    }

    // Assemble the structure - add content box first
    listRow.appendChild(listBox);

    // Add image if available (positioned to the right)
    if (section.image) {
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = 'flex: 0 0 auto; max-width: 400px;';

        const image = document.createElement('img');
        image.src = section.image;
        image.alt = section.heading || 'List section image';
        image.loading = 'lazy';
        image.style.cssText = 'width: 100%; height: auto; border-radius: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1);';
        image.setAttribute('data-ve-block-id', section.imageBlockId || uuidv4());

        imageContainer.appendChild(image);
        listRow.appendChild(imageContainer);
    }

    gradientBg.appendChild(listRow);
    listWrapper.appendChild(gradientBg);

    return listWrapper;
}

/**
 * Create a testimonial section element using standard dynamic section pattern
 */
function createTestimonialSectionElement(section, index, article) {
    // Add debugging to see what we're working with
    console.log('Creating testimonial section with data:', {
        sectionId: section._id,
        heading: section.heading,
        text: section.text,
        textType: typeof section.text
    });

    // Parse testimonial content - handle both old single format and new array format
    let testimonialData;
    try {
        testimonialData = typeof section.text === 'string' ? JSON.parse(section.text) : section.text;
        console.log('✅ Successfully parsed testimonial data:', testimonialData);

        // Handle the case where data is already an array (new format from admin form)
        if (Array.isArray(testimonialData)) {
            console.log('✅ Data is already an array, using as-is');
            // testimonialData is already correct
        }
        // Handle old single testimonial format
        else if (testimonialData && testimonialData.quote && typeof testimonialData === 'object') {
            console.log('✅ Converting single testimonial object to array format');
            testimonialData = [testimonialData];
        }
        // Handle invalid data
        else {
            console.log('⚠️ Invalid testimonial data format, creating empty array');
            testimonialData = [];
        }
    } catch (e) {
        console.error('❌ CORRUPTED TESTIMONIAL DATA DETECTED!');
        console.error('Parse error:', e.message);
        console.error('Raw text length:', section.text?.length || 0);
        console.error('Raw text preview:', section.text?.substring(0, 100) + '...');
        console.error('Section ID:', section._id);
        console.error('This testimonial section has corrupted JSON and needs to be re-created in admin.');
        testimonialData = [];
    }

    console.log('Final testimonial data array:', testimonialData, 'Length:', testimonialData.length);

    // Create standard article element (like other dynamic sections)
    // Note: Don't add fade-in-section class since testimonials are wrapped in dyn-block
    const testimonialArticle = document.createElement('article');
    testimonialArticle.dataset.veSectionId = section._id || slugify(section.heading);

    // Add anchor ID for navigation linking
    if (section.navAnchor) {
        testimonialArticle.id = section.navAnchor;
    } else if (section.heading) {
        testimonialArticle.id = slugify(section.heading);
    }

    // Add heading if provided
    if (section.heading) {
        const heading = document.createElement('h2');
        heading.textContent = section.heading;
        heading.dataset.veBlockId = `${section._id}-heading` || uuidv4();
        testimonialArticle.appendChild(heading);
    }

    // Add image if provided
    if (section.image) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'dyn-image-container';
        imageContainer.style.cssText = 'text-align: center; margin: 1.5rem 0;';

        const img = document.createElement('img');
        img.src = section.image;
        img.alt = section.heading || 'Testimonial image';
        img.style.cssText = 'max-width: 100%; height: auto; border-radius: 0.5rem;';
        img.dataset.veBlockId = `${section._id}-image` || uuidv4();

        imageContainer.appendChild(img);
        testimonialArticle.appendChild(imageContainer);
    }

    // Create testimonials container
    const testimonialsContainer = document.createElement('div');
    testimonialsContainer.className = 'testimonials-container';
    testimonialsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem;';

    // Create testimonial cards (stacked vertically, no absolute positioning)
    console.log('About to create testimonial cards. Data length:', testimonialData.length);
    if (testimonialData.length > 0) {
        testimonialData.forEach((testimonial, testimonialIndex) => {
            console.log(`Processing testimonial ${testimonialIndex}:`, testimonial);

            // Skip empty testimonials
            if (!testimonial || !testimonial.quote) {
                console.log('❌ Skipping empty testimonial at index:', testimonialIndex);
                return;
            }

            console.log('✅ Creating quote card for testimonial:', testimonialIndex);
            const quoteCard = document.createElement('div');
            quoteCard.className = 'testimonial-quote-card';
            // Remove all inline positioning - let it flow naturally
            quoteCard.style.cssText = 'position: relative; margin: 0 auto; max-width: 100%; background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 0.5rem;';

            // Create the quote content
            const quoteParagraph = document.createElement('p');
            quoteParagraph.setAttribute('data-ve-block-id', `${section._id}-quote-${testimonialIndex}` || uuidv4());

            // Build quote text with author attribution
            let quoteText = `"${testimonial.quote}"`;
            if (testimonial.author) {
                let attribution = `- ${testimonial.author}`;
                if (testimonial.role) {
                    attribution += `, ${testimonial.role}`;
                }
                if (testimonial.company) {
                    attribution += `, ${testimonial.company}`;
                }
                quoteText += `<br><span>${attribution}</span>`;
            }

            console.log('Quote text built:', quoteText);
            // 🔒 SECURITY FIX: Use safe HTML rendering
            if (window.HTMLSanitizer) {
                window.HTMLSanitizer.safeSetInnerHTML(quoteParagraph, quoteText);
            } else {
                quoteParagraph.innerHTML = quoteText; // Fallback
            }
            quoteCard.appendChild(quoteParagraph);

            // Add rating if present (convert string to number)
            if (testimonial.rating) {
                const rating = parseInt(testimonial.rating);
                console.log('Adding rating:', rating);
                const ratingDiv = document.createElement('div');
                ratingDiv.className = 'testimonial-rating';
                // 🔒 SECURITY FIX: Use textContent for star rating (no HTML needed)
                ratingDiv.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
                ratingDiv.style.cssText = 'color: #FFD700; margin-top: 0.5rem; font-size: 1.2rem;';
                quoteCard.appendChild(ratingDiv);
            }

            console.log('Adding quote card to container');
            testimonialsContainer.appendChild(quoteCard);
        });
        console.log('✅ Finished creating all testimonial cards');
    } else {
        console.log('❌ No testimonials to display, adding placeholder');
        // Add a placeholder if no testimonials found
        const placeholder = document.createElement('p');
        placeholder.textContent = 'No testimonials available.';
        placeholder.style.cssText = 'text-align: center; color: #666; font-style: italic;';
        testimonialsContainer.appendChild(placeholder);
    }

    testimonialArticle.appendChild(testimonialsContainer);

    // 🔒 SECURITY FIX: Add button safely if available
    if (section.buttonLabel && section.buttonUrl) {
        const safeButton = window.HTMLSanitizer ?
            window.HTMLSanitizer.createSafeButton(section.buttonLabel, section.buttonUrl) :
            null;

        if (safeButton) {
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            buttonGroup.style.marginTop = '1rem';
            buttonGroup.appendChild(safeButton);
            testimonialArticle.appendChild(buttonGroup);
        }
    }

    return testimonialArticle;
}

/**
 * Create a video section element that replaces standard content with video player
 */
function createVideoSectionElement(section, index) {
    console.log('Creating video section with data:', {
        sectionId: section._id,
        heading: section.heading,
        videoUrl: section.videoUrl,
        hasButton: !!(section.buttonLabel && section.buttonUrl)
    });

    // Create standard article element matching about section styling
    const videoArticle = document.createElement('article');
    videoArticle.className = 'two-col-content video-section';
    videoArticle.dataset.veSectionId = section._id || slugify(section.heading);

    // Add anchor ID for navigation linking
    if (section.navAnchor) {
        videoArticle.id = section.navAnchor;
    } else if (section.heading) {
        videoArticle.id = slugify(section.heading);
    }

    // Create single column structure (video sections use full width like about section)
    const contentColumn = document.createElement('div');
    contentColumn.className = 'video-content-column';
    // Remove custom styling to let CSS handle it naturally

    // Add heading (use stable block ID from database)
    const headingBlockId = section.headingBlockId || uuidv4();
    const existingManagedHeading = document.querySelector(`[data-ve-block-id="${headingBlockId}"][data-ve-managed="true"]`);
    if (!existingManagedHeading) {
        const heading = document.createElement('h2');
        heading.textContent = section.heading;
        heading.setAttribute('data-ve-block-id', headingBlockId);
        // Remove custom styling to match about section h2 styling
        contentColumn.appendChild(heading);
    } else {
        console.log(`[VE Integration] Preserving editor-managed heading for block ID: ${headingBlockId}`);
        contentColumn.appendChild(existingManagedHeading);
    }

    // Add video player container (use stable block ID from database)
    const videoBlockId = section.videoBlockId || uuidv4();
    const existingManagedVideo = document.querySelector(`[data-ve-block-id="${videoBlockId}"][data-ve-managed="true"]`);
    if (!existingManagedVideo && section.videoUrl) {
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-player-container';
        videoContainer.setAttribute('data-ve-block-id', videoBlockId);
        // Reduced margins and more compact styling to match about section
        videoContainer.style.cssText = 'position: relative; width: 100%; max-width: 100%; margin: 1rem 0; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);';

        // Create video element
        const video = document.createElement('video');
        video.src = section.videoUrl;
        video.controls = true;
        video.preload = 'metadata';
        video.style.cssText = 'width: 100%; height: auto; display: block;';
        video.setAttribute('data-video-url', section.videoUrl);

        // 🔒 SECURITY FIX: Add video sources safely with URL validation
        const isValidVideoUrl = window.HTMLSanitizer ?
            window.HTMLSanitizer.isValidURL(section.videoUrl, ['http:', 'https:', '/']) :
            true; // Fallback

        if (isValidVideoUrl) {
            const videoExtension = section.videoUrl.split('.').pop().toLowerCase();

            // Create source element safely
            const source = document.createElement('source');
            source.src = section.videoUrl;

            if (videoExtension === 'mp4') {
                source.type = 'video/mp4';
            } else if (videoExtension === 'webm') {
                source.type = 'video/webm';
            } else if (videoExtension === 'ogg') {
                source.type = 'video/ogg';
            }

            video.appendChild(source);

            // Add fallback message safely
            const fallbackP = document.createElement('p');
            fallbackP.textContent = 'Your browser does not support the video tag.';
            video.appendChild(fallbackP);
        } else {
            console.warn('Blocked unsafe video URL:', section.videoUrl);
            const errorP = document.createElement('p');
            errorP.textContent = 'Video unavailable due to security restrictions.';
            video.appendChild(errorP);
        }

        // Add error handling for video loading
        video.addEventListener('error', function() {
            console.error('Video failed to load:', section.videoUrl);
            const errorMsg = document.createElement('div');
            errorMsg.textContent = 'Video could not be loaded. Please check the URL or try a different format.';
            errorMsg.style.cssText = 'padding: 2rem; text-align: center; background: #f8f8f8; color: #666; border-radius: 0.5rem;';
            videoContainer.replaceChild(errorMsg, video);
        });

        // Add loading state
        video.addEventListener('loadstart', function() {
            console.log('Video loading started:', section.videoUrl);
        });

        video.addEventListener('canplay', function() {
            console.log('Video can start playing:', section.videoUrl);
        });

        videoContainer.appendChild(video);
        contentColumn.appendChild(videoContainer);
    } else if (existingManagedVideo) {
        console.log(`[VE Integration] Preserving editor-managed video for block ID: ${videoBlockId}`);
        contentColumn.appendChild(existingManagedVideo);
    } else {
        // No video URL provided - show placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'video-placeholder';
        placeholder.setAttribute('data-ve-block-id', videoBlockId);
        placeholder.style.cssText = 'padding: 3rem; text-align: center; background: #f8f8f8; color: #666; border-radius: 0.5rem; margin: 1.5rem 0;';
        placeholder.textContent = 'No video URL provided';
        contentColumn.appendChild(placeholder);
    }

    // Add button if available (use stable block ID from database)
    if (section.buttonLabel && section.buttonUrl) {
        const buttonBlockId = section.buttonBlockId || uuidv4();
        const existingManagedButton = document.querySelector(`[data-ve-button-id="${buttonBlockId}"][data-ve-managed="true"]`);
        if (!existingManagedButton) {
            // Create button directly (no container) to match about section styling
            const button = document.createElement('a');
            button.className = 'button aurora';
            button.href = section.buttonUrl;
            button.textContent = section.buttonLabel;
            button.setAttribute('data-ve-button-id', buttonBlockId);
            button.style.cssText = 'margin-top: 1rem; display: inline-block;';
            contentColumn.appendChild(button);
        } else {
            console.log(`[VE Integration] Preserving editor-managed button for block ID: ${buttonBlockId}`);
            contentColumn.appendChild(existingManagedButton);
        }
    }

    // Append content column to article
    videoArticle.appendChild(contentColumn);

    console.log('Created video section element:', {
        hasHeading: !!section.heading,
        hasVideo: !!section.videoUrl,
        hasButton: !!(section.buttonLabel && section.buttonUrl)
    });

    return videoArticle;
}

/**
 * Hide all dynamic section containers and separators
 */
function hideAllContainers() {
    // ✅ REFACTORED: Hide all position containers dynamically
    DYNAMIC_POSITIONS.forEach(posId => {
        const container = document.getElementById(posId);
        if (container) container.style.display = 'none';
    });

    // Hide any separator elements
    const separators = document.querySelectorAll('.dynamic-sections-separator, .dynamic-sections-separator-top, .dynamic-sections-separator-middle');
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

// Export functions for use in other scripts (compatible with both module and non-module contexts)
if (typeof module !== 'undefined' && module.exports) {
    // Node.js/CommonJS environment
    module.exports = { loadDynamicSections, initDynamicSectionsObserver };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to window for global access
    window.loadDynamicSections = loadDynamicSections;
    window.initDynamicSectionsObserver = initDynamicSectionsObserver;
}

// ES module export (must be at top level)
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
