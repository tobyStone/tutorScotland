// public/js/editor/override-engine.js

import { apiService } from './api-service.js';
import { editorState } from './editor-state.js';

const BUTTON_CSS = 'button aurora';

export class OverrideEngine {
    constructor() {
        this.overrides = new Map();
    }

    async load() {
        try {
            const data = await apiService.loadOverrides(editorState.currentPage);
            data.forEach(ov => this.overrides.set(ov.targetSelector, ov));
            console.log('[VE] Overrides map populated:', this.overrides);
        } catch (e) {
            console.error('[VE] Failed to load content overrides', e);
        }
    }

    applyAllOverrides() {
        console.log('[VE] Applying all content overrides...');
        const unappliedSelectors = [];
        for (const [selector, ov] of this.overrides.entries()) {
            const targets = [...document.querySelectorAll(selector)].filter(el =>
                selector.startsWith('.main-nav') ? true : !el.closest('.main-nav')
            );
            if (targets.length > 0) {
                targets.forEach(el => this.applyOverride(el, ov));
            } else {
                unappliedSelectors.push(selector);
            }
        }
        if (unappliedSelectors.length > 0) {
            console.error('%c[VE] FAILED: Could not find elements for selectors:', 'color:red;font-weight:bold;', unappliedSelectors);
        } else {
            console.log('%c[VE] All overrides applied successfully.', 'color:green;font-weight:bold;');
        }
    }

    /**
     * Applies a single override to a specific DOM element.
     */
    applyOverride(element, override) {
        if (!element) return;
        element.dataset.veManaged = 'true';
        switch (override.contentType) {
            case 'text': element.textContent = override.text; break;
            case 'html': element.innerHTML = override.text; break;
            case 'image': {
                const img = element.tagName === 'IMG' ? element : element.querySelector('img');
                if (img) { img.src = override.image; if (override.text) img.alt = override.text; }
                break;
            }
            case 'link': {
                const a = element.tagName === 'A' ? element : element.querySelector('a');
                if (a) {
                    a.href = override.href || override.image;
                    a.textContent = override.text;
                    BUTTON_CSS.split(/\s+/).forEach(cls => a.classList.toggle(cls, !!override.isButton));
                }
                break;
            }
        }
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'img') return 'image';
        if (tagName === 'a') return 'link';
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'text';
        const clone = element.cloneNode(true);
        clone.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        if (clone.querySelector('p, ul, ol, div, br, strong, em, b, i, u')) {
            return 'html';
        }
        return 'text';
    }

    getStableSelector(el, type) {
        if (el.closest('.main-nav')) {
            const href = el.getAttribute('href') || '#';
            return `.main-nav a[href="${href}"]`;
        }
        const idKey = (type === 'link') ? 'veButtonId' : 'veBlockId';
        const attr = `data-${idKey.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
        if (!el.dataset[idKey]) {
            console.warn('[VE] Element is editable but missing a data-ve-block-id. Add one in the markup so overrides persist.', el);
            return null; // abort save; forces the admin to fix markup
        }
        const section = el.closest('[data-ve-section-id]');
        const idSelector = `[${attr}="${el.dataset[idKey]}"]`;
        return section ? `[data-ve-section-id="${section.dataset.veSectionId}"] ${idSelector}` : idSelector;
    }

    findOverrideForElement(el) {
        for (const ov of this.overrides.values()) {
            try { if (document.querySelector(ov.targetSelector) === el) return ov; } catch {}
        }
        return null;
    }

    async save(formData) {
        if (!editorState.validate()) return { success: false };
        const { element, type } = editorState.activeEditor;
        const originalContent = this.getOriginalContent(element, type);
        const existing = this.findOverrideForElement(element);
        const selector = this.getStableSelector(element, type);
        if (!selector) return { success: false };
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
            this.restoreElementContent(element, type, original);
            return { success: true, reload: false };
        }
    }

    restoreElementContent(el, type, original) {
        if (!original) return;
        switch (type) {
            case 'text': el.textContent = original; break;
            case 'html': el.innerHTML = original; break;
            case 'image': if (el.tagName === 'IMG') { el.src = original.src; el.alt = original.alt; } break;
            case 'link': if (el.tagName === 'A') { el.href = original.href; el.textContent = original.text; } break;
        }
    }

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
