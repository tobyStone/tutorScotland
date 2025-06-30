import { apiService } from './api-service.js';
import { editorState } from './editor-state.js';

const BUTTON_CSS = 'button aurora';

class OverrideEngine {
    constructor() {
        this.overrides = new Map();
    }
    
    async loadOverrides() {
        try {
            const data = await apiService.loadContentOverrides(editorState.currentPage);
            data.forEach(override => this.overrides.set(override.targetSelector, override));
            console.log('[VE] Overrides map populated:', this.overrides);
        } catch (error) {
            console.error('Failed to load content overrides:', error);
        }
    }

    applyAndMigrateOverrides() {
        // This is a simplified, more robust version of the migration logic.
        // It prioritizes direct matches and logs any selectors that couldn't be found.
        let unappliedSelectors = [];
        console.log("[VE] Applying overrides...");

        for (const [selector, ov] of this.overrides.entries()) {
             try {
                // The filter to avoid nav/header is critical
                const foundElements = [...document.querySelectorAll(selector)]
                    .filter(el => selector.startsWith('.main-nav') ? true : !el.closest('nav, header, .main-nav'));
                
                if (foundElements.length > 0) {
                    foundElements.forEach(el => this.applyOverride(el, ov));
                } else {
                    unappliedSelectors.push(selector);
                }
             } catch(e) {
                console.warn(`[VE] Invalid selector in overrides: "${selector}"`, e);
             }
        }

        if (unappliedSelectors.length > 0) {
            console.error(
                `%c[VE] FAILED: The following selectors are missing from the page:`,
                'color:red;font-weight:bold;',
                unappliedSelectors
            );
        } else {
            console.log('%c[VE] All overrides applied successfully.', 'color:green;font-weight:bold;');
        }
    }
    
    applyOverride(element, override) {
        if (!element) return;
        
        // Before applying, remove any existing editor UI to prevent duplication.
        element.querySelectorAll('.edit-overlay').forEach(o => o.remove());

        switch (override.contentType) {
            case 'text':
                element.textContent = override.text || override.heading;
                break;
            case 'html':
                if (override.overrideType === 'insert-after') {
                    element.insertAdjacentHTML('afterend', override.text);
                } else {
                    element.innerHTML = override.text;
                }
                break;
            case 'image': 
                const img = element.tagName === 'IMG' ? element : element.querySelector('img');
                if (img) {
                    img.src = override.image;
                    if (override.text) img.alt = override.text;
                }
                break;
            case 'link':
                const a = element.tagName === 'A' ? element : element.querySelector('a');
                if (a) {
                    a.href = override.image;
                    a.textContent = override.text;
                    const firstBtnClass = BUTTON_CSS.split(/\s+/)[0];
                    // Ensure all button classes are managed correctly
                    BUTTON_CSS.split(/\s+/).forEach(cls => {
                        a.classList.toggle(cls, !!override.isButton);
                    });
                }
                break;
        }
    }

    async saveContent(formData) {
        if (!editorState.validate()) return;
        const { element, type, original } = editorState.activeEditor;
        
        let overrideToUpdate = this.findOverrideForElement(element);
        const stableSelector = this.getStableSelector(element, type);

        const payload = {
            _id: overrideToUpdate?._id,
            targetPage: editorState.currentPage,
            targetSelector: stableSelector,
            contentType: type,
            ...formData,
            // FIX: Ensure the 'originalContent' being saved is always clean.
            originalContent: this.getOriginalContent(element, type)
        };
        
        try {
            const savedOverride = await apiService.saveOverride(payload);
            if (overrideToUpdate && overrideToUpdate.targetSelector !== stableSelector) {
                this.overrides.delete(overrideToUpdate.targetSelector);
            }
            this.overrides.set(stableSelector, savedOverride);
            this.applyOverride(element, savedOverride);
            return { success: true, message: 'Content saved successfully!' };
        } catch (err) {
            console.error('Failed to save override:', err);
            return { success: false, message: 'Failed to save override.' };
        }
    }
    
    async promoteToButton(element) {
        const a = document.createElement('a');
        a.className = `${BUTTON_CSS} ve-btn`;
        a.href = '#';
        a.textContent = 'Click me';

        const hostSelector = this.getStableSelector(element, this.getElementType(element));
        element.after(a);

        const payload = {
            targetPage: editorState.currentPage,
            targetSelector: hostSelector,
            contentType: 'html',
            text: a.outerHTML,
            overrideType: 'insert-after',
            originalContent: ''
        };

        try {
            await apiService.saveOverride(payload);
            return a; // Return the newly created element
        } catch(err) {
            console.error('Failed to promote to button:', err);
            a.remove(); // Clean up on failure
            return null;
        }
    }

    async restoreOriginal() {
        if (!editorState.validate()) return null;
        const { element, selector, type, original } = editorState.activeEditor;
        
        const override = this.findOverrideForElement(element); // Use a more reliable find method
        if (override?._id) {
            try {
                await apiService.deleteOverride(override._id);
                this.overrides.delete(override.targetSelector);
                return { success: true, reload: true, message: 'Content restored successfully' };
            } catch (error) {
                console.error('Restore error:', error);
                return { success: false, message: 'Failed to restore content' };
            }
        } else {
            this.restoreElementContent(element, type, original);
            return { success: true, reload: false, message: 'Changes discarded' };
        }
    }

    // --- Helper Methods ---

    findOverrideForElement(element) {
        for (const ov of this.overrides.values()) {
            try { 
                // Find the first element matching the selector and see if it's our target.
                // This is safer than querySelectorAll for performance.
                const foundEl = document.querySelector(ov.targetSelector);
                if (foundEl === element) return ov; 
            } catch (e) {}
        }
        return null;
    }

    // ✅ FIX: This is the critical fix for the text contamination problem.
    // It guarantees that we get clean content by cloning the element and removing
    // any UI artifacts before reading its content.
    getOriginalContent(element, type) {
        // Create a temporary, in-memory copy to work with
        const clone = element.cloneNode(true);

        // IMPORTANT: Remove any editor-specific UI from the clone.
        clone.querySelectorAll('.edit-overlay, .edit-controls, .ve-drag-handle').forEach(n => n.remove());

        switch (type) {
            case 'text':
                // Read the text from the CLEANED clone.
                return clone.textContent.trim();
            case 'html':
                 // Read the innerHTML from the CLEANED clone.
                return clone.innerHTML.trim();
            case 'image':
                // For images, original src/alt are what matter
                return { src: element.src, alt: element.alt };
            case 'link':
                // For links, get clean text from clone and the real href
                return { 
                    href: element.dataset.originalHref || element.href, 
                    text: clone.textContent.trim() 
                };
            default:
                return clone.outerHTML;
        }
    }
    
    restoreElementContent(element, type, originalContent) {
        if (!originalContent) return;
        switch (type) {
            case 'text': element.textContent = originalContent; break;
            case 'html': element.innerHTML = originalContent; break;
            case 'image': if (element.tagName === 'IMG') { element.src = originalContent.src; element.alt = originalContent.alt; } break;
            case 'link': if (element.tagName === 'A') { element.href = originalContent.href; element.textContent = originalContent.text; } break;
        }
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'img') return 'image';
        if (tagName === 'a') return 'link';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'text';
        
        // Check if the element contains other block-level tags (excluding our own UI)
        const clone = element.cloneNode(true);
        clone.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        if (clone.querySelector('p, ul, ol, div, h1, h2, h3, h4, h5, h6')) {
            return 'html';
        }
        
        return 'text';
    }

    getStableSelector(el, type) {
        if (type === 'link') {
            // Use the more robust nav-bar specific selector
            if (el.closest('.main-nav')) {
                const href = el.getAttribute('href') || '#';
                return `.main-nav a[href="${href}"]`;
            }
        }

        const idAttributeKey = (type === 'link') ? 'veButtonId' : 'veBlockId';
        const idAttribute = `data-${idAttributeKey.replace(/[A-Z]/g, '-$&').toLowerCase()}`; // data-ve-button-id
        
        if (!el.dataset[idAttributeKey]) {
            const fallbackPrefix = (type === 'link') ? 've-btn-' : 've-block-';
            el.dataset[idAttributeKey] = self.crypto?.randomUUID?.() ?? `${fallbackPrefix}${Date.now()}`;
        }
        
        const section = el.closest('[data-ve-section-id]');
        const idSelector = `[${idAttribute}="${el.dataset[idAttributeKey]}"]`;

        return section
            ? `[data-ve-section-id="${section.dataset.veSectionId}"] ${idSelector}`
            : idSelector;
    }

    checkForDuplicateButtonIds() {
        const buttonIds = [...document.querySelectorAll('[data-ve-button-id]')]
            .map(el => el.dataset.veButtonId);
        const duplicates = buttonIds.filter((id, index, arr) => arr.indexOf(id) !== index);

        if (duplicates.length > 0) {
            console.error('[VE] Duplicate button IDs detected:', [...new Set(duplicates)]);
        }
    }
}

export const overrideEngine = new OverrideEngine();
