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
    if (!sectionForm) return;
    
    // Handle section form submission
    sectionForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(this);
            const response = await fetch('/api/sections', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
            
            const result = await response.json();
            alert('Section saved successfully!');
            
            // Reset form
            this.reset();
            
            // Refresh any section lists if they exist
            if (typeof loadSections === 'function') {
                loadSections();
            }
            
        } catch (error) {
            console.error('[Admin Dashboard] Section save error:', error);
            alert('Error saving section: ' + error.message);
        }
    });
    
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
        setLoadingState,
        validateFormData
    };
} else if (typeof window !== 'undefined') {
    window.AdminDashboard = {
        initTabSwitching,
        initPageDropdowns,
        initSectionManagement,
        initTutorManagement,
        setLoadingState,
        validateFormData
    };
}
