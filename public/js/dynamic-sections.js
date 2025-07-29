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
                        const sectionElement = createDynamicSectionElement(s, index);
                        // Only wrap standard text/image sections in dyn-block
                        // Team and list sections have their own styling containers
                        // Testimonial sections now use standard dyn-block wrapper for consistency
                        if (s.layout === 'team' || s.layout === 'list') {
                            topContainer.appendChild(sectionElement);
                        } else {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'dyn-block fade-in-on-scroll';
                            wrapper.appendChild(sectionElement);
                            topContainer.appendChild(wrapper);
                        }
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
                        const sectionElement = createDynamicSectionElement(s, index);
                        // Only wrap standard text/image sections in dyn-block
                        // Team and list sections have their own styling containers
                        // Testimonial sections now use standard dyn-block wrapper for consistency
                        if (s.layout === 'team' || s.layout === 'list') {
                            middleContainer.appendChild(sectionElement);
                        } else {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'dyn-block fade-in-on-scroll';
                            wrapper.appendChild(sectionElement);
                            middleContainer.appendChild(wrapper);
                        }
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
                        const sectionElement = createDynamicSectionElement(s, index);
                        // Only wrap standard text/image sections in dyn-block
                        // Team and list sections have their own styling containers
                        // Testimonial sections now use standard dyn-block wrapper for consistency
                        if (s.layout === 'team' || s.layout === 'list') {
                            bottomContainer.appendChild(sectionElement);
                        } else {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'dyn-block fade-in-on-scroll';
                            wrapper.appendChild(sectionElement);
                            bottomContainer.appendChild(wrapper);
                        }
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

    // Add button if available
    if (section.buttonLabel && section.buttonUrl) {
        listBox.insertAdjacentHTML('beforeend', buttonHtml(section));
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
            quoteParagraph.innerHTML = quoteText;
            quoteCard.appendChild(quoteParagraph);

            // Add rating if present (convert string to number)
            if (testimonial.rating) {
                const rating = parseInt(testimonial.rating);
                console.log('Adding rating:', rating);
                const ratingDiv = document.createElement('div');
                ratingDiv.className = 'testimonial-rating';
                ratingDiv.innerHTML = '★'.repeat(rating) + '☆'.repeat(5 - rating);
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

    // Add button if available
    if (section.buttonLabel && section.buttonUrl) {
        testimonialArticle.insertAdjacentHTML('beforeend', buttonHtml(section));
    }

    return testimonialArticle;
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
