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

            if (!response.ok) {
                console.log(`⚠️ No section order found for page ${this.currentPage} (${response.status})`);
                return;
            }

            const data = await response.json();
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

        let reorderedCount = 0;
        
        // Apply the order by moving sections
        order.forEach((sectionId, index) => {
            const section = lookup.get(sectionId);
            if (section) {
                // Move section to the correct position
                if (index === 0) {
                    parent.insertBefore(section, parent.firstChild);
                } else {
                    const previousSectionId = order[index - 1];
                    const previousSection = lookup.get(previousSectionId);
                    if (previousSection && previousSection.nextSibling) {
                        parent.insertBefore(section, previousSection.nextSibling);
                    } else {
                        parent.appendChild(section);
                    }
                }
                reorderedCount++;
            } else {
                console.log(`⚠️ Section not found: ${sectionId}`);
            }
        });

        if (reorderedCount > 0) {
            console.log(`✅ Successfully reordered ${reorderedCount} sections`);
            
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
