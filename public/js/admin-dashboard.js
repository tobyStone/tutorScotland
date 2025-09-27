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
 */

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
    const tutorForm = document.getElementById('addTutor');
    if (!tutorForm) {
        console.log('[Admin Dashboard] Tutor form not found, skipping tutor management init');
        return;
    }
    
    // Handle tutor form submission
    tutorForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(this);
            const response = await fetch('/api/tutors', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
            
            const result = await response.json();
            alert('Tutor saved successfully!');
            
            // Reset form
            this.reset();
            
            // Refresh tutor list if function exists
            if (typeof loadTutors === 'function') {
                loadTutors();
            }
            
        } catch (error) {
            console.error('[Admin Dashboard] Tutor save error:', error);
            alert('Error saving tutor: ' + error.message);
        }
    });
    
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
