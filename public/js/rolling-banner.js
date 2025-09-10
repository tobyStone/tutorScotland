/**
 * @fileoverview Rolling banner functionality for news and tutor information
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Rolling banner system:
 * - Initializes rolling banner on all pages
 * - Fetches news content from sections API
 * - Falls back to tutor information if no news available
 * - Integrates with responsive-helper.js for animation
 *
 * @requires responsive-helper.js for initRollingBanner function
 * @performance Implements efficient content fetching and animation
 */
document.addEventListener('DOMContentLoaded', function() {
    // Check if responsive-helper.js is loaded and initRollingBanner function exists
    if (typeof initRollingBanner === 'function') {
        // Initialize the rolling banner
        initRollingBanner();
    } else {
        console.error('initRollingBanner function not found. Make sure responsive-helper.js is loaded before this script.');
        
        // Fallback implementation if responsive-helper.js is not loaded
        const rollingBanner = document.querySelector('.rolling-banner');
        const rollingContent = document.querySelector('.rolling-content');
        
        if (rollingBanner && rollingContent) {
            // If the banner doesn't have content yet, add a loading message and fetch news
            if (!rollingContent.textContent.trim() || rollingContent.textContent === 'Loading news...') {
                rollingContent.textContent = 'Loading news...';
                
                // First try to fetch news from sections API
                fetch('/api/sections?page=rolling-banner')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(sections => {
                        if (sections && sections.length > 0) {
                            // Format news information - join all text content with separator
                            const text = sections.map(s => s.text).join(' | ');
                            rollingContent.textContent = text;
                        } else {
                            // Fallback to tutors if no news sections are found
                            return fetch('/api/tutors?format=json')
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error('Network response was not ok');
                                    }
                                    return response.json();
                                })
                                .then(tutors => {
                                    if (tutors && tutors.length > 0) {
                                        // Format tutor information
                                        const text = tutors.map(t => `${t.name} (${t.subjects.join(', ')})`).join(' | ');
                                        rollingContent.textContent = text;
                                    } else {
                                        rollingContent.textContent = 'Welcome to Tutors Alliance Scotland';
                                    }
                                });
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching news:', error);
                        rollingContent.textContent = 'Welcome to Tutors Alliance Scotland';
                    });
            }
        }
    }
});
