// public/js/editor/override-engine.js

import { apiService } from './api-service.js';
import { editorState } from './editor-state.js';

const BUTTON_CSS = 'button aurora';

export class OverrideEngine {
    constructor() {
        this.overrides = new Map();
    }

    /**
     * Loads all content overrides for the current page from the server.
     */
    async load() {
        try {
            const data = await apiService.loadOverrides(editorState.currentPage);
            data.forEach(ov => this.overrides.set(ov.targetSelector, ov));
            console.log('[VE] Overrides map populated:', this.overrides);
        } catch (e) {
            console.error('[VE] Failed to load content overrides', e);
        }
    }

    /**
     * Applies all loaded overrides to the elements on the page.
     * This version is robust, handles errors gracefully, and provides a clear report.
     */
    applyAllOverrides() {
        const unappliedSelectors = [];
        console.log('[VE] Applying all content overrides...');

        for (const [selector, ov] of this.overrides.entries()) {
            let found = false;
            try {
                const elements = document.querySelectorAll(selector);
                const targetElements = [...elements].filter(el =>
                    selector.startsWith('.main-nav') ? true : !el.closest('nav, header, .main-nav')
                );

                if (targetElements.length > 0) {
                    targetElements.forEach(el => this.applyOverride(el, ov));
                    found = true;
                }
            } catch (e) {
                console.warn(`[VE] Invalid selector syntax in overrides map: "${selector}"`, e.message);
                unappliedSelectors.push({ selector, reason: 'Invalid Syntax' });
                found = true; // Mark as handled
            }

            if (!found) {
                unappliedSelectors.push({ selector, reason: 'Not Found in DOM' });
            }
        }

        if (unappliedSelectors.length > 0) {
            console.error(
                `%c[VE] FAILED: ${unappliedSelectors.length} override(s) could not be applied:`,
                'color:red;font-weight:bold;',
                unappliedSelectors
            );
        } else {
            console.log('%c[VE] All overrides applied successfully.', 'color:green;font-weight:bold;');
        }
    }
    
    /**
     * Applies a single override to a specific DOM element.
     */
    applyOverride(element, override) {
        if (!element) return;
        
        element.querySelectorAll('.edit-overlay').forEach(o => o.remove());

        switch(override.contentType){
            case 'text': 
                element.textContent = override.text; 
                break;
            case 'html': 
                element.innerHTML = override.text; 
                break;
            case 'image': {
                const img = element.tagName === 'IMG' ? element : element.querySelector('img');
                if (img) { 
                    img.src = override.image; 
                    if(override.text) img.alt = override.text; 
                }
                break; 
            }
            case 'link': {
                const a = element.tagName === 'A' ? element : element.querySelector('a');
                if (a) {
                    a.href = override.image;
                    a.textContent = override.text;
                    BUTTON_CSS.split(/\s+/).forEach(cls => {
                        a.classList.toggle(cls, !!override.isButton);
                    });
                }
                break; 
            }
        }
    }

    /**
     * Determines the content type of an element (text, html, image, or link).
     */
    getElementType(element) {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'img') return 'image';
        if (tagName === 'a') return 'link';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'text';
        
        const clone = element.cloneNode(true);
        clone.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        if (clone.querySelector('p, ul, ol, div, h1, h2, h3, h4, h5, h6, br, strong, em, b, i, u')) {
            return 'html';
        }
        
        return 'text';
    }

    /**
     * Generates a stable, unique selector for an element to persist changes.
     */
    getStableSelector(el, type) {
        if (type === 'link' && el.closest('.main-nav')) {
            return `.main-nav a[href="${el.getAttribute('href') || '#'}"]`;
        }

        const idAttributeKey = (type === 'link') ? 'veButtonId' : 'veBlockId';
        const idAttribute = `data-${idAttributeKey.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
        
        if (!el.dataset[idAttributeKey]) {
            const prefix = (type === 'link') ? 've-btn-' : 've-block-';
            el.dataset[idAttributeKey] = self.crypto?.randomUUID?.() ?? `${prefix}${Date.now()}`;
        }
        
        const section = el.closest('[data-ve-section-id]');
        const idSelector = `[${idAttribute}="${el.dataset[idAttributeKey]}"]`;

        return section 
            ? `[data-ve-section-id="${section.dataset.veSectionId}"] ${idSelector}` 
            : idSelector;
    }

    /**
     * Finds a saved override that corresponds to a given DOM element.
     */
    findOverrideForElement(el) {
        for (const ov of this.overrides.values()) {
            try { if (document.querySelector(ov.targetSelector) === el) return ov; } catch {}
        }
        return null;
    }

    /**
     * Saves the content changes from the editor modal to the server.
     */
    async save(formData) {
        if (!editorState.validate()) return { success: false };
        const { element, type } = editorState.activeEditor;
        
        const originalContent = this.getOriginalContent(element, type);
        const existing = this.findOverrideForElement(element);
        const selector = this.getStableSelector(element, type);
        
        const payload = { 
            _id: existing?._id, 
            targetPage: editorState.currentPage, 
            targetSelector: selector, 
            contentType: type, 
            ...formData, 
            originalContent: originalContent 
        };
        
        try {
            const saved = await apiService.saveOverride(payload);
            if (existing && existing.targetSelector !== selector) {
                this.overrides.delete(existing.targetSelector);
            }
            this.overrides.set(selector, saved);
            this.applyOverride(element, saved);
            return { success: true };
        } catch (e) {
            console.error('Save error', e);
            return { success: false };
        }
    }

    /**
     * Restores an element to its original state, deleting the override from the server.
     */
    async restore() {
        if (!editorState.validate()) return { success: false };
        const { element, type, original } = editorState.activeEditor;
        
        const ov = this.findOverrideForElement(element);
        
        if (ov && ov._id) {
            try {
                await apiService.deleteOverride(ov._id);
                this.overrides.delete(ov.targetSelector);
                return { success: true, reload: true };
            } catch (e) {
                console.error('Restore failed', e);
                return { success: false };
            }
        } else {
            // If there's no saved override, just revert the local preview changes.
            this.restoreElementContent(element, type, original);
            return { success: true, reload: false };
        }
    }

    /**
     * Restores the content of an element in the DOM locally.
     */
    restoreElementContent(el, type, original) {
        if (!original) return;
        switch (type) {
            case 'text': el.textContent = original; break;
            case 'html': el.innerHTML = original; break;
            case 'image': if (el.tagName === 'IMG') { el.src = original.src; el.alt = original.alt; } break;
            case 'link': if (el.tagName === 'A') { el.href = original.href; el.textContent = original.text; } break;
        }
    }
    
    /**
     * Gets the clean, original content of an element, stripping out any editor UI.
     */
    getOriginalContent(el, type) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.edit-overlay, .edit-controls, .ve-drag-handle').forEach(n => n.remove());
        
        switch (type) {
            case 'text': return clone.textContent.trim();
            case 'html': return clone.innerHTML.trim();
            case 'image': return { src: el.src, alt: el.alt };
            case 'link': return { href: el.dataset.originalHref || el.href, text: clone.textContent.trim() };
            default: return clone.textContent.trim();
        }
    }
}

export const overrideEngine = new OverrideEngine();
