/**
 * @fileoverview Universal Content Override System
 * @description Applies saved content overrides (text/image/link changes) for all visitors
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2025-09-29
 * 
 * This system ensures that content changes made by admins are visible to all visitors,
 * not just when the visual editor is loaded.
 */

class UniversalContentOverrides {
    constructor() {
        this.currentPage = this.getCurrentPageSlug();
        this.overrides = new Map();
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
     * Initialize content overrides for the current page
     */
    async init() {
        if (this.isInitialized) {
            console.log('🔄 Universal content overrides already initialized');
            return;
        }

        try {
            console.log(`🔄 Loading universal content overrides for page: ${this.currentPage}`);
            
            // Wait for DOM to be ready
            await this.waitForDOM();
            
            // Load and apply content overrides
            await this.loadAndApplyOverrides();
            
            this.isInitialized = true;
            console.log('✅ Universal content overrides initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize universal content overrides:', error);
            // Don't throw - content override failure shouldn't break the page
        }
    }

    /**
     * Wait for DOM to be ready
     * @returns {Promise} Resolves when DOM is ready
     */
    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Load content overrides from API and apply them
     */
    async loadAndApplyOverrides() {
        try {
            console.log(`🔄 Fetching content overrides for page: ${this.currentPage}`);
            
            const response = await fetch(`/api/content-manager?operation=overrides&page=${this.currentPage}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.log(`⚠️ No content overrides found for page ${this.currentPage} (${response.status})`);
                return;
            }

            const overrides = await response.json();

            if (overrides.length === 0) {
                console.log(`📄 No content overrides defined for page: ${this.currentPage}`);
                return;
            }

            console.log(`🔄 Applying ${overrides.length} content overrides`);
            
            // Store overrides and apply them
            overrides.forEach(override => {
                this.overrides.set(override.targetSelector, override);
            });

            this.applyAllOverrides();

        } catch (error) {
            console.error('❌ Failed to load content overrides:', error);
            // Don't throw - continue without overrides
        }
    }

    /**
     * Apply all loaded content overrides to the DOM
     */
    applyAllOverrides() {
        let appliedCount = 0;
        
        this.overrides.forEach((override, selector) => {
            try {
                const elements = document.querySelectorAll(selector);
                
                if (elements.length > 0) {
                    elements.forEach(element => {
                        this.applyOverride(element, override);
                        appliedCount++;
                    });
                    console.log(`✅ Applied override to ${elements.length} element(s) with selector: ${selector}`);
                } else {
                    console.log(`⚠️ No elements found for selector: ${selector}`);
                }
            } catch (error) {
                console.error(`❌ Failed to apply override for selector ${selector}:`, error);
            }
        });

        if (appliedCount > 0) {
            console.log(`✅ Successfully applied ${appliedCount} content overrides`);
            
            // Dispatch event to notify other systems
            document.dispatchEvent(new CustomEvent('universal-content-overrides-applied', {
                detail: { page: this.currentPage, appliedCount, overrides: Array.from(this.overrides.keys()) }
            }));
        } else {
            console.log('⚠️ No content overrides were applied');
        }
    }

    /**
     * Apply a single content override to an element
     * @param {Element} element - DOM element to apply override to
     * @param {Object} override - Override data from database
     */
    applyOverride(element, override) {
        try {
            // Mark element as managed to avoid conflicts
            element.dataset.veManaged = 'true';
            
            switch (override.contentType) {
                case 'text':
                    this.applyTextOverride(element, override);
                    break;
                case 'html':
                    element.innerHTML = override.text;
                    console.log(`🔄 Applied HTML override to: ${override.targetSelector}`);
                    break;
                case 'image':
                    this.applyImageOverride(element, override);
                    break;
                case 'link':
                    this.applyLinkOverride(element, override);
                    break;
                default:
                    console.warn(`⚠️ Unknown content type: ${override.contentType}`);
            }
        } catch (error) {
            console.error(`❌ Failed to apply override:`, error);
        }
    }

    /**
     * Apply text content override
     * @param {Element} element - Target element
     * @param {Object} override - Override data
     */
    applyTextOverride(element, override) {
        // Check if this is HTML content that should preserve formatting
        if (override.isHTML || this.containsHTMLFormatting(override.text)) {
            // Apply as HTML content
            const htmlContent = override.isHTML ? 
                this.editableTextToHTML(override.text) : 
                override.text;
            element.innerHTML = htmlContent;
            console.log(`🔄 Applied HTML text override to: ${override.targetSelector}`);
        } else {
            // Plain text content
            element.textContent = override.text;
            console.log(`🔄 Applied text override to: ${override.targetSelector}`);
        }

        // Apply buttons if present
        if (override.buttonLabel && override.buttonUrl) {
            this.applyTextButtons(element, [{
                text: override.buttonLabel,
                url: override.buttonUrl
            }]);
        }
    }

    /**
     * Apply image content override
     * @param {Element} element - Target element
     * @param {Object} override - Override data
     */
    applyImageOverride(element, override) {
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');
        if (img && override.image) {
            img.src = override.image;
            if (override.text) {
                img.alt = override.text;
            }
            console.log(`🔄 Applied image override to: ${override.targetSelector}`);
        }
    }

    /**
     * Apply link content override
     * @param {Element} element - Target element
     * @param {Object} override - Override data
     */
    applyLinkOverride(element, override) {
        if (element.tagName === 'A' && override.image) { // image field contains URL for links
            element.href = override.image;
            if (override.text) {
                element.textContent = override.text;
            }
            
            // Apply button styling if specified
            if (override.isButton) {
                element.classList.add('button', 'aurora');
            }
            
            console.log(`🔄 Applied link override to: ${override.targetSelector}`);
        }
    }

    /**
     * Apply buttons to text content
     * @param {Element} element - Target element
     * @param {Array} buttons - Array of button objects
     */
    applyTextButtons(element, buttons) {
        if (!buttons || buttons.length === 0) return;

        buttons.forEach(button => {
            const buttonEl = document.createElement('a');
            buttonEl.href = button.url;
            buttonEl.textContent = button.text;
            buttonEl.className = 'button aurora';
            buttonEl.style.marginLeft = '10px';
            element.appendChild(buttonEl);
        });
    }

    /**
     * Check if text contains HTML formatting
     * @param {string} text - Text to check
     * @returns {boolean} True if contains HTML
     */
    containsHTMLFormatting(text) {
        return text && /<[^>]+>/.test(text);
    }

    /**
     * Convert editable text format to HTML
     * @param {string} text - Editable text
     * @returns {string} HTML content
     */
    editableTextToHTML(text) {
        // Simple conversion - in a real implementation, this might be more complex
        return text.replace(/\n/g, '<br>');
    }
}

// Create global instance
const universalContentOverrides = new UniversalContentOverrides();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        universalContentOverrides.init();
    });
} else {
    // DOM is already ready
    universalContentOverrides.init();
}

// Export for debugging and manual control
window.universalContentOverrides = universalContentOverrides;

console.log('🔄 Universal Content Overrides system loaded');
