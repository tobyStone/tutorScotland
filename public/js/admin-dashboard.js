/**
 * @fileoverview Admin Dashboard Interactive Functionality
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2025-01-27
 *
 * @description Provides interactive functionality for the admin dashboard:
 * - Tab switching between content and tutor management
 * - Page dropdown population from PAGES array
 * - Section CRUD operations
 * - Tutor CRUD operations
 * - Form validation and submission handling
 *
 * @requires pages.js - For PAGES array
 * @requires dynamic-sections.js - For section management
 * @requires upload-helper.js - For image upload functionality
 */

// Import upload helper for image uploads
let uploadImage;
let uploadHelperLoaded = false;

// Load upload helper
async function loadUploadHelper() {
    try {
        const module = await import('/js/upload-helper.js');
        uploadImage = module.uploadImage;
        uploadHelperLoaded = true;
        console.log('[Admin Dashboard] Upload helper loaded successfully');
        return true;
    } catch (err) {
        console.warn('[Admin Dashboard] Upload helper not available:', err);
        uploadHelperLoaded = false;
        return false;
    }
}

// Initialize upload helper
loadUploadHelper();

// Wait for DOM and required modules to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Admin Dashboard] Initializing...');

    // Initialize all dashboard functionality
    initTabSwitching();
    initPageDropdowns();
    initSectionManagement();
    initTutorManagement();
    initPageManagement();
    initAdvancedSectionBuilders();
    initVideoManagement();
    initURLParameterHandling();

    // Add debugging function to window for manual testing
    window.debugTeamSections = function() {
        console.log('[Debug] All sections:', allSections);
        const teamSections = allSections.filter(s => s.layout === 'team');
        console.log('[Debug] Team sections:', teamSections);
        teamSections.forEach(section => {
            console.log(`[Debug] Section ${section._id}:`, {
                heading: section.heading,
                team: section.team,
                teamType: typeof section.team,
                teamIsArray: Array.isArray(section.team)
            });
        });
    };

    console.log('[Admin Dashboard] Initialization complete');
});

/**
 * Initialize tab switching functionality
 */
function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            this.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            console.log(`[Admin Dashboard] Switched to tab: ${targetTab}`);
        });
    });
}

/**
 * Initialize page dropdown population
 */
function initPageDropdowns() {
    // Wait for PAGES to be available (from pages.js module)
    const checkPagesAvailable = () => {
        if (typeof PAGES !== 'undefined' || (window.PAGES && Array.isArray(window.PAGES))) {
            const pages = window.PAGES || PAGES;
            populatePageDropdowns(pages);
        } else {
            // Retry after a short delay
            setTimeout(checkPagesAvailable, 100);
        }
    };
    
    checkPagesAvailable();
}

/**
 * Populate page dropdown selects with available pages
 * @param {Array} pages - Array of page identifiers
 */
function populatePageDropdowns(pages) {
    const pageSelects = document.querySelectorAll('#pageSelect, #movePageSelect');
    
    pageSelects.forEach(select => {
        // Clear existing options
        select.innerHTML = '';
        
        // Add pages as options
        pages.forEach(page => {
            const option = document.createElement('option');
            option.value = page;
            // ✅ FIXED: Map 'index' to 'Landing Page' for display (matches pre-bf1328c behavior)
            const displayName = page === 'index' ? 'Landing Page' : page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, ' ');
            option.textContent = displayName;
            select.appendChild(option);
        });
        
        // Update view page link when selection changes
        if (select.id === 'pageSelect') {
            updateViewPageLink(select.value);
            select.addEventListener('change', function() {
                updateViewPageLink(this.value);
            });
        }
    });
    
    console.log(`[Admin Dashboard] Populated page dropdowns with ${pages.length} pages`);
}

/**
 * Update the "View Page" link based on selected page
 * @param {string} selectedPage - The currently selected page
 */
function updateViewPageLink(selectedPage) {
    const viewPageLink = document.getElementById('viewPageLink');
    if (viewPageLink && selectedPage) {
        const pageUrl = selectedPage === 'index' ? '/' : `/${selectedPage}.html`;
        viewPageLink.href = pageUrl;
    }
}

/**
 * Initialize section management functionality
 */
function initSectionManagement() {
    const sectionForm = document.getElementById('addSection');
    if (!sectionForm) {
        console.log('[Admin Dashboard] Section form not found, skipping section management init');
        return;
    }

    // Get form elements
    const pageSelect = document.getElementById('pageSelect');
    const viewPageLink = document.getElementById('viewPageLink');
    const sectionTbody = document.querySelector('#sectionTable tbody');
    const sectionFormHeading = document.getElementById('sectionFormHeading');
    const submitSectionBtn = document.getElementById('submitSectionBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const currentImagePreview = document.getElementById('currentImagePreview');
    const removeButtonRow = document.getElementById('removeButtonRow');
    const movePageRow = document.getElementById('movePageRow');
    const movePageSelect = document.getElementById('movePageSelect');
    const showInNav = document.getElementById('showInNav');
    const navCatRow = document.getElementById('navCatRow');
    const sectionLayout = document.getElementById('sectionLayout');
    const sectionPosition = document.getElementById('sectionPosition');

    // Store all sections for editing
    let allSections = [];

    // Helper: Reset form to create mode but keep page selection
    function resetSectionForm() {
        const currentPage = pageSelect.value; // Remember current page
        sectionForm.reset(); // Native reset (clears all fields including selects)
        pageSelect.value = currentPage; // Restore page selection

        // Set default position to bottom
        if (sectionPosition) sectionPosition.value = 'bottom';

        delete sectionForm.dataset.editId;
        sectionFormHeading.textContent = 'Add a Dynamic Section';
        submitSectionBtn.textContent = 'Add Section';
        cancelEditBtn.style.display = 'none';
        currentImagePreview.style.display = 'none';

        // Reset checkboxes
        const removeImageCheckbox = sectionForm.querySelector('[name="removeImage"]');
        if (removeImageCheckbox) removeImageCheckbox.checked = false;

        const removeButtonCheckbox = sectionForm.querySelector('[name="removeButton"]');
        if (removeButtonCheckbox) removeButtonCheckbox.checked = false;

        // Hide conditional elements
        if (movePageRow) movePageRow.style.display = 'none';
        if (removeButtonRow) removeButtonRow.style.display = 'none';
        if (navCatRow) navCatRow.style.display = showInNav.checked ? 'block' : 'none';

        // Reset button fields
        const buttonLabel = sectionForm.querySelector('[name="buttonLabel"]');
        const buttonUrl = sectionForm.querySelector('[name="buttonUrl"]');
        if (buttonLabel) buttonLabel.value = '';
        if (buttonUrl) buttonUrl.value = '';

        // Reset advanced builders
        if (typeof window.clearTeamBuilder === 'function') {
            window.clearTeamBuilder();
        }

        console.log('[Admin Dashboard] Section form reset to create mode');
    }

    // Helper: Update view page link
    function updatePageLink(selectedPage) {
        if (viewPageLink && selectedPage) {
            if (selectedPage === 'rolling-banner') {
                // Hide view page link for rolling banner (it's not a real page)
                viewPageLink.style.display = 'none';
            } else {
                const pageUrl = selectedPage === 'index' ? '/' : `/${selectedPage}.html`;
                viewPageLink.href = pageUrl;
                viewPageLink.style.display = 'inline-block';
            }
        }
    }

    // Helper: Toggle layout-specific fields and required attributes
    function toggleLayoutFields() {
        const currentPage = pageSelect.value;
        const layout = sectionLayout.value;
        const isBanner = currentPage === 'rolling-banner';

        const standardFields = document.getElementById('standardFields');
        const rollingBannerFields = document.getElementById('rollingBannerFields');
        const metaControls = document.getElementById('metaControls');

        // Get form elements for required attribute management
        const headingInput = sectionForm.querySelector('[name="heading"]');
        const standardTextarea = sectionForm.querySelector('#standardOnlyFields textarea[name="text"]');
        const rollingTextarea = sectionForm.querySelector('[name="rollingText"]');

        console.log('[Admin Dashboard] toggleLayoutFields - isBanner:', isBanner, 'layout:', layout);

        // Show/hide field groups based on page type
        if (isBanner) {
            // Rolling banner mode
            if (rollingBannerFields) rollingBannerFields.style.display = 'block';
            if (metaControls) metaControls.style.display = 'none';

            // Hide heading field for rolling banner (it uses news content instead)
            const mainHeadingLabel = document.getElementById('mainHeadingLabel');
            if (mainHeadingLabel) mainHeadingLabel.style.display = 'none';

            // Hide shared fields (image, button) for rolling banner
            const sharedFields = document.getElementById('sharedFields');
            if (sharedFields) sharedFields.style.display = 'none';

            // Hide standard fields for rolling banner
            if (standardFields) standardFields.style.display = 'none';

            // Hide all layout-specific builder fields for rolling banner
            const teamBuilder = document.getElementById('teamBuilder');
            const listBuilder = document.getElementById('listBuilder');
            const testimonialBuilder = document.getElementById('testimonialBuilder');
            const videoBuilder = document.getElementById('videoBuilder');
            const standardOnlyFields = document.getElementById('standardOnlyFields');

            if (teamBuilder) teamBuilder.style.display = 'none';
            if (listBuilder) listBuilder.style.display = 'none';
            if (testimonialBuilder) testimonialBuilder.style.display = 'none';
            if (videoBuilder) videoBuilder.style.display = 'none';
            if (standardOnlyFields) standardOnlyFields.style.display = 'none';

            // Hide move page controls for rolling banner (matching historical commit)
            const movePageRow = document.getElementById('movePageRow');
            if (movePageRow) movePageRow.style.display = 'none';

            // Hide position selector for rolling banner (they always go to rolling-banner page)
            if (sectionPosition) {
                sectionPosition.disabled = true;
                sectionPosition.style.opacity = '0.5';
            }

            // Set form to novalidate to prevent HTML5 validation conflicts
            sectionForm.setAttribute('novalidate', '');

            // Manage required attributes for banner mode
            if (headingInput) headingInput.removeAttribute('required');
            if (standardTextarea) standardTextarea.removeAttribute('required');
            if (rollingTextarea) rollingTextarea.setAttribute('required', '');

        } else {
            // Regular section mode
            if (rollingBannerFields) rollingBannerFields.style.display = 'none';
            if (metaControls) metaControls.style.display = 'block';

            // Show heading field for regular sections
            const mainHeadingLabel = document.getElementById('mainHeadingLabel');
            if (mainHeadingLabel) mainHeadingLabel.style.display = 'block';

            // Show shared fields (image, button) for regular sections
            const sharedFields = document.getElementById('sharedFields');
            if (sharedFields) sharedFields.style.display = 'block';

            // Show standard fields for regular sections
            if (standardFields) standardFields.style.display = 'block';

            // Show move page controls for regular sections (hidden by default in resetSectionForm)
            // Note: movePageRow visibility is managed by edit mode in populateSectionForm

            // Re-enable position selector for regular sections
            if (sectionPosition) {
                sectionPosition.disabled = false;
                sectionPosition.style.opacity = '1';
            }

            // Remove novalidate to enable HTML5 validation
            sectionForm.removeAttribute('novalidate');

            // Manage required attributes for regular mode
            if (headingInput) headingInput.setAttribute('required', '');
            if (rollingTextarea) rollingTextarea.removeAttribute('required');

            // Standard layout text field is only required for standard layout
            if (standardTextarea) {
                if (layout === 'standard') {
                    standardTextarea.setAttribute('required', '');
                } else {
                    standardTextarea.removeAttribute('required');
                }
            }

            // Toggle standard-specific fields visibility
            if (standardFields) {
                const standardOnlyFields = document.getElementById('standardOnlyFields');
                if (standardOnlyFields) {
                    standardOnlyFields.style.display = layout === 'standard' ? 'block' : 'none';
                }
            }
        }

        // Update view page link visibility
        updatePageLink(currentPage);

        console.log('[Admin Dashboard] Field toggling complete - rollingText required:',
                   rollingTextarea ? rollingTextarea.hasAttribute('required') : 'N/A');
    }

    // Page dropdown change handler
    if (pageSelect) {
        pageSelect.addEventListener('change', () => {
            loadSections();
            resetSectionForm(); // Preserves the just-chosen page
            toggleLayoutFields(); // Update field visibility and required attributes
        });
    }

    // Cancel edit button
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', resetSectionForm);
    }

    // Navigation controls
    if (showInNav && navCatRow) {
        showInNav.addEventListener('change', () => {
            navCatRow.style.display = showInNav.checked ? 'block' : 'none';
        });
        // Set initial state
        navCatRow.style.display = showInNav.checked ? 'block' : 'none';
    }

    // Layout change handler
    if (sectionLayout) {
        sectionLayout.addEventListener('change', toggleLayoutFields);
        toggleLayoutFields(); // Set initial state
    }

    // Load sections for the current page
    async function loadSections() {
        const currentPage = pageSelect.value;
        if (!currentPage) return;

        try {
            // Load both regular sections and video sections
            const [sectionsResponse, videoSectionsResponse] = await Promise.all([
                fetch(`/api/sections?page=${currentPage}`),
                fetch(`/api/video-sections?page=${currentPage}`)
            ]);

            let sections = [];
            let videoSections = [];

            if (sectionsResponse.ok) {
                sections = await sectionsResponse.json();
                console.log('[Admin Dashboard] Loaded sections from API:', sections);
                // Log team sections specifically
                const teamSections = sections.filter(s => s.layout === 'team');
                if (teamSections.length > 0) {
                    console.log('[Admin Dashboard] Team sections found:', teamSections);
                    teamSections.forEach((section, index) => {
                        console.log(`[Admin Dashboard] Team section ${index + 1} data:`, {
                            id: section._id,
                            heading: section.heading,
                            layout: section.layout,
                            team: section.team,
                            teamLength: section.team ? section.team.length : 'undefined'
                        });
                    });
                }
            }

            if (videoSectionsResponse.ok) {
                videoSections = await videoSectionsResponse.json();
            }

            // Combine and sort sections
            allSections = [...sections, ...videoSections].sort((a, b) => (a.order || 0) - (b.order || 0));

            // Populate table
            populateSectionsTable(allSections);

            console.log(`[Admin Dashboard] Loaded ${allSections.length} sections for page: ${currentPage}`);

        } catch (error) {
            console.error('[Admin Dashboard] Error loading sections:', error);
            if (sectionTbody) {
                sectionTbody.innerHTML = '<tr><td colspan="7">Error loading sections</td></tr>';
            }
        }
    }

    // Populate sections table
    function populateSectionsTable(sections) {
        if (!sectionTbody) return;

        sectionTbody.innerHTML = '';

        if (sections.length === 0) {
            sectionTbody.innerHTML = '<tr><td colspan="7">No sections found for this page</td></tr>';
            return;
        }

        sections.forEach((section, index) => {
            const row = document.createElement('tr');
            row.dataset.id = section._id;
            row.dataset.type = section.layout === 'video' ? 'video' : 'regular';

            // Order number
            const orderCell = document.createElement('td');
            orderCell.textContent = index + 1;
            row.appendChild(orderCell);

            // Heading
            const headingCell = document.createElement('td');
            // For rolling banner sections, show the text content instead of heading
            const displayText = section.page === 'rolling-banner'
                ? (section.text || 'No content')
                : (section.heading || 'No heading');
            headingCell.textContent = displayText;
            headingCell.style.maxWidth = '200px';
            headingCell.style.overflow = 'hidden';
            headingCell.style.textOverflow = 'ellipsis';
            row.appendChild(headingCell);

            // Layout
            const layoutCell = document.createElement('td');
            if (section.page === 'rolling-banner') {
                layoutCell.textContent = 'Banner';
                layoutCell.style.fontStyle = 'italic';
                layoutCell.style.color = '#666';
            } else {
                layoutCell.textContent = section.layout || 'standard';
            }
            row.appendChild(layoutCell);

            // Position
            const positionCell = document.createElement('td');
            if (section.page === 'rolling-banner') {
                positionCell.textContent = 'Rolling';
                positionCell.style.fontStyle = 'italic';
                positionCell.style.color = '#666';
            } else {
                positionCell.textContent = section.position || 'bottom';
            }
            row.appendChild(positionCell);

            // Image indicator
            const imageCell = document.createElement('td');
            if (section.page === 'rolling-banner') {
                imageCell.textContent = 'N/A';
                imageCell.style.fontStyle = 'italic';
                imageCell.style.color = '#999';
            } else {
                // Check both image and imagePath fields for backward compatibility
                const hasImage = section.image || section.imagePath;
                imageCell.textContent = hasImage ? '✅' : '❌';
            }
            row.appendChild(imageCell);

            // Button indicator
            const buttonCell = document.createElement('td');
            if (section.page === 'rolling-banner') {
                buttonCell.textContent = 'N/A';
                buttonCell.style.fontStyle = 'italic';
                buttonCell.style.color = '#999';
            } else {
                buttonCell.textContent = (section.buttonLabel && section.buttonUrl) ? '✅' : '❌';
            }
            row.appendChild(buttonCell);

            // Actions
            const actionsCell = document.createElement('td');

            const editButton = document.createElement('button');
            editButton.innerHTML = '✏️';
            editButton.title = 'Edit Section';
            editButton.className = 'edit-section';
            editButton.dataset.id = section._id;
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '🗑️';
            deleteButton.title = 'Delete Section';
            deleteButton.className = 'delete-section';
            deleteButton.dataset.id = section._id;
            actionsCell.appendChild(deleteButton);

            row.appendChild(actionsCell);
            sectionTbody.appendChild(row);
        });
    }

    // Handle form submission
    sectionForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const isEditing = !!sectionForm.dataset.editId;
        const sectionId = sectionForm.dataset.editId;
        const currentPage = pageSelect.value;
        const isRollingBanner = currentPage === 'rolling-banner';

        try {
            const formData = new FormData(sectionForm);

            // Special handling for rolling-banner sections
            if (isRollingBanner) {
                const rollingText = formData.get('rollingText')?.trim();
                if (!rollingText) {
                    alert('Please enter news content for the rolling banner');
                    return;
                }

                // 🐛 DEBUG: Log rolling banner form data (matching historical commit)
                console.log('Rolling banner form data:');
                console.log('- rollingText:', rollingText);
                console.log('- editId:', sectionId);
                console.log('- All form data before processing:');
                for (const [key, value] of formData.entries()) {
                    console.log(`  ${key}:`, value);
                }

                // For rolling banner, convert rollingText to text field and clean up form data
                formData.set('text', rollingText);
                formData.set('page', 'rolling-banner');
                formData.set('heading', 'Rolling News'); // Set dummy heading as required by API

                // Remove fields we don't want for banner sections
                ['layout', 'showInNav', 'navCategory', 'imagePath',
                 'buttonLabel', 'buttonUrl', 'position', 'team', 'rollingText'].forEach(key => {
                    formData.delete(key);
                });

                // 🐛 DEBUG: Log final form data being sent (matching historical commit)
                console.log('Final rolling banner form data being sent:');
                for (const [key, value] of formData.entries()) {
                    console.log(`  ${key}:`, value);
                }

                console.log('[Admin Dashboard] Processing rolling banner section');
            }

            const layout = formData.get('layout') || 'standard';

            // Handle different layout types with special processing
            if (!isRollingBanner) {
                if (layout === 'team') {
                    // Check if any team member images are still uploading
                    const uploadingElements = document.querySelectorAll('.team-member-form[data-uploading="true"]');
                    if (uploadingElements.length > 0) {
                        alert('Please wait for team member image uploads to complete before saving.');
                        return;
                    }

                    // Ensure team data is current
                    const teamDataElement = document.getElementById('teamData');
                    if (teamDataElement) {
                        // Trigger update to make sure data is current and capture latest image URLs
                        if (typeof updateTeamData === 'function') {
                            updateTeamData();
                        }

                        const teamDataValue = teamDataElement.value;
                        if (!teamDataValue || teamDataValue === '[]') {
                            alert('Please add at least one team member');
                            return;
                        }

                        // Set team data and placeholder text
                        formData.set('text', 'Team members section'); // Placeholder text
                        formData.set('team', teamDataValue);

                        // Remove the main image field since team sections use individual member images
                        formData.delete('image');

                        console.log('[Admin Dashboard] Processing team section with', JSON.parse(teamDataValue).length, 'members');
                        console.log('[Admin Dashboard] Team data being submitted:', teamDataValue);
                    }
                } else if (layout === 'list') {
                    // Ensure list data is current
                    if (typeof updateListData === 'function') {
                        updateListData();
                    }

                    const listItemsDataElement = document.getElementById('listItemsData');
                    if (listItemsDataElement) {
                        const listDataValue = listItemsDataElement.value;
                        if (!listDataValue || listDataValue === '{}' || listDataValue === '[]') {
                            alert('Please add at least one list item');
                            return;
                        }

                        // Validate list data structure
                        try {
                            const listData = JSON.parse(listDataValue);
                            if (!listData.items || !Array.isArray(listData.items) || listData.items.length === 0) {
                                alert('Please add at least one list item');
                                return;
                            }

                            // Set list data as text content
                            formData.set('text', listDataValue);
                            console.log('[Admin Dashboard] Processing list section with', listData.items.length, 'items');

                        } catch (e) {
                            alert('Invalid list data format');
                            return;
                        }
                    }
                } else if (layout === 'testimonial') {
                    // Ensure testimonial data is current
                    if (typeof updateTestimonialData === 'function') {
                        updateTestimonialData();
                    }

                    const testimonialsDataElement = document.getElementById('testimonialsData');
                    if (testimonialsDataElement) {
                        const testimonialsJson = testimonialsDataElement.value;
                        if (!testimonialsJson || testimonialsJson === '[]') {
                            alert('Please add at least one testimonial');
                            return;
                        }

                        // Validate testimonial JSON before submitting
                        try {
                            const testimonialData = JSON.parse(testimonialsJson);
                            if (!Array.isArray(testimonialData)) {
                                alert('Invalid testimonial data format - must be an array');
                                return;
                            }

                            // Validate each testimonial has required fields
                            for (let i = 0; i < testimonialData.length; i++) {
                                const testimonial = testimonialData[i];
                                if (!testimonial.quote || typeof testimonial.quote !== 'string') {
                                    alert(`Testimonial ${i + 1} is missing a quote`);
                                    return;
                                }
                                if (!testimonial.author || typeof testimonial.author !== 'string') {
                                    alert(`Testimonial ${i + 1} is missing an author`);
                                    return;
                                }
                            }

                            // Set testimonials data as text content
                            formData.set('text', testimonialsJson);
                            console.log('[Admin Dashboard] Processing testimonial section with', testimonialData.length, 'testimonials');

                        } catch (e) {
                            console.error('Invalid testimonial JSON on client:', e.message);
                            alert('Invalid testimonial data format: ' + e.message);
                            return;
                        }
                    }
                } else if (layout === 'video') {
                    // Video handling
                    const videoUrl = formData.get('videoUrl')?.trim();
                    if (!videoUrl) {
                        alert('Please enter a video URL or select a video');
                        return;
                    }
                    console.log('[Admin Dashboard] Processing video section');
                }
            }

            // Determine the correct API endpoint (always POST, use editId for updates)
            let apiUrl;
            const method = 'POST'; // Always use POST, original API design

            // For rolling-banner, always use /api/sections regardless of layout
            if (isRollingBanner) {
                apiUrl = '/api/sections';
            } else if (layout === 'video') {
                apiUrl = '/api/video-sections';
            } else {
                apiUrl = '/api/sections';
            }

            // Handle targetPage field conversion (matching original admin.html logic)
            if (isEditing) {
                // When editing, check if we have a targetPage field (from move section dropdown)
                const moveVal = formData.get('targetPage')?.trim();
                if (moveVal) {
                    // For rolling-banner sections, ignore moveVal and always use 'rolling-banner'
                    const newPage = isRollingBanner ? 'rolling-banner' : moveVal;
                    formData.set('page', newPage);
                    formData.delete('targetPage'); // Remove targetPage after converting to page
                    console.log(`[Admin Dashboard] Moving section to page: ${newPage}`);
                }
            }

            // Add editId for updates (original API design)
            if (isEditing) {
                formData.append('editId', sectionId);
            }

            console.log(`[Admin Dashboard] Submitting ${method} to ${apiUrl} (rolling-banner: ${isRollingBanner})`);

            const response = await fetch(apiUrl, {
                method: method,
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const result = await response.json();
            console.log(`[Admin Dashboard] Section ${isEditing ? 'updated' : 'created'} successfully`);
            alert(`Section ${isEditing ? 'updated' : 'saved'} successfully!`);

            // Reset form and reload sections
            resetSectionForm();
            loadSections();

            // Refresh rolling banner immediately if we just added/updated news
            if (isRollingBanner) {
                try {
                    const bannerResponse = await fetch('/api/sections?page=rolling-banner');
                    if (bannerResponse.ok) {
                        const bannerSections = await bannerResponse.json();
                        const tutorBanner = document.getElementById('tutorBanner');
                        if (tutorBanner && bannerSections.length > 0) {
                            tutorBanner.textContent = bannerSections.map(s => s.text).join(' | ');
                        }
                    }
                } catch (bannerError) {
                    console.error('[Admin Dashboard] Error refreshing banner:', bannerError);
                }
            }

        } catch (error) {
            console.error('[Admin Dashboard] Section save error:', error);
            alert('Error saving section: ' + error.message);
        }
    });

    // Handle table interactions (edit/delete)
    if (sectionTbody) {
        sectionTbody.addEventListener('click', async (e) => {
            const sectionId = e.target.dataset.id;

            if (e.target.classList.contains('edit-section')) {
                // Find the section to edit
                const section = allSections.find(s => s._id === sectionId);
                if (!section) {
                    alert('Section not found for editing');
                    return;
                }

                console.log('[Admin Dashboard] Editing section:', section);
                if (section.layout === 'team') {
                    console.log('[Admin Dashboard] Team section data for editing:', {
                        id: section._id,
                        heading: section.heading,
                        layout: section.layout,
                        team: section.team,
                        teamIsArray: Array.isArray(section.team),
                        teamLength: section.team ? section.team.length : 'undefined'
                    });
                }

                // Populate form for editing
                populateSectionForm(section);
                sectionForm.scrollIntoView({ behavior: 'smooth' });

            } else if (e.target.classList.contains('delete-section')) {
                if (!confirm('Are you sure you want to delete this section?')) {
                    return;
                }

                try {
                    // Determine API endpoint based on section type
                    const row = e.target.closest('tr');
                    const sectionType = row.dataset.type;
                    const apiUrl = sectionType === 'video'
                        ? `/api/video-sections?id=${sectionId}`
                        : `/api/sections?id=${sectionId}`;

                    const response = await fetch(apiUrl, {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    if (response.ok) {
                        alert('Section deleted successfully!');
                        loadSections(); // Refresh the sections list
                    } else {
                        const error = await response.text();
                        alert(`Failed to delete section: ${error}`);
                    }
                } catch (error) {
                    console.error('[Admin Dashboard] Error deleting section:', error);
                    alert('An error occurred while deleting the section.');
                }
            }
        });
    }

    // Populate form for editing
    function populateSectionForm(section) {
        const isRollingBanner = section.page === 'rolling-banner';

        // Set basic fields
        if (pageSelect) pageSelect.value = section.page || '';

        // Set position field (default to 'bottom' if not specified)
        if (sectionPosition) sectionPosition.value = section.position || 'bottom';

        // Handle rolling-banner sections differently
        if (isRollingBanner) {
            // For rolling-banner, populate the rolling text field with section.text
            const rollingTextField = sectionForm.querySelector('[name="rollingText"]');
            if (rollingTextField) rollingTextField.value = section.text || '';

            // Set layout to 'standard' for rolling banner to avoid API endpoint confusion
            const layoutField = sectionForm.querySelector('[name="layout"]');
            if (layoutField) layoutField.value = 'standard';

            // Update form heading
            sectionFormHeading.textContent = 'Edit Rolling Banner News';

        } else {
            // Regular sections
            const headingField = sectionForm.querySelector('[name="heading"]');
            if (headingField) headingField.value = section.heading || '';

            const textField = sectionForm.querySelector('[name="text"]');
            if (textField) textField.value = section.text || '';

            const layoutField = sectionForm.querySelector('[name="layout"]');
            if (layoutField) {
                layoutField.value = section.layout || 'standard';
                // Trigger layout change to show/hide appropriate fields
                layoutField.dispatchEvent(new Event('change'));
            }

            // Clear rolling text field for regular sections
            const rollingTextField = sectionForm.querySelector('[name="rollingText"]');
            if (rollingTextField) rollingTextField.value = '';

            // Handle layout-specific data population
            if (section.layout === 'team' && section.team) {
                // Ensure team builder is visible first
                const teamBuilder = document.getElementById('teamBuilder');
                if (teamBuilder) {
                    teamBuilder.style.display = 'block';
                }

                // Add a small delay to ensure DOM elements are ready
                setTimeout(() => {
                    // Populate team builder with existing team data
                    if (typeof populateTeamBuilder === 'function') {
                        console.log('[Admin Dashboard] About to populate team builder with data:', section.team);
                        populateTeamBuilder(section.team);
                        console.log('[Admin Dashboard] Team builder populated with', section.team.length, 'members');
                    } else {
                        console.error('[Admin Dashboard] populateTeamBuilder function not found');
                        // Fallback: try to populate manually if function is not available
                        const teamMemberList = document.getElementById('teamMemberList');
                        const teamData = document.getElementById('teamData');
                        if (teamMemberList && teamData && section.team) {
                            console.log('[Admin Dashboard] Using fallback team population method');
                            // Store the team data for manual population
                            teamData.value = JSON.stringify(section.team);
                        }
                    }
                }, 100);
            } else if (section.layout === 'list' && section.text) {
                // Populate list builder with existing list data
                try {
                    const listData = JSON.parse(section.text);
                    if (typeof populateListBuilder === 'function') {
                        populateListBuilder(listData);
                    }
                    console.log('[Admin Dashboard] Populated list builder with', listData.items?.length || 0, 'items');
                } catch (e) {
                    console.log('[Admin Dashboard] Could not parse list data:', e);
                    // Try to handle legacy format
                    if (typeof populateListBuilder === 'function') {
                        populateListBuilder({ items: [], listType: 'unordered', description: '' });
                    }
                }
            } else if (section.layout === 'testimonial' && section.text) {
                // Populate testimonial builder with existing testimonial data
                try {
                    let testimonialData = JSON.parse(section.text);

                    // Convert old single testimonial format to array format
                    if (testimonialData.quote && !Array.isArray(testimonialData)) {
                        testimonialData = [testimonialData];
                    }

                    if (typeof populateTestimonialBuilder === 'function') {
                        populateTestimonialBuilder(testimonialData);
                    }
                    console.log('[Admin Dashboard] Populated testimonial builder with', testimonialData.length, 'testimonials');
                } catch (e) {
                    console.log('[Admin Dashboard] Could not parse testimonial data:', e);
                    // Add one empty testimonial for editing
                    if (typeof populateTestimonialBuilder === 'function') {
                        populateTestimonialBuilder([]);
                    }
                }
            } else if (section.layout === 'video' && section.videoUrl) {
                // Populate video URL field
                const videoUrlField = sectionForm.querySelector('[name="videoUrl"]');
                if (videoUrlField) {
                    videoUrlField.value = section.videoUrl;
                }
                console.log('[Admin Dashboard] Populated video URL:', section.videoUrl);
            }
        }

        // Update field visibility based on section type
        toggleLayoutFields();

        // Navigation fields
        if (showInNav) {
            showInNav.checked = !!section.showInNav;
            if (navCatRow) navCatRow.style.display = showInNav.checked ? 'block' : 'none';
        }

        const navCategoryField = sectionForm.querySelector('[name="navCategory"]');
        if (navCategoryField) navCategoryField.value = section.navCategory || 'about';

        // Button fields
        const buttonLabelField = sectionForm.querySelector('[name="buttonLabel"]');
        const buttonUrlField = sectionForm.querySelector('[name="buttonUrl"]');
        if (buttonLabelField) buttonLabelField.value = section.buttonLabel || '';
        if (buttonUrlField) buttonUrlField.value = section.buttonUrl || '';

        // Show current image if exists
        const imageUrl = section.image || section.imagePath; // Check both fields for backward compatibility
        if (imageUrl && currentImagePreview) {
            currentImagePreview.style.display = 'block';
            const img = currentImagePreview.querySelector('img');
            if (img) img.src = imageUrl;
        }

        // Show remove button option if button exists
        if ((section.buttonLabel && section.buttonUrl) && removeButtonRow) {
            removeButtonRow.style.display = 'block';
        }

        // Show move page option (except for rolling banner)
        if (movePageRow && movePageSelect && section.page !== 'rolling-banner') {
            movePageRow.style.display = 'block';
            movePageSelect.value = section.page || '';
        }

        // Update UI for edit mode
        sectionForm.dataset.editId = section._id;
        sectionFormHeading.textContent = 'Edit Section';
        submitSectionBtn.textContent = 'Update Section';
        cancelEditBtn.style.display = 'inline-block';

        console.log('[Admin Dashboard] Form populated for editing section:', section._id);
    }

    // Initialize sections management
    if (pageSelect) {
        // Load sections for initial page
        loadSections();
        updatePageLink(pageSelect.value);
    }

    console.log('[Admin Dashboard] Section management initialized');
}

/**
 * Initialize tutor management functionality
 */
function initTutorManagement() {
    const tutorForm = document.getElementById('tutorForm');
    if (!tutorForm) {
        console.log('[Admin Dashboard] Tutor form not found, skipping tutor management init');
        return;
    }

    // Get form elements
    const tutorFormHeading = document.getElementById('tutorFormHeading');
    const submitTutorBtn = document.getElementById('submitTutorBtn');
    const cancelTutorEditBtn = document.getElementById('cancelTutorEditBtn');
    const currentTutorImagePreview = document.getElementById('currentTutorImagePreview');
    const imageField = document.getElementById('imageField');
    const removeImageCheckbox = tutorForm.querySelector('[name="removeImage"]');

    // Store all tutors for editing
    let allTutors = [];

    // Helper: Reset form to create mode
    function resetTutorForm() {
        tutorForm.reset();
        delete tutorForm.dataset.editId;
        tutorFormHeading.textContent = 'Add a Tutor';
        submitTutorBtn.textContent = 'Add Tutor';
        cancelTutorEditBtn.style.display = 'none';
        currentTutorImagePreview.style.display = 'none';
        if (removeImageCheckbox) removeImageCheckbox.checked = false;

        // Reset subject checkboxes and other text input
        const subjectsCheckboxes = document.querySelectorAll('input[name="subjects"]');
        const otherTextInput = document.getElementById('subject-other-text');

        subjectsCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        if (otherTextInput) {
            otherTextInput.value = '';
            otherTextInput.disabled = true;
        }
    }

    // Helper: Populate form for editing
    function populateTutorForm(tutor) {
        tutorForm.name.value = tutor.name || '';

        // Handle checkbox-based subjects selection
        const subjectsCheckboxes = document.querySelectorAll('input[name="subjects"]');
        const subjects = (tutor.subjects || []).map(s => s.toLowerCase().trim());
        const otherTextInput = document.getElementById('subject-other-text');
        const otherCheckbox = document.getElementById('subject-other-checkbox');

        // Clear all checkboxes first
        subjectsCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        otherTextInput.value = '';
        otherCheckbox.checked = false;

        // Check matching subjects and collect any that don't match predefined options
        const predefinedSubjects = ['mathematics', 'english', 'sciences', 'social studies', 'languages', 'technologies', 'expressive arts', 'health and wellbeing', 'religious and moral education'];
        const otherSubjects = [];

        subjects.forEach(subject => {
            const matchingCheckbox = Array.from(subjectsCheckboxes).find(cb => cb.value.toLowerCase() === subject);
            if (matchingCheckbox) {
                matchingCheckbox.checked = true;
            } else if (subject && !predefinedSubjects.includes(subject)) {
                otherSubjects.push(subject);
            }
        });

        // Handle "other" subjects
        if (otherSubjects.length > 0) {
            otherCheckbox.checked = true;
            otherTextInput.value = otherSubjects.join(', ');
        }

        // Convert __P__ back to £ for display in the form
        tutorForm.costRange.value = (tutor.costRange || '').replace(/__P__/g, '£');
        tutorForm.badges.value = (tutor.badges || []).join(', ');
        tutorForm.contact.value = tutor.contact || '';
        tutorForm.description.value = tutor.description || '';

        // Handle checkbox-based regions selection
        const regionsCheckboxes = document.querySelectorAll('input[name="regions"]');
        const regions = (tutor.regions || []);
        regionsCheckboxes.forEach(checkbox => {
            checkbox.checked = regions.includes(checkbox.value);
        });

        // Show current image if exists
        if (tutor.imagePath) {
            currentTutorImagePreview.style.display = 'block';
            currentTutorImagePreview.querySelector('img').src = tutor.imagePath;
        } else {
            currentTutorImagePreview.style.display = 'none';
        }

        if (removeImageCheckbox) removeImageCheckbox.checked = false;

        // Update UI for edit mode
        tutorFormHeading.textContent = 'Edit Tutor';
        submitTutorBtn.textContent = 'Update Tutor';
        cancelTutorEditBtn.style.display = 'inline-block';
        tutorForm.dataset.editId = tutor._id;
    }

    // Cancel edit button
    cancelTutorEditBtn.addEventListener('click', () => {
        resetTutorForm();
    });

    // Handle tutor form submission
    tutorForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const isEditing = !!tutorForm.dataset.editId;
        const tutorId = tutorForm.dataset.editId;

        const fd = new FormData(tutorForm);
        const csv = s => s.split(',').map(x => x.trim()).filter(Boolean);

        // Optional image upload
        let uploadedImagePath = '';
        if (imageField.files[0]) {
            const f = imageField.files[0];
            if (f.size > 2 * 1024 * 1024) return alert('Image > 2 MB');
            try {
                // Use upload helper if available, otherwise basic upload
                if (typeof uploadImage === 'function') {
                    uploadedImagePath = await uploadImage(f, 'tutors');
                } else {
                    // Fallback upload method
                    const uploadFormData = new FormData();
                    uploadFormData.append('file', f);
                    uploadFormData.append('folder', 'tutors');
                    const uploadResponse = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: uploadFormData,
                        credentials: 'include' // ✅ SECURITY FIX: Include cookies for JWT authentication
                    });
                    if (!uploadResponse.ok) throw new Error('Image upload failed');
                    const uploadResult = await uploadResponse.json();
                    uploadedImagePath = uploadResult.url;
                }
            } catch (err) {
                return alert(err.message);
            }
        }

        // Determine method and URL based on mode
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `/api/addTutor?id=${tutorId}` : '/api/addTutor';

        // Convert £ symbols to __P__ before sending to database
        let costRange = fd.get('costRange').trim();
        costRange = costRange.replace(/£/g, '__P__');

        // Collect subjects from checkboxes
        const selectedSubjects = [];
        const subjectsCheckboxes = document.querySelectorAll('input[name="subjects"]:checked');
        const otherTextInput = document.getElementById('subject-other-text');
        const otherCheckbox = document.getElementById('subject-other-checkbox');

        // Add selected predefined subjects
        subjectsCheckboxes.forEach(checkbox => {
            if (checkbox.value && checkbox !== otherCheckbox) {
                selectedSubjects.push(checkbox.value.toLowerCase().trim());
            }
        });

        // Add other subjects if specified
        if (otherCheckbox.checked && otherTextInput.value.trim()) {
            // Split by comma, trim, lowercase, and filter out empty strings
            const otherSubjects = otherTextInput.value.split(',')
                .map(s => s.trim().toLowerCase())
                .filter(s => s.length > 0);
            selectedSubjects.push(...otherSubjects);
        }

        // Validate that at least one subject is selected
        if (selectedSubjects.length === 0) {
            alert('Please select at least one subject.');
            return;
        }

        const payload = {
            name: fd.get('name').trim(),
            subjects: selectedSubjects,
            costRange: costRange,
            badges: csv(fd.get('badges')),
            contact: fd.get('contact').trim(),
            description: fd.get('description').trim(),
            regions: Array.from(document.querySelectorAll('input[name="regions"]:checked')).map(cb => cb.value),
            imagePath: uploadedImagePath,
            removeImage: removeImageCheckbox ? removeImageCheckbox.checked : false
        };

        // For POST fallback, add editId to payload
        if (isEditing) {
            payload.editId = tutorId;
        }

        try {
            console.log('Sending tutor data to API:', payload);
            const r = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!r.ok) {
                // Try to parse the error response as JSON
                try {
                    const errorData = await r.json();
                    console.error('Error with tutor operation:', errorData);
                    return alert(`Error: ${errorData.message || 'Unknown error'}`);
                } catch (parseError) {
                    // If JSON parsing fails, use text response
                    const errorText = await r.text();
                    console.error('Error with tutor operation (text):', errorText);
                    return alert(`Error: ${errorText || 'Unknown error'}`);
                }
            }

            const result = await r.json();
            console.log(`Tutor ${isEditing ? 'updated' : 'added'} successfully`);
            alert(`Tutor ${isEditing ? 'updated' : 'added'} successfully!`);

            resetTutorForm();
            loadTutors(); // Refresh the tutor list
        } catch (error) {
            console.error('Exception while processing tutor:', error);
            alert(`An error occurred: ${error.message}`);
        }
    });

    // Handle "Other" subject checkbox behavior
    const otherCheckbox = document.getElementById('subject-other-checkbox');
    const otherTextInput = document.getElementById('subject-other-text');

    if (otherCheckbox && otherTextInput) {
        // Initially disable the text input if checkbox is not checked
        otherTextInput.disabled = !otherCheckbox.checked;

        otherCheckbox.addEventListener('change', function() {
            if (this.checked) {
                otherTextInput.disabled = false;
                otherTextInput.focus();
            } else {
                otherTextInput.disabled = true;
                otherTextInput.value = '';
            }
        });

        // When text input has content, automatically check the checkbox
        otherTextInput.addEventListener('input', function() {
            if (this.value.trim() && !otherCheckbox.checked) {
                otherCheckbox.checked = true;
            }
        });
    }

    // Load and display tutors
    async function loadTutors() {
        try {
            const response = await fetch('/api/tutors?format=json');
            if (!response.ok) {
                throw new Error('Failed to fetch tutors');
            }

            const tutors = await response.json();
            allTutors = tutors; // Store for editing
            const tutorTableBody = document.querySelector('#tutorTable tbody');
            tutorTableBody.innerHTML = '';

            tutors.forEach(tutor => {
                const row = document.createElement('tr');
                row.dataset.id = tutor._id;

                // Image cell
                const imageCell = document.createElement('td');
                if (tutor.imagePath) {
                    const img = document.createElement('img');
                    img.src = tutor.imagePath;
                    img.alt = tutor.name;
                    img.style.cssText = 'max-width: 50px; max-height: 50px; border-radius: 4px;';
                    imageCell.appendChild(img);
                } else {
                    imageCell.textContent = 'No image';
                }
                row.appendChild(imageCell);

                // Name cell
                const nameCell = document.createElement('td');
                nameCell.textContent = tutor.name;
                row.appendChild(nameCell);

                // Subjects cell
                const subjectsCell = document.createElement('td');
                subjectsCell.className = 'tutor-subjects';
                subjectsCell.textContent = tutor.subjects.join(', ');
                row.appendChild(subjectsCell);

                // Cost cell
                const costCell = document.createElement('td');
                // Convert __P__ back to £ for display in the table
                costCell.textContent = (tutor.costRange || '').replace(/__P__/g, '£');
                row.appendChild(costCell);

                // Actions cell
                const actionsCell = document.createElement('td');

                const editButton = document.createElement('button');
                editButton.innerHTML = '✏️';
                editButton.title = 'Edit Tutor';
                editButton.className = 'edit-tutor';
                editButton.dataset.id = tutor._id;
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '🗑️';
                deleteButton.title = 'Delete Tutor';
                deleteButton.className = 'delete-tutor';
                deleteButton.dataset.id = tutor._id;
                actionsCell.appendChild(deleteButton);

                row.appendChild(actionsCell);
                tutorTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading tutors:', error);
            alert('Failed to load tutors. Please try again.');
        }
    }

    // Handle edit and delete actions with event delegation
    document.querySelector('#tutorTable tbody').addEventListener('click', async (e) => {
        const tutorId = e.target.dataset.id;

        if (e.target.classList.contains('edit-tutor')) {
            // Find the tutor to edit
            const tutor = allTutors.find(t => t._id === tutorId);
            if (!tutor) {
                alert('Tutor not found for editing');
                return;
            }

            // Populate form and scroll to it
            populateTutorForm(tutor);
            tutorForm.scrollIntoView({ behavior: 'smooth' });
        } else if (e.target.classList.contains('delete-tutor')) {
            if (!confirm('Are you sure you want to delete this tutor?')) {
                return;
            }

            try {
                const response = await fetch(`/api/addTutor?id=${tutorId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (response.ok) {
                    alert('Tutor deleted successfully!');
                    loadTutors(); // Refresh the tutor list
                } else {
                    const error = await response.text();
                    alert(`Failed to delete tutor: ${error}`);
                }
            } catch (error) {
                console.error('Error deleting tutor:', error);
                alert('An error occurred while deleting the tutor.');
            }
        }
    });

    // Load tutors when the page loads
    loadTutors();

    console.log('[Admin Dashboard] Tutor management initialized');
}

/**
 * Initialize page management functionality
 */
function initPageManagement() {
    const pageForm = document.getElementById('pageForm');
    if (!pageForm) {
        console.log('[Admin Dashboard] Page form not found, skipping page management init');
        return;
    }

    // Get form elements
    const pagesTbody = document.querySelector('#pagesTable tbody');
    const pageFormHeading = document.getElementById('pageFormHeading');
    const submitPageBtn = document.getElementById('submitPageBtn');
    const cancelPageEditBtn = document.getElementById('cancelPageEditBtn');
    const pageEditOptions = document.getElementById('pageEditOptions');
    const currentPageImagePreview = document.getElementById('currentPageImagePreview');
    const pageShowInNav = document.getElementById('pageShowInNav');
    const pageNavCatRow = document.getElementById('pageNavCatRow');
    const pageImage = document.getElementById('pageImage');

    // Store all pages for editing
    let allPages = [];

    // Helper: Reset form to create mode
    function resetPageForm() {
        pageForm.reset();
        delete pageForm.dataset.editId;
        pageFormHeading.textContent = 'Create a New Page';
        submitPageBtn.textContent = 'Create Page';
        cancelPageEditBtn.style.display = 'none';
        pageEditOptions.style.display = 'none';
        currentPageImagePreview.style.display = 'none';
        currentPageImagePreview.innerHTML = '';

        // Reset navigation category visibility
        if (pageNavCatRow) pageNavCatRow.style.display = 'none';

        console.log('[Admin Dashboard] Page form reset to create mode');
    }

    // Navigation controls for pages
    if (pageShowInNav && pageNavCatRow) {
        pageShowInNav.addEventListener('change', () => {
            pageNavCatRow.style.display = pageShowInNav.checked ? 'block' : 'none';
        });
        // Set initial state
        pageNavCatRow.style.display = pageShowInNav.checked ? 'block' : 'none';
    }

    // Cancel edit button
    if (cancelPageEditBtn) {
        cancelPageEditBtn.addEventListener('click', resetPageForm);
    }

    // Load and display pages
    async function loadPages() {
        try {
            const response = await fetch('/api/sections?isFullPage=true');
            if (!response.ok) {
                throw new Error('Failed to fetch pages');
            }

            const pages = await response.json();
            allPages = pages; // Store for editing

            if (!pagesTbody) return;

            pagesTbody.innerHTML = '';

            if (pages.length === 0) {
                pagesTbody.innerHTML = '<tr><td colspan="4">No pages found</td></tr>';
                return;
            }

            pages.forEach(page => {
                const row = document.createElement('tr');
                row.dataset.id = page._id;

                // Title cell
                const titleCell = document.createElement('td');
                titleCell.textContent = page.heading || 'Untitled';
                titleCell.style.maxWidth = '200px';
                titleCell.style.overflow = 'hidden';
                titleCell.style.textOverflow = 'ellipsis';
                row.appendChild(titleCell);

                // URL cell
                const urlCell = document.createElement('td');
                const pageUrl = page.slug === 'index' ? '/' : `/${page.slug}.html`;
                const urlLink = document.createElement('a');
                urlLink.href = pageUrl;
                urlLink.target = '_blank';
                urlLink.textContent = pageUrl;
                urlLink.style.color = '#0066cc';
                urlCell.appendChild(urlLink);
                row.appendChild(urlCell);

                // Status cell
                const statusCell = document.createElement('td');
                const statusSpan = document.createElement('span');
                statusSpan.textContent = page.isPublished ? 'Published' : 'Draft';
                statusSpan.style.padding = '4px 8px';
                statusSpan.style.borderRadius = '4px';
                statusSpan.style.fontSize = '0.8em';
                statusSpan.style.fontWeight = 'bold';
                if (page.isPublished) {
                    statusSpan.style.backgroundColor = '#d4edda';
                    statusSpan.style.color = '#155724';
                } else {
                    statusSpan.style.backgroundColor = '#fff3cd';
                    statusSpan.style.color = '#856404';
                }
                statusCell.appendChild(statusSpan);
                row.appendChild(statusCell);

                // Actions cell
                const actionsCell = document.createElement('td');

                const editButton = document.createElement('button');
                editButton.innerHTML = '✏️';
                editButton.title = 'Edit Page';
                editButton.className = 'edit-page';
                editButton.dataset.id = page._id;
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '🗑️';
                deleteButton.title = 'Delete Page';
                deleteButton.className = 'delete-page';
                deleteButton.dataset.id = page._id;
                actionsCell.appendChild(deleteButton);

                row.appendChild(actionsCell);
                pagesTbody.appendChild(row);
            });

            console.log(`[Admin Dashboard] Loaded ${pages.length} pages`);

        } catch (error) {
            console.error('[Admin Dashboard] Error loading pages:', error);
            if (pagesTbody) {
                pagesTbody.innerHTML = '<tr><td colspan="4">Error loading pages</td></tr>';
            }
        }
    }

    // Handle form submission
    pageForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const isEditing = !!pageForm.dataset.editId;
        const pageId = pageForm.dataset.editId;

        try {
            const formData = new FormData(pageForm);

            // Set required fields for page creation
            formData.append('isFullPage', 'true');

            // Handle navigation category
            const pageNavCategory = document.getElementById('pageNavCategory');
            formData.set('navCategory', pageNavCategory.value || 'about');

            // Handle published status
            const isPublished = document.getElementById('isPublished');
            formData.set('isPublished', isPublished.checked ? 'true' : 'false');

            // Handle button fields
            formData.set('buttonLabel', formData.get('buttonLabel') || '');
            formData.set('buttonUrl', formData.get('buttonUrl') || '');

            // Handle image upload if present
            if (pageImage.files[0]) {
                const imageFile = pageImage.files[0];
                if (imageFile.size > 2 * 1024 * 1024) {
                    alert('Image file is too large (max 2MB)');
                    return;
                }

                try {
                    let imageUrl;

                    // Try to use upload helper first, with fallback
                    if (uploadHelperLoaded && typeof uploadImage === 'function') {
                        console.log('[Page Creation] Using upload helper for image upload');
                        imageUrl = await uploadImage(imageFile, 'pages');
                    } else {
                        console.log('[Page Creation] Using fallback upload method');
                        // Fallback upload method with improved error handling
                        const uploadFormData = new FormData();
                        uploadFormData.append('file', imageFile);
                        uploadFormData.append('folder', 'pages');

                        const uploadResponse = await fetch('/api/upload-image', {
                            method: 'POST',
                            body: uploadFormData,
                            credentials: 'include' // ✅ SECURITY FIX: Include cookies for JWT authentication
                        });

                        if (!uploadResponse.ok) {
                            const errorText = await uploadResponse.text();
                            console.error('Upload failed:', uploadResponse.status, errorText);
                            throw new Error(`Image upload failed: ${uploadResponse.status} - ${errorText}`);
                        }

                        const uploadResult = await uploadResponse.json();
                        imageUrl = uploadResult.url;
                    }

                    if (imageUrl) {
                        formData.set('imagePath', imageUrl);
                        console.log('[Page Creation] Image uploaded successfully:', imageUrl);
                    } else {
                        throw new Error('Upload succeeded but no URL returned');
                    }

                } catch (uploadError) {
                    console.error('[Page Creation] Image upload error:', uploadError);
                    alert('Image upload failed: ' + uploadError.message);
                    return;
                }
            }

            // Remove the file input from form data to avoid sending it
            formData.delete('image');

            // Add editId for updates
            if (isEditing) {
                formData.append('editId', pageId);
            }

            console.log(`[Admin Dashboard] Submitting page ${isEditing ? 'update' : 'creation'}`);

            const response = await fetch('/api/sections', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const result = await response.json();
            console.log(`[Admin Dashboard] Page ${isEditing ? 'updated' : 'created'} successfully`);
            alert(`Page ${isEditing ? 'updated' : 'created'} successfully!`);

            // Reset form and reload pages
            resetPageForm();
            loadPages();

        } catch (error) {
            console.error('[Admin Dashboard] Page save error:', error);
            alert('Error saving page: ' + error.message);
        }
    });

    // Handle table interactions (edit/delete/toggle publish)
    if (pagesTbody) {
        pagesTbody.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const pageId = button.dataset.id;

            if (button.classList.contains('edit-page')) {
                // Find the page to edit
                const page = allPages.find(p => p._id === pageId);
                if (!page) {
                    alert('Page not found for editing');
                    return;
                }

                // Populate form for editing
                populatePageForm(page);
                pageForm.scrollIntoView({ behavior: 'smooth' });

            } else if (button.classList.contains('delete-page')) {
                if (!confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
                    return;
                }

                try {
                    const response = await fetch(`/api/sections?id=${pageId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    if (response.ok) {
                        alert('Page deleted successfully!');
                        loadPages(); // Refresh the pages list
                    } else {
                        const error = await response.text();
                        alert(`Failed to delete page: ${error}`);
                    }
                } catch (error) {
                    console.error('[Admin Dashboard] Error deleting page:', error);
                    alert('An error occurred while deleting the page.');
                }
            }
        });
    }

    // Populate form for editing
    function populatePageForm(page) {
        // Set basic fields
        pageForm.slug.value = page.slug || '';
        pageForm.heading.value = page.heading || '';
        pageForm.text.value = page.text || '';
        pageForm.buttonLabel.value = page.buttonLabel || '';
        pageForm.buttonUrl.value = page.buttonUrl || '';

        // Set checkboxes
        const isPublished = document.getElementById('isPublished');
        if (isPublished) isPublished.checked = !!page.isPublished;

        if (pageShowInNav) {
            pageShowInNav.checked = !!page.showInNav;
            if (pageNavCatRow) pageNavCatRow.style.display = pageShowInNav.checked ? 'block' : 'none';
        }

        const pageNavCategory = document.getElementById('pageNavCategory');
        if (pageNavCategory) pageNavCategory.value = page.navCategory || 'about';

        // Show current image if exists
        if (page.image && currentPageImagePreview) {
            currentPageImagePreview.innerHTML = `
                <p style="margin-bottom: 5px;">Current Image:</p>
                <img src="${page.image}" alt="Current Image" style="max-width: 120px; border-radius: 4px;">
            `;
            currentPageImagePreview.style.display = 'block';
        }

        // Update UI for edit mode
        pageForm.dataset.editId = page._id;
        pageFormHeading.textContent = 'Edit Page';
        submitPageBtn.textContent = 'Update Page';
        cancelPageEditBtn.style.display = 'inline-block';
        pageEditOptions.style.display = 'block';

        console.log('[Admin Dashboard] Form populated for editing page:', page._id);
    }

    // Initialize page management
    loadPages();

    console.log('[Admin Dashboard] Page management initialized');
}

/**
 * Initialize advanced section layout builders (team, list, testimonials, video)
 */
function initAdvancedSectionBuilders() {
    console.log('[Admin Dashboard] Initializing advanced section builders');

    // Get layout selector and builder containers
    const sectionLayout = document.getElementById('sectionLayout');
    const teamBuilder = document.getElementById('teamBuilder');
    const listBuilder = document.getElementById('listBuilder');
    const testimonialBuilder = document.getElementById('testimonialBuilder');
    const videoBuilder = document.getElementById('videoBuilder');
    const standardOnlyFields = document.getElementById('standardOnlyFields');
    const sharedFields = document.getElementById('sharedFields');

    if (!sectionLayout) {
        console.log('[Admin Dashboard] Section layout selector not found, skipping advanced builders init');
        return;
    }

    // Team builder elements
    const addMemberBtn = document.getElementById('addMemberBtn');
    const teamMemberList = document.getElementById('teamMemberList');
    const teamData = document.getElementById('teamData');

    // Initialize team members array
    let teamMembers = [];

    /**
     * Create a team member card with form fields and image upload
     * @param {number} index - Index of the team member
     * @returns {HTMLElement} The created team member card element
     */
    function createTeamMemberCard(index) {
        const el = document.createElement('div');
        el.className = 'team-member-form';
        el.style.cssText = 'border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:5px; background:#f9f9f9';

        el.innerHTML = `
            <h4 style="margin-top: 0; color: #4a90e2;">Team Member ${index + 1}</h4>

            <div class="form-group">
                <label>Name & Role:
                    <input type="text" class="member-nameRole form-control"
                           placeholder="e.g., John Smith - Marketing Director"
                           style="width: 100%; margin-bottom: 10px;" required>
                </label>
            </div>

            <div class="form-group">
                <label>Bio:
                    <textarea class="member-bio form-control" rows="3"
                              placeholder="Brief description of the team member's background and expertise..."
                              style="width: 100%; margin-bottom: 10px;" required></textarea>
                </label>
            </div>

            <div class="form-group">
                <label>Quote (Optional):
                    <input type="text" class="member-quote form-control"
                           placeholder="e.g., 'Passionate about helping students succeed'"
                           style="width: 100%; margin-bottom: 10px;">
                </label>
            </div>

            <div class="form-group">
                <label>Member Image:
                    <input type="file" class="member-image" accept="image/*"
                           style="width: 100%; margin-bottom: 10px;">
                </label>
                <div class="image-preview" style="display: none; margin-top: 10px;">
                    <p style="margin-bottom: 5px;">Preview:</p>
                    <img src="" alt="Team Member Preview"
                         style="max-width: 120px; max-height: 120px; border-radius: 4px; object-fit: cover;">
                </div>
            </div>

            <button type="button" class="remove-member"
                    style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; float: right;">
                🗑️ Remove Member
            </button>
            <div style="clear: both;"></div>
        `;

        // Get elements for event handling
        const imageInput = el.querySelector('.member-image');
        const previewDiv = el.querySelector('.image-preview');
        const previewImg = previewDiv.querySelector('img');

        // Handle image preview and upload
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Show preview immediately
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);

                // Upload immediately to prevent race conditions
                if (!el.dataset.uploading) {
                    el.dataset.uploading = 'true';

                    try {
                        // Use upload helper if available
                        let imagePath;
                        if (typeof uploadImage === 'function') {
                            imagePath = await uploadImage(file, 'team');
                        } else {
                            // Fallback upload method
                            const uploadFormData = new FormData();
                            uploadFormData.append('file', file);
                            uploadFormData.append('folder', 'team');
                            const uploadResponse = await fetch('/api/upload-image', {
                                method: 'POST',
                                body: uploadFormData,
                                credentials: 'include' // ✅ SECURITY FIX: Include cookies for JWT authentication
                            });
                            if (!uploadResponse.ok) throw new Error('Image upload failed');
                            const uploadResult = await uploadResponse.json();
                            imagePath = uploadResult.url;
                        }

                        el.dataset.imageUploaded = 'true';
                        el.dataset.existingImage = imagePath;
                        console.log('Team member image uploaded successfully:', imagePath);

                    } catch (err) {
                        console.error('Team member image upload failed:', err);
                        alert('Image upload failed: ' + err.message);

                        // Clear the file input on failure
                        imageInput.value = '';
                        previewDiv.style.display = 'none';

                    } finally {
                        delete el.dataset.uploading;
                    }
                }
            } else {
                previewDiv.style.display = 'none';
                delete el.dataset.imageUploaded;
                delete el.dataset.existingImage;
            }

            // Update team data after upload is complete
            updateTeamData();
        });

        // Remove button handler
        el.querySelector('.remove-member').addEventListener('click', () => {
            if (confirm('Are you sure you want to remove this team member?')) {
                el.remove();
                updateTeamData();
            }
        });

        // Field change handlers
        el.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', updateTeamData);
            input.addEventListener('change', updateTeamData);
        });

        return el;
    }

    /**
     * Add a new team member card
     */
    function addTeamMember() {
        const card = createTeamMemberCard(teamMemberList.children.length);
        teamMemberList.appendChild(card);
        updateTeamData();

        // Scroll to the new card
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Focus on the name field
        const nameField = card.querySelector('.member-nameRole');
        if (nameField) {
            setTimeout(() => nameField.focus(), 100);
        }

        console.log('[Admin Dashboard] Added new team member card');
    }

    /**
     * Update team data JSON from current form state
     */
    function updateTeamData() {
        teamMembers = []; // Reset

        // Collect data from all team member forms
        const forms = teamMemberList.querySelectorAll('.team-member-form');
        forms.forEach(form => {
            const name = form.querySelector('.member-nameRole').value.trim();
            const bio = form.querySelector('.member-bio').value.trim();
            const quote = form.querySelector('.member-quote').value.trim();

            // Skip incomplete cards (require name and bio)
            if (!name || !bio) return;

            // Use existing uploaded image path (upload happens per-card)
            const imagePath = form.dataset.existingImage || '';

            teamMembers.push({
                name: name,
                bio: bio,
                quote: quote,
                image: imagePath
            });
        });

        // Update hidden field
        if (teamData) {
            teamData.value = JSON.stringify(teamMembers);
        }

        console.log('[Admin Dashboard] Team data updated:', teamMembers);
    }

    // Expose updateTeamData globally for form submission handler
    window.updateTeamData = updateTeamData;

    /**
     * Populate team builder with existing data (for editing)
     * @param {Array} existingTeam - Array of team member objects
     */
    window.populateTeamBuilder = function(existingTeam) {
        console.log('[Admin Dashboard] populateTeamBuilder called with:', existingTeam);

        if (!existingTeam || !Array.isArray(existingTeam)) {
            console.warn('[Admin Dashboard] Invalid team data provided to populateTeamBuilder:', existingTeam);
            return;
        }

        if (!teamMemberList) {
            console.error('[Admin Dashboard] teamMemberList element not found');
            return;
        }

        // Clear existing cards
        teamMemberList.innerHTML = '';
        teamMembers = [];

        // Create cards for each existing team member
        existingTeam.forEach((member, index) => {
            console.log(`[Admin Dashboard] Creating card for team member ${index + 1}:`, member);

            const card = createTeamMemberCard(index);

            // Pre-fill fields from the section data
            const nameField = card.querySelector('.member-nameRole');
            const bioField = card.querySelector('.member-bio');
            const quoteField = card.querySelector('.member-quote');

            if (nameField) nameField.value = member.name || '';
            if (bioField) bioField.value = member.bio || '';
            if (quoteField) quoteField.value = member.quote || '';

            console.log(`[Admin Dashboard] Populated fields for member ${index + 1}: name="${member.name}", bio="${member.bio}", quote="${member.quote}"`);

            // Handle existing image
            if (member.image) {
                // Remember and display the existing image
                card.dataset.imageUploaded = 'true';
                card.dataset.existingImage = member.image; // This prevents the image from being lost on update

                const previewDiv = card.querySelector('.image-preview');
                const previewImg = previewDiv.querySelector('img');

                if (previewImg) {
                    previewImg.src = member.image;
                    previewDiv.style.display = 'block';
                    console.log(`[Admin Dashboard] Set image for member ${index + 1}:`, member.image);
                }
            }

            teamMemberList.appendChild(card);
        });

        // Sync the populated data to the hidden input
        updateTeamData();

        console.log('[Admin Dashboard] Team builder populated with', existingTeam.length, 'members');
    }

    /**
     * Clear team builder (for form reset)
     */
    window.clearTeamBuilder = function() {
        teamMemberList.innerHTML = '';
        teamMembers = [];
        if (teamData) {
            teamData.value = '[]';
        }
        console.log('[Admin Dashboard] Team builder cleared');
    }

    // Wire up the add member button
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', addTeamMember);
    }

    // Layout switching logic
    if (sectionLayout) {
        sectionLayout.addEventListener('change', () => {
            const layoutValue = sectionLayout.value;
            const isTeam = layoutValue === 'team';
            const isList = layoutValue === 'list';
            const isTestimonial = layoutValue === 'testimonial';
            const isVideo = layoutValue === 'video';
            const isStandard = layoutValue === 'standard';

            console.log('[Admin Dashboard] Layout changed to:', layoutValue);

            // Show/hide builder sections
            if (teamBuilder) teamBuilder.style.display = isTeam ? 'block' : 'none';
            if (listBuilder) listBuilder.style.display = isList ? 'block' : 'none';
            if (testimonialBuilder) testimonialBuilder.style.display = isTestimonial ? 'block' : 'none';
            if (videoBuilder) videoBuilder.style.display = isVideo ? 'block' : 'none';
            if (standardOnlyFields) standardOnlyFields.style.display = isStandard ? 'block' : 'none';

            // Handle shared image field visibility
            if (sharedFields) {
                const imageField = sharedFields.querySelector('label');
                const imagePreview = document.getElementById('currentImagePreview');

                if (imageField && imageField.querySelector('input[name="image"]')) {
                    // Hide shared image field for team sections since images are handled per team member
                    imageField.style.display = isTeam ? 'none' : 'block';
                }

                if (imagePreview) {
                    // Hide image preview for team sections
                    if (isTeam) {
                        imagePreview.style.display = 'none';
                    }
                }
            }

            // Set required attributes for team fields
            const teamFields = teamMemberList.querySelectorAll('.member-nameRole, .member-bio');
            teamFields.forEach(el => {
                if (isTeam) {
                    el.setAttribute('required', '');
                } else {
                    el.removeAttribute('required');
                }
            });

            // Cleanup when switching away from specific layouts
            if (!isTeam) {
                if (typeof clearTeamBuilder === 'function') {
                    clearTeamBuilder();
                }
            }
            if (!isList) {
                if (typeof clearListBuilder === 'function') {
                    clearListBuilder();
                }
            }
            if (!isTestimonial) {
                if (typeof clearTestimonialBuilder === 'function') {
                    clearTestimonialBuilder();
                }
            }
            if (!isTestimonial) {
                // Clear testimonial builder (will be implemented later)
                const testimonialList = document.getElementById('testimonialList');
                const testimonialsData = document.getElementById('testimonialsData');
                if (testimonialList) testimonialList.innerHTML = '';
                if (testimonialsData) testimonialsData.value = '[]';
            }
        });
    }

    // List builder elements
    const addListItemBtn = document.getElementById('addListItemBtn');
    const listItemsList = document.getElementById('listItemsList');
    const listItemsData = document.getElementById('listItemsData');
    const listDescription = document.getElementById('listDescription');
    const listType = document.getElementById('listType');

    // Initialize list items array
    let listItems = [];

    /**
     * Create a list item form with text input and remove button
     * @returns {HTMLElement} The created list item element
     */
    function createListItemForm() {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'list-item-form';
        itemDiv.style.cssText = 'border:1px solid #ddd; padding:10px; margin:5px 0; border-radius:5px; background:#f9f9f9; display:flex; align-items:center; gap:10px;';

        itemDiv.innerHTML = `
            <input type="text" class="list-item-text form-control"
                   placeholder="Enter list item text..."
                   style="flex:1;" required>
            <button type="button" class="remove-list-item"
                    style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">
                🗑️ Remove
            </button>
        `;

        // Add remove functionality
        itemDiv.querySelector('.remove-list-item').addEventListener('click', () => {
            if (confirm('Remove this list item?')) {
                itemDiv.remove();
                updateListData();
            }
        });

        // Update data when text changes
        itemDiv.querySelector('.list-item-text').addEventListener('input', updateListData);
        itemDiv.querySelector('.list-item-text').addEventListener('change', updateListData);

        return itemDiv;
    }

    /**
     * Add a new list item form
     */
    function addListItem() {
        const itemForm = createListItemForm();
        listItemsList.appendChild(itemForm);
        updateListData();

        // Focus on the new input
        const textInput = itemForm.querySelector('.list-item-text');
        if (textInput) {
            setTimeout(() => textInput.focus(), 100);
        }

        console.log('[Admin Dashboard] Added new list item form');
    }

    /**
     * Update list data JSON from current form state
     */
    function updateListData() {
        listItems = []; // Reset

        // Collect data from all list item forms
        const forms = listItemsList.querySelectorAll('.list-item-form');
        forms.forEach(form => {
            const text = form.querySelector('.list-item-text').value.trim();
            if (text) {
                listItems.push(text);
            }
        });

        // Build complete list data structure
        const listData = {
            items: listItems,
            listType: listType ? listType.value || 'unordered' : 'unordered',
            description: listDescription ? listDescription.value.trim() : ''
        };

        // Update hidden field
        if (listItemsData) {
            listItemsData.value = JSON.stringify(listData);
        }

        console.log('[Admin Dashboard] List data updated:', listData);
    }

    /**
     * Populate list builder with existing data (for editing)
     * @param {Object} existingListData - List data object with items, listType, description
     */
    function populateListBuilder(existingListData) {
        if (!existingListData) return;

        // Clear existing items
        listItemsList.innerHTML = '';
        listItems = [];

        // Populate description and type
        if (listDescription) {
            listDescription.value = existingListData.description || '';
        }
        if (listType) {
            listType.value = existingListData.listType || 'unordered';
        }

        // Create forms for each existing item
        if (existingListData.items && Array.isArray(existingListData.items)) {
            existingListData.items.forEach(item => {
                const itemForm = createListItemForm();
                itemForm.querySelector('.list-item-text').value = item;
                listItemsList.appendChild(itemForm);
            });
        }

        // Sync the populated data
        updateListData();

        console.log('[Admin Dashboard] List builder populated with', existingListData.items?.length || 0, 'items');
    }

    /**
     * Clear list builder (for form reset)
     */
    function clearListBuilder() {
        listItemsList.innerHTML = '';
        listItems = [];
        if (listDescription) listDescription.value = '';
        if (listType) listType.value = 'unordered';
        if (listItemsData) listItemsData.value = JSON.stringify({ items: [], listType: 'unordered', description: '' });
        console.log('[Admin Dashboard] List builder cleared');
    }

    // Wire up the add list item button
    if (addListItemBtn) {
        addListItemBtn.addEventListener('click', addListItem);
    }

    // Wire up list description and type change handlers
    if (listDescription) {
        listDescription.addEventListener('input', updateListData);
        listDescription.addEventListener('change', updateListData);
    }
    if (listType) {
        listType.addEventListener('change', updateListData);
    }

    // Testimonial builder elements
    const addTestimonialBtn = document.getElementById('addTestimonialBtn');
    const testimonialList = document.getElementById('testimonialList');
    const testimonialsData = document.getElementById('testimonialsData');

    // Initialize testimonials array
    let testimonials = [];

    /**
     * Create a testimonial form with quote, author, role, company, and rating fields
     * @returns {HTMLElement} The created testimonial element
     */
    function createTestimonialForm() {
        const testimonialDiv = document.createElement('div');
        testimonialDiv.className = 'testimonial-form';
        testimonialDiv.style.cssText = 'border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:5px; background:#f9f9f9;';

        const testimonialIndex = testimonials.length;
        testimonialDiv.innerHTML = `
            <h4 style="margin-top: 0; color: #4a90e2;">Testimonial ${testimonialIndex + 1}</h4>

            <label>Quote:
                <textarea class="testimonial-quote" rows="3"
                          placeholder="Enter testimonial quote..."
                          style="width: 100%; margin-bottom: 10px;" required></textarea>
            </label>

            <label>Author:
                <input type="text" class="testimonial-author"
                       placeholder="Author name"
                       style="width: 100%; margin-bottom: 10px;" required>
            </label>

            <label>Role (optional):
                <input type="text" class="testimonial-role"
                       placeholder="e.g., Parent, Student"
                       style="width: 100%; margin-bottom: 10px;">
            </label>

            <label>Company/Location (optional):
                <input type="text" class="testimonial-company"
                       placeholder="e.g., Edinburgh, Glasgow"
                       style="width: 100%; margin-bottom: 10px;">
            </label>

            <label>Rating (optional):
                <select class="testimonial-rating"
                        style="width: 100%; margin-bottom: 10px;">
                    <option value="">No rating</option>
                    <option value="5">⭐⭐⭐⭐⭐ (5 stars)</option>
                    <option value="4">⭐⭐⭐⭐ (4 stars)</option>
                    <option value="3">⭐⭐⭐ (3 stars)</option>
                    <option value="2">⭐⭐ (2 stars)</option>
                    <option value="1">⭐ (1 star)</option>
                </select>
            </label>

            <button type="button" class="remove-testimonial"
                    style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; float: right;">
                🗑️ Remove Testimonial
            </button>
            <div style="clear: both;"></div>
        `;

        // Add event listeners for real-time updates
        const inputs = testimonialDiv.querySelectorAll('textarea, input, select');
        inputs.forEach(input => {
            input.addEventListener('input', updateTestimonialData);
            input.addEventListener('change', updateTestimonialData);
        });

        // Add remove functionality
        testimonialDiv.querySelector('.remove-testimonial').addEventListener('click', () => {
            if (confirm('Are you sure you want to remove this testimonial?')) {
                testimonialDiv.remove();
                updateTestimonialData();
            }
        });

        return testimonialDiv;
    }

    /**
     * Add a new testimonial form
     */
    function addTestimonial() {
        const testimonialForm = createTestimonialForm();
        testimonialList.appendChild(testimonialForm);

        // Add placeholder to testimonials array
        testimonials.push({
            quote: '',
            author: '',
            role: '',
            company: '',
            rating: ''
        });

        updateTestimonialData();

        // Scroll to the new testimonial and focus on quote field
        testimonialForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const quoteField = testimonialForm.querySelector('.testimonial-quote');
        if (quoteField) {
            setTimeout(() => quoteField.focus(), 100);
        }

        console.log('[Admin Dashboard] Added new testimonial form');
    }

    /**
     * Update testimonial data JSON from current form state
     */
    function updateTestimonialData() {
        testimonials = []; // Reset

        // Collect data from all testimonial forms
        testimonialList.querySelectorAll('.testimonial-form').forEach(div => {
            const quote = div.querySelector('.testimonial-quote')?.value.trim() || '';
            const author = div.querySelector('.testimonial-author')?.value.trim() || '';
            const role = div.querySelector('.testimonial-role')?.value.trim() || '';
            const company = div.querySelector('.testimonial-company')?.value.trim() || '';
            const rating = div.querySelector('.testimonial-rating')?.value || '';

            // Only include testimonials with both quote and author
            if (quote && author) {
                testimonials.push({ quote, author, role, company, rating });
            }
        });

        // Update hidden field
        if (testimonialsData) {
            testimonialsData.value = JSON.stringify(testimonials);
        }

        console.log('[Admin Dashboard] Testimonial data updated:', testimonials);
    }

    /**
     * Populate testimonial builder with existing data (for editing)
     * @param {Array} existingTestimonials - Array of testimonial objects
     */
    function populateTestimonialBuilder(existingTestimonials) {
        if (!existingTestimonials || !Array.isArray(existingTestimonials)) return;

        // Clear existing testimonials
        testimonialList.innerHTML = '';
        testimonials = [];

        // Create forms for each existing testimonial
        existingTestimonials.forEach(testimonial => {
            const testimonialForm = createTestimonialForm();

            // Pre-fill fields from the section data
            testimonialForm.querySelector('.testimonial-quote').value = testimonial.quote || '';
            testimonialForm.querySelector('.testimonial-author').value = testimonial.author || '';
            testimonialForm.querySelector('.testimonial-role').value = testimonial.role || '';
            testimonialForm.querySelector('.testimonial-company').value = testimonial.company || '';
            testimonialForm.querySelector('.testimonial-rating').value = testimonial.rating || '';

            testimonialList.appendChild(testimonialForm);
        });

        // If no testimonials exist, add one empty form
        if (existingTestimonials.length === 0) {
            addTestimonial();
        }

        // Sync the populated data
        updateTestimonialData();

        console.log('[Admin Dashboard] Testimonial builder populated with', existingTestimonials.length, 'testimonials');
    }

    /**
     * Clear testimonial builder (for form reset)
     */
    function clearTestimonialBuilder() {
        testimonialList.innerHTML = '';
        testimonials = [];
        if (testimonialsData) {
            testimonialsData.value = '[]';
        }
        console.log('[Admin Dashboard] Testimonial builder cleared');
    }

    // Wire up the add testimonial button
    if (addTestimonialBtn) {
        addTestimonialBtn.addEventListener('click', addTestimonial);
    }

    // Rolling Banner Special Handling
    initRollingBannerHandling();

    console.log('[Admin Dashboard] Advanced section builders initialized');
}

/**
 * Initialize rolling banner special handling
 */
function initRollingBannerHandling() {
    const pageSelect = document.getElementById('pageSelect');
    const sectionForm = document.getElementById('addSection');
    const metaControls = document.getElementById('metaControls');
    const rollingBannerFields = document.getElementById('rollingBannerFields');
    const standardOnlyFields = document.getElementById('standardOnlyFields');

    if (!pageSelect || !sectionForm) {
        console.log('[Admin Dashboard] Rolling banner elements not found, skipping init');
        return;
    }

    // Note: Rolling banner field toggling is now handled by the main toggleLayoutFields() function
    // in initSectionManagement() to avoid conflicts and ensure consistent behavior

    /**
     * Refresh rolling banner content immediately after updates
     */
    async function refreshRollingBanner() {
        try {
            const response = await fetch('/api/sections?page=rolling-banner');
            if (!response.ok) throw new Error('Failed to fetch rolling banner content');

            const sections = await response.json();
            const tutorBanner = document.getElementById('tutorBanner');

            if (tutorBanner && sections && sections.length > 0) {
                const text = sections.map(s => s.text).join(' | ');
                tutorBanner.textContent = text;
                console.log('[Admin Dashboard] Rolling banner refreshed with', sections.length, 'items');
            }
        } catch (error) {
            console.error('[Admin Dashboard] Failed to refresh rolling banner:', error);
        }
    }

    // Note: Page selection change handler is already set up in initSectionManagement()
    // which calls toggleLayoutFields() that now includes rolling banner logic

    // Export refresh function for use after form submissions
    window.refreshRollingBanner = refreshRollingBanner;

    console.log('[Admin Dashboard] Rolling banner special handling initialized');
}

/**
 * Initialize video management system
 */
function initVideoManagement() {
    const browseVideosBtn = document.getElementById('browseVideosBtn');
    const videoBrowser = document.getElementById('videoBrowser');
    const videoLoadingMsg = document.getElementById('videoLoadingMsg');
    const videoCategories = document.getElementById('videoCategories');
    const staticVideosList = document.getElementById('staticVideosList');
    const blobVideosList = document.getElementById('blobVideosList');
    const googleCloudVideosList = document.getElementById('googleCloudVideosList');
    const noVideosMsg = document.getElementById('noVideosMsg');
    const videoUrlInput = document.getElementById('videoUrl');

    if (!browseVideosBtn || !videoBrowser) {
        console.log('[Admin Dashboard] Video management elements not found, skipping init');
        return;
    }

    let availableVideos = {
        staticVideos: [],
        blobVideos: [],
        googleCloudVideos: []
    };

    /**
     * Toggle video browser visibility and load videos
     */
    browseVideosBtn.addEventListener('click', async () => {
        if (videoBrowser.style.display === 'none' || !videoBrowser.style.display) {
            await loadAvailableVideos();
            videoBrowser.style.display = 'block';
            browseVideosBtn.textContent = '📹 Hide Video Browser';
        } else {
            videoBrowser.style.display = 'none';
            browseVideosBtn.textContent = '📹 Browse Available Videos';
        }
    });

    /**
     * Load available videos from the API
     */
    async function loadAvailableVideos() {
        try {
            if (videoLoadingMsg) videoLoadingMsg.style.display = 'block';
            if (videoCategories) videoCategories.style.display = 'none';
            if (noVideosMsg) noVideosMsg.style.display = 'none';

            const response = await fetch('/api/video-sections?operation=list-videos');
            if (!response.ok) {
                throw new Error(`Failed to load videos: ${response.status}`);
            }

            availableVideos = await response.json();
            displayAvailableVideos();

        } catch (error) {
            console.error('[Admin Dashboard] Error loading videos:', error);
            if (videoLoadingMsg) {
                videoLoadingMsg.innerHTML = `<span style="color: red;">Error loading videos: ${error.message}</span>`;
            }
        }
    }

    /**
     * Display available videos in categorized sections
     */
    function displayAvailableVideos() {
        if (videoLoadingMsg) videoLoadingMsg.style.display = 'none';

        // Ensure we have all video arrays
        availableVideos.staticVideos = availableVideos.staticVideos || [];
        availableVideos.blobVideos = availableVideos.blobVideos || [];
        availableVideos.googleCloudVideos = availableVideos.googleCloudVideos || [];

        const totalVideos = availableVideos.staticVideos.length +
                           availableVideos.blobVideos.length +
                           availableVideos.googleCloudVideos.length;

        if (totalVideos === 0) {
            if (noVideosMsg) noVideosMsg.style.display = 'block';
            return;
        }

        if (videoCategories) videoCategories.style.display = 'block';

        // Display static videos
        if (availableVideos.staticVideos.length > 0) {
            const staticSection = document.getElementById('staticVideosSection');
            if (staticSection) staticSection.style.display = 'block';
            if (staticVideosList) {
                staticVideosList.innerHTML = '';
                availableVideos.staticVideos.forEach(video => {
                    const videoItem = createVideoItem(video);
                    staticVideosList.appendChild(videoItem);
                });
            }
        } else {
            const staticSection = document.getElementById('staticVideosSection');
            if (staticSection) staticSection.style.display = 'none';
        }

        // Display blob videos
        if (availableVideos.blobVideos.length > 0) {
            const blobSection = document.getElementById('blobVideosSection');
            if (blobSection) blobSection.style.display = 'block';
            if (blobVideosList) {
                blobVideosList.innerHTML = '';
                availableVideos.blobVideos.forEach(video => {
                    const videoItem = createVideoItem(video);
                    blobVideosList.appendChild(videoItem);
                });
            }
        } else {
            const blobSection = document.getElementById('blobVideosSection');
            if (blobSection) blobSection.style.display = 'none';
        }

        // Display Google Cloud videos or show permissions message
        const googleCloudSection = document.getElementById('googleCloudVideosSection');
        if (availableVideos.googleCloudVideos.length > 0) {
            if (googleCloudSection) googleCloudSection.style.display = 'block';
            if (googleCloudVideosList) {
                googleCloudVideosList.innerHTML = '';
                availableVideos.googleCloudVideos.forEach(video => {
                    const videoItem = createVideoItem(video);
                    googleCloudVideosList.appendChild(videoItem);
                });
            }
        } else {
            // Show helpful message about Google Cloud permissions
            if (googleCloudVideosList) {
                googleCloudVideosList.innerHTML = `
                    <div style="padding: 1rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; color: #856404; text-align: center; margin: 0.5rem 0;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #856404;">🔒 Google Cloud Videos Not Listed</h5>
                        <p style="margin: 0; font-size: 0.9em;">
                            Videos uploaded to Google Cloud cannot be listed due to service account permissions.<br>
                            <strong>Solution:</strong> Add "Storage Object Viewer" role to your service account in Google Cloud Console.
                        </p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.8em; opacity: 0.8;">
                            You can still upload large videos - they'll be stored in Google Cloud and work on your website.
                        </p>
                    </div>
                `;
            }
        }
    }

    /**
     * Create a video item element for the browser
     * @param {Object} video - Video object with url, name, size, type, etc.
     * @returns {HTMLElement} The created video item element
     */
    function createVideoItem(video) {
        const item = document.createElement('div');
        item.className = 'video-item';
        item.style.cssText = 'border: 2px solid transparent; border-radius: 8px; padding: 0.5rem; cursor: pointer; transition: all 0.2s ease; background: white;';

        // Format file size and date
        const sizeText = video.size ? formatFileSize(video.size) : '';
        const dateText = video.lastModified ? new Date(video.lastModified).toLocaleDateString() : '';

        // Handle different video types for thumbnail generation
        let videoPreviewHTML;
        if (video.type === 'google-cloud') {
            // Google Cloud videos - use placeholder with fallback
            const placeholderId = `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            videoPreviewHTML = `
                <div class="video-thumbnail-container" style="position: relative; height: 120px;">
                    <video preload="metadata" muted crossorigin="anonymous"
                           style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;"
                           onloadedmetadata="this.style.display='block'; this.nextElementSibling.style.display='none';"
                           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <source src="${video.url}" type="video/${getVideoType(video.name)}">
                    </video>
                    <div id="${placeholderId}" class="video-placeholder google-cloud-placeholder"
                         style="position: absolute; top: 0; left: 0; width: 100%; height: 120px;
                                background: linear-gradient(135deg, #ff6b35, #f7931e); display: flex;
                                flex-direction: column; align-items: center; justify-content: center;
                                color: white; border-radius: 8px;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">☁️</div>
                        <div style="font-size: 0.9rem; font-weight: 500;">Google Cloud Video</div>
                        <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 0.25rem; text-align: center; padding: 0 0.5rem;">
                            ${video.name.length > 20 ? video.name.substring(0, 20) + '...' : video.name}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Static and blob videos - use standard video element for thumbnails
            videoPreviewHTML = `
                <video preload="metadata" muted crossorigin="anonymous"
                       style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;">
                    <source src="${video.url}" type="video/${getVideoType(video.name)}">
                    <div style="height: 120px; background: #f0f0f0; display: flex; align-items: center;
                                justify-content: center; color: #666; border-radius: 8px;">
                        📹 Video Preview
                    </div>
                </video>
            `;
        }

        item.innerHTML = `
            ${videoPreviewHTML}
            <div class="video-item-name" style="font-weight: 500; margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; line-height: 1.2;">${video.name}</div>
            <div class="video-item-info" style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                ${sizeText}${sizeText && dateText ? ' • ' : ''}${dateText}
            </div>
            <span class="video-type-badge video-type-${video.type === 'google-cloud' ? 'googleCloud' : video.type}"
                  style="display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500;
                         background: ${video.type === 'static' ? '#e3f2fd' : video.type === 'google-cloud' ? '#fff3e0' : '#e8f5e8'};
                         color: ${video.type === 'static' ? '#1976d2' : video.type === 'google-cloud' ? '#f57c00' : '#388e3c'};">
                ${video.type === 'static' ? '🏠 Static' : video.type === 'google-cloud' ? '☁️ Google Cloud' : '📦 Blob'}
            </span>
        `;

        // Add hover effects
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = '#4a90e2';
            item.style.backgroundColor = '#f8f9fa';
        });

        item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('selected')) {
                item.style.borderColor = 'transparent';
                item.style.backgroundColor = 'white';
            }
        });

        // Add click handler for video selection
        item.addEventListener('click', () => {
            // Remove selection from other items
            document.querySelectorAll('.video-item').forEach(i => {
                i.classList.remove('selected');
                i.style.borderColor = 'transparent';
                i.style.backgroundColor = 'white';
            });

            // Select this item
            item.classList.add('selected');
            item.style.borderColor = '#28a745';
            item.style.backgroundColor = '#f8fff9';

            // Set video URL
            if (videoUrlInput) {
                videoUrlInput.value = video.url;
            }

            // Auto-populate heading if empty
            const sectionForm = document.getElementById('addSection');
            if (sectionForm) {
                const headingInput = sectionForm.querySelector('[name="heading"]');
                if (headingInput && !headingInput.value.trim()) {
                    // Use video filename without extension as default heading
                    const videoName = video.name.replace(/\.[^/.]+$/, "");
                    headingInput.value = videoName;
                }
            }

            // Hide the browser after selection
            videoBrowser.style.display = 'none';
            browseVideosBtn.textContent = '📹 Browse Available Videos';

            console.log('[Admin Dashboard] Video selected:', video.name);
        });

        return item;
    }

    /**
     * Get video MIME type from filename
     * @param {string} filename - Video filename
     * @returns {string} Video MIME type
     */
    function getVideoType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ext === 'webm' ? 'webm' : ext === 'ogg' ? 'ogg' : 'mp4';
    }

    /**
     * Format file size in human readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    console.log('[Admin Dashboard] Video management initialized');
}

/**
 * Initialize URL parameter handling for deep linking
 */
function initURLParameterHandling() {
    const params = new URLSearchParams(location.search);
    const slugParam = params.get('slug');
    const editSectionParam = params.get('editSection');
    const addAfterParam = params.get('addAfter');
    const editPageParam = params.get('editPage');

    console.log('[Admin Dashboard] URL parameters:', { slugParam, editSectionParam, addAfterParam, editPageParam });

    // Handle slug parameter - preselect page
    if (slugParam) {
        const pageSelect = document.getElementById('pageSelect');
        if (pageSelect && PAGES && PAGES.includes(slugParam)) {
            pageSelect.value = slugParam;
            pageSelect.dispatchEvent(new Event('change'));
            console.log('[Admin Dashboard] Page preselected from URL:', slugParam);
        }
    }

    // Update view page link styling when coming from visual editor
    const viewPageLink = document.getElementById('viewPageLink');
    if (viewPageLink && (editSectionParam || addAfterParam || editPageParam)) {
        viewPageLink.textContent = '↩ Return to Page';
        viewPageLink.style.background = '#e3f2fd';
        viewPageLink.style.padding = '6px 12px';
        viewPageLink.style.borderRadius = '4px';
        viewPageLink.style.border = '1px solid #2196f3';
        viewPageLink.style.textDecoration = 'none';
        viewPageLink.style.color = '#1976d2';
        viewPageLink.style.fontWeight = '500';
    }

    /**
     * Handle auto-edit section functionality
     */
    function handleAutoEditSection() {
        if (!editSectionParam) return;

        console.log('[Admin Dashboard] Auto-editing section:', editSectionParam);

        // Wait for sections to be loaded, then find and edit the section
        setTimeout(() => {
            const editBtn = document.querySelector(`button.edit-section[data-id="${editSectionParam}"]`);
            if (editBtn) {
                editBtn.click();
                console.log('[Admin Dashboard] Auto-clicked edit button for section:', editSectionParam);
            } else {
                console.warn('[Admin Dashboard] Section not found for auto-edit:', editSectionParam);
                // Try to find section in current sections array
                if (typeof currentSections !== 'undefined' && currentSections) {
                    const section = currentSections.find(s => s._id === editSectionParam);
                    if (section) {
                        // Manually trigger edit mode
                        if (typeof populateSectionForm === 'function') {
                            populateSectionForm(section);
                        }
                    }
                }
            }
        }, 500); // Give time for sections to load
    }

    /**
     * Handle auto-add-after functionality
     */
    function handleAutoAddAfter() {
        if (!addAfterParam) return;

        console.log('[Admin Dashboard] Pre-configuring new section after:', addAfterParam);

        // Wait for sections to be loaded, then configure position
        setTimeout(() => {
            if (typeof currentSections !== 'undefined' && currentSections) {
                const afterSection = currentSections.find(s => s._id === addAfterParam);
                if (afterSection) {
                    // Set the position based on the after section's position
                    const positionSelect = document.querySelector('[name="position"]');
                    if (positionSelect && afterSection.position) {
                        positionSelect.value = afterSection.position;
                    }

                    // Focus on the heading field to start adding
                    setTimeout(() => {
                        const headingField = document.querySelector('[name="heading"]');
                        if (headingField) {
                            headingField.focus();
                            headingField.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 100);

                    console.log('[Admin Dashboard] New section configured to be added after:', afterSection.heading);
                } else {
                    console.warn('[Admin Dashboard] After section not found:', addAfterParam);
                }
            }
        }, 500);
    }

    /**
     * Handle auto-edit page functionality
     */
    function handleAutoEditPage() {
        if (!editPageParam) return;

        console.log('[Admin Dashboard] Auto-editing page:', editPageParam);

        // Switch to pages tab and edit the specified page
        setTimeout(() => {
            // Switch to pages tab
            const pagesTab = document.querySelector('.tab-button[data-tab="pages"]');
            if (pagesTab) {
                pagesTab.click();
            }

            // Wait a bit more for pages to load, then find and edit the page
            setTimeout(() => {
                const editBtn = document.querySelector(`button.edit-page[data-id="${editPageParam}"]`);
                if (editBtn) {
                    editBtn.click();
                    console.log('[Admin Dashboard] Auto-clicked edit button for page:', editPageParam);
                } else {
                    console.warn('[Admin Dashboard] Page not found for auto-edit:', editPageParam);
                    // Scroll to page form as fallback
                    const pageForm = document.getElementById('pageForm');
                    if (pageForm) {
                        pageForm.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }, 300);
        }, 200);
    }

    // Execute URL parameter handlers after a delay to ensure everything is loaded
    setTimeout(() => {
        handleAutoEditSection();
        handleAutoAddAfter();
        handleAutoEditPage();
    }, 1000);

    console.log('[Admin Dashboard] URL parameter handling initialized');
}

/**
 * Utility function to show loading state
 * @param {HTMLElement} element - Element to show loading state on
 * @param {boolean} isLoading - Whether to show or hide loading state
 */
function setLoadingState(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText || element.textContent;
    }
}

/**
 * Utility function to validate form data
 * @param {FormData} formData - Form data to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid boolean and errors array
 */
function validateFormData(formData, requiredFields) {
    const errors = [];
    
    requiredFields.forEach(field => {
        const value = formData.get(field);
        if (!value || value.trim() === '') {
            errors.push(`${field} is required`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Export functions for potential use by other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initTabSwitching,
        initPageDropdowns,
        initSectionManagement,
        initTutorManagement,
        initPageManagement,
        initAdvancedSectionBuilders,
        setLoadingState,
        validateFormData
    };
} else if (typeof window !== 'undefined') {
    window.AdminDashboard = {
        initTabSwitching,
        initPageDropdowns,
        initSectionManagement,
        initTutorManagement,
        initPageManagement,
        initAdvancedSectionBuilders,
        setLoadingState,
        validateFormData
    };
}
