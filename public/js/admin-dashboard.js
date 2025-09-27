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
try {
    // Try to import the upload helper
    import('/js/upload-helper.js').then(module => {
        uploadImage = module.uploadImage;
        console.log('[Admin Dashboard] Upload helper loaded');
    }).catch(err => {
        console.warn('[Admin Dashboard] Upload helper not available:', err);
    });
} catch (err) {
    console.warn('[Admin Dashboard] Could not load upload helper:', err);
}

// Wait for DOM and required modules to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Admin Dashboard] Initializing...');
    
    // Initialize all dashboard functionality
    initTabSwitching();
    initPageDropdowns();
    initSectionManagement();
    initTutorManagement();
    initPageManagement();

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
            option.textContent = page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, ' ');
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

    // Store all sections for editing
    let allSections = [];

    // Helper: Reset form to create mode but keep page selection
    function resetSectionForm() {
        const currentPage = pageSelect.value; // Remember current page
        sectionForm.reset(); // Native reset (clears all fields including selects)
        pageSelect.value = currentPage; // Restore page selection

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
            headingCell.textContent = section.heading || section.rollingText || 'No heading';
            headingCell.style.maxWidth = '200px';
            headingCell.style.overflow = 'hidden';
            headingCell.style.textOverflow = 'ellipsis';
            row.appendChild(headingCell);

            // Layout
            const layoutCell = document.createElement('td');
            layoutCell.textContent = section.layout || 'standard';
            row.appendChild(layoutCell);

            // Position
            const positionCell = document.createElement('td');
            positionCell.textContent = section.position || 'bottom';
            row.appendChild(positionCell);

            // Image indicator
            const imageCell = document.createElement('td');
            imageCell.textContent = section.imagePath ? '✅' : '❌';
            row.appendChild(imageCell);

            // Button indicator
            const buttonCell = document.createElement('td');
            buttonCell.textContent = (section.buttonLabel && section.buttonUrl) ? '✅' : '❌';
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

                // For rolling banner, convert rollingText to text field and clean up form data
                formData.set('text', rollingText);
                formData.set('page', 'rolling-banner');

                // Remove fields we don't want for banner sections
                ['layout', 'showInNav', 'navCategory', 'imagePath',
                 'buttonLabel', 'buttonUrl', 'position', 'team', 'rollingText'].forEach(key => {
                    formData.delete(key);
                });

                console.log('[Admin Dashboard] Processing rolling banner section');
            }

            const layout = formData.get('layout') || 'standard';

            // Determine the correct API endpoint
            let apiUrl;
            let method = isEditing ? 'PUT' : 'POST';

            // For rolling-banner, always use /api/sections regardless of layout
            if (isRollingBanner) {
                apiUrl = isEditing ? `/api/sections?id=${sectionId}` : '/api/sections';
            } else if (layout === 'video') {
                apiUrl = isEditing ? `/api/video-sections?id=${sectionId}` : '/api/video-sections';
            } else {
                apiUrl = isEditing ? `/api/sections?id=${sectionId}` : '/api/sections';
            }

            // Add editId for PUT requests
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
            }

            // Clear rolling text field for regular sections
            const rollingTextField = sectionForm.querySelector('[name="rollingText"]');
            if (rollingTextField) rollingTextField.value = '';
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
        if (section.imagePath && currentImagePreview) {
            currentImagePreview.style.display = 'block';
            const img = currentImagePreview.querySelector('img');
            if (img) img.src = section.imagePath;
        }

        // Show remove button option if button exists
        if ((section.buttonLabel && section.buttonUrl) && removeButtonRow) {
            removeButtonRow.style.display = 'block';
        }

        // Show move page option (except for rolling banner)
        if (movePageRow && movePageSelect && section.layout !== 'rolling-banner') {
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
    }

    // Helper: Populate form for editing
    function populateTutorForm(tutor) {
        tutorForm.name.value = tutor.name || '';
        tutorForm.subjects.value = (tutor.subjects || []).join(', ');
        // Convert __P__ back to £ for display in the form
        tutorForm.costRange.value = (tutor.costRange || '').replace(/__P__/g, '£');
        tutorForm.badges.value = (tutor.badges || []).join(', ');
        tutorForm.contact.value = tutor.contact || '';
        tutorForm.description.value = tutor.description || '';

        const regionsSel = document.getElementById('regionsSelect');
        const regions = (tutor.regions || []);
        if (regionsSel) {
            Array.from(regionsSel.options).forEach(opt => {
                opt.selected = regions.includes(opt.value);
            });
        }

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
                        body: uploadFormData
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

        const payload = {
            name: fd.get('name').trim(),
            subjects: csv(fd.get('subjects')),
            costRange: costRange,
            badges: csv(fd.get('badges')),
            contact: fd.get('contact').trim(),
            description: fd.get('description').trim(),
            regions: Array.from(document.getElementById('regionsSelect').selectedOptions).map(opt => opt.value),
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

                const toggleButton = document.createElement('button');
                toggleButton.innerHTML = page.isPublished ? '📴' : '📢';
                toggleButton.title = page.isPublished ? 'Unpublish Page' : 'Publish Page';
                toggleButton.className = 'toggle-page';
                toggleButton.dataset.id = page._id;
                toggleButton.dataset.pub = page.isPublished.toString();
                actionsCell.appendChild(toggleButton);

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
                    // Use upload helper if available
                    if (typeof uploadImage === 'function') {
                        const imageUrl = await uploadImage(imageFile, 'pages');
                        formData.set('imagePath', imageUrl);
                    } else {
                        // Fallback upload method
                        const uploadFormData = new FormData();
                        uploadFormData.append('file', imageFile);
                        uploadFormData.append('folder', 'pages');
                        const uploadResponse = await fetch('/api/upload-image', {
                            method: 'POST',
                            body: uploadFormData
                        });
                        if (!uploadResponse.ok) throw new Error('Image upload failed');
                        const uploadResult = await uploadResponse.json();
                        formData.set('imagePath', uploadResult.url);
                    }
                } catch (uploadError) {
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

            } else if (button.classList.contains('toggle-page')) {
                // Toggle publish status
                const currentStatus = button.dataset.pub === 'true';
                const newStatus = !currentStatus;

                if (!confirm(`${newStatus ? 'Publish' : 'Unpublish'} this page?`)) {
                    return;
                }

                try {
                    const formData = new FormData();
                    formData.append('editId', pageId);
                    formData.append('isPublished', newStatus.toString());
                    formData.append('isFullPage', 'true');

                    const response = await fetch('/api/sections', {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'
                    });

                    if (response.ok) {
                        alert(`Page ${newStatus ? 'published' : 'unpublished'} successfully!`);
                        loadPages(); // Refresh the pages list
                    } else {
                        const error = await response.text();
                        alert(`Failed to ${newStatus ? 'publish' : 'unpublish'} page: ${error}`);
                    }
                } catch (error) {
                    console.error('[Admin Dashboard] Error toggling page status:', error);
                    alert('An error occurred while updating the page status.');
                }

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
        setLoadingState,
        validateFormData
    };
}
