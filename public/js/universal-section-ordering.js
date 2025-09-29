/**
 * @fileoverview Universal Section Ordering System
 * @description Applies saved section ordering for all visitors (admin and non-admin)
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2025-09-29
 * 
 * This system ensures that section reordering set by admins is applied to all visitors,
 * not just when the visual editor is loaded.
 */

class UniversalSectionOrdering {
    constructor() {
        this.currentPage = this.getCurrentPageSlug();
        this.isInitialized = false;

        // Define sections that should never be moved (pinned to their positions)
        this.pinnedSections = {
            'index': ['landing'], // Landing section must always be first on index page
            // Add other pages and their pinned sections as needed
        };
    }

    /**
     * Get the current page slug for API calls
     * @returns {string} Page slug
     */
    getCurrentPageSlug() {
        const rawPath = location.pathname.replace(/\/$/, '');
        return (document.body.dataset.page ||
                (rawPath ? rawPath.split('/').pop().replace(/\.html?$/, '') : 'index')
               ).toLowerCase();
    }

    /**
     * Initialize section ordering for the current page
     */
    async init() {
        if (this.isInitialized) {
            console.log('🔄 Universal section ordering already initialized');
            return;
        }

        try {
            console.log(`🔄 Loading universal section ordering for page: ${this.currentPage}`);
            
            // Wait for dynamic sections to be loaded first
            await this.waitForDynamicSections();
            
            // Load and apply section ordering
            await this.loadAndApplyOrder();
            
            this.isInitialized = true;
            console.log('✅ Universal section ordering initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize universal section ordering:', error);
            // Don't throw - section ordering failure shouldn't break the page
        }
    }

    /**
     * Wait for dynamic sections to be loaded
     * @returns {Promise} Resolves when dynamic sections are ready
     */
    waitForDynamicSections() {
        return new Promise((resolve) => {
            // Check if dynamic sections are already loaded
            if (document.querySelector('[data-ve-section-id]') || 
                document.body.classList.contains('dyn-sections-loaded')) {
                console.log('🔄 Dynamic sections already loaded');
                resolve();
                return;
            }

            // Listen for the dynamic sections loaded event
            const handleDynamicSectionsLoaded = () => {
                console.log('🔄 Dynamic sections loaded event received');
                document.removeEventListener('dyn-sections-loaded', handleDynamicSectionsLoaded);
                resolve();
            };

            document.addEventListener('dyn-sections-loaded', handleDynamicSectionsLoaded);

            // Fallback timeout in case the event doesn't fire
            setTimeout(() => {
                console.log('🔄 Dynamic sections timeout - proceeding anyway');
                document.removeEventListener('dyn-sections-loaded', handleDynamicSectionsLoaded);
                resolve();
            }, 3000);
        });
    }

    /**
     * Load section order from API and apply it
     */
    async loadAndApplyOrder() {
        try {
            console.log(`🔄 Fetching section order for page: ${this.currentPage}`);
            
            const response = await fetch(`/api/content-manager?operation=get-order&page=${this.currentPage}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            console.log(`🔍 Section order API response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`⚠️ No section order found for page ${this.currentPage} (${response.status}): ${errorText}`);
                return;
            }

            const data = await response.json();
            console.log(`🔍 Section order API response data:`, data);
            const order = data.order || [];

            if (order.length === 0) {
                console.log(`📄 No section order defined for page: ${this.currentPage}`);
                return;
            }

            console.log(`🔄 Applying section order:`, order);
            this.applyOrder(order);

        } catch (error) {
            console.error('❌ Failed to load section order:', error);
            // Don't throw - continue without ordering
        }
    }

    /**
     * Apply the section order to the DOM
     * @param {Array} order - Array of section IDs in desired order
     */
    applyOrder(order) {
        const parent = document.querySelector('main');
        if (!parent) {
            console.log('⚠️ No main element found for section ordering');
            return;
        }

        // Create a lookup map of all sections with data-ve-section-id
        const sections = Array.from(parent.querySelectorAll('[data-ve-section-id]'));
        const lookup = new Map(sections.map(sec => [sec.dataset.veSectionId, sec]));

        console.log(`🔄 Found ${sections.length} sections with IDs:`, Array.from(lookup.keys()));

        // Get pinned sections for current page
        const pinnedForPage = this.pinnedSections[this.currentPage] || [];
        console.log(`📌 Pinned sections for ${this.currentPage}:`, pinnedForPage);

        // Filter out pinned sections from reordering
        const reorderableSections = order.filter(sectionId => !pinnedForPage.includes(sectionId));
        console.log(`🔄 Reorderable sections:`, reorderableSections);

        let reorderedCount = 0;
        
        // Apply the order by moving sections (skip pinned sections)
        reorderableSections.forEach((sectionId, reorderableIndex) => {
            const section = lookup.get(sectionId);
            if (section) {
                // Find the original position in the full order array
                const originalIndex = order.indexOf(sectionId);
                console.log(`🔄 Moving section ${sectionId} (reorderable index ${reorderableIndex}, original index ${originalIndex})`);

                // Find the correct position by looking for the previous section in the FULL order
                if (originalIndex === 0) {
                    // First section in full order - insert at the very beginning
                    parent.insertBefore(section, parent.firstChild);
                    console.log(`🔄 Moved ${sectionId} to first position`);
                } else {
                    // Find the previous section in the full order (may be pinned or reorderable)
                    let previousSection = null;
                    for (let i = originalIndex - 1; i >= 0; i--) {
                        const prevSectionId = order[i];
                        previousSection = lookup.get(prevSectionId);
                        if (previousSection) {
                            break; // Found a valid previous section
                        }
                    }

                    if (previousSection) {
                        // Insert after the previous section
                        if (previousSection.nextSibling) {
                            parent.insertBefore(section, previousSection.nextSibling);
                            console.log(`🔄 Moved ${sectionId} after previous section`);
                        } else {
                            // Previous section is the last element, append after it
                            parent.appendChild(section);
                            console.log(`🔄 Moved ${sectionId} to end (after previous section)`);
                        }
                    } else {
                        console.log(`⚠️ No valid previous section found, skipping ${sectionId}`);
                        return; // Skip this section if we can't find where to place it
                    }
                }
                reorderedCount++;
            } else {
                console.log(`⚠️ Section not found: ${sectionId}`);
            }
        });

        if (reorderedCount > 0) {
            console.log(`✅ Successfully reordered ${reorderedCount} sections`);

            // Debug: Check final positions multiple times to catch any interference
            setTimeout(() => {
                const finalSections = Array.from(parent.querySelectorAll('[data-ve-section-id]'));
                console.log('🔍 Final section order after 100ms:', finalSections.map(s => s.dataset.veSectionId));

                // Check if hero is in the right position
                const heroSection = parent.querySelector('[data-ve-section-id="hero"]');
                if (heroSection) {
                    const heroIndex = Array.from(parent.children).indexOf(heroSection);
                    console.log(`🔍 Hero section is at position ${heroIndex} (should be 0)`);
                }
            }, 100);

            setTimeout(() => {
                const finalSections = Array.from(parent.querySelectorAll('[data-ve-section-id]'));
                console.log('🔍 Final section order after 1000ms:', finalSections.map(s => s.dataset.veSectionId));

                const heroSection = parent.querySelector('[data-ve-section-id="hero"]');
                if (heroSection) {
                    const heroIndex = Array.from(parent.children).indexOf(heroSection);
                    console.log(`🔍 Hero section is at position ${heroIndex} after 1000ms`);
                    if (heroIndex !== 0) {
                        console.log('❌ PROBLEM: Hero section moved after our reordering!');
                    }
                }
            }, 1000);

            // Dispatch event to notify other systems
            document.dispatchEvent(new CustomEvent('universal-section-ordering-applied', {
                detail: { page: this.currentPage, order, reorderedCount }
            }));
        } else {
            console.log('⚠️ No sections were reordered');
        }
    }
}

// Create global instance
const universalSectionOrdering = new UniversalSectionOrdering();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        universalSectionOrdering.init();
    });
} else {
    // DOM is already ready
    universalSectionOrdering.init();
}

// Export for debugging and manual control
window.universalSectionOrdering = universalSectionOrdering;

console.log('🔄 Universal Section Ordering system loaded');
