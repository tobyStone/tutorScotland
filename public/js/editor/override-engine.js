// public/js/editor/override-engine.js

import { apiService } from './api-service.js';
import { editorState } from './editor-state.js';

const BUTTON_CSS = 'button aurora';

export class OverrideEngine {
    constructor() {
        this.overrides = new Map();
    }

    async init() {
        console.log('[VE] OverrideEngine initializing...');
        await this.load();
    }

    async load() {
        try {
            const data = await apiService.loadOverrides(editorState.currentPage);
            data.forEach(ov => this.overrides.set(ov.targetSelector, ov));
            console.log(`🔄 Loaded ${data.length} content overrides for page "${editorState.currentPage}"`);

            // Enhanced logging for debugging
            if (data.length > 0) {
                console.log('📋 Override details:');
                data.forEach((ov, index) => {
                    console.log(`  ${index + 1}. Type: ${ov.contentType}, Selector: "${ov.targetSelector}"`);
                    console.log(`     Content: "${ov.text || ov.image || 'N/A'}"`);
                    console.log(`     Override type: ${ov.overrideType}, Active: ${ov.isActive}`);
                });

                // Show current page elements that might match
                console.log('🔍 Current page elements with data-ve attributes:');
                const veElements = document.querySelectorAll('[data-ve-section-id], [data-ve-block-id]');
                console.log(`   Found ${veElements.length} elements with VE attributes`);

                // Show elements that have the specific block ID we're looking for
                data.forEach((ov) => {
                    const blockIdMatch = ov.targetSelector.match(/data-ve-block-id="([^"]+)"/);
                    if (blockIdMatch) {
                        const targetBlockId = blockIdMatch[1];
                        const elementsWithBlockId = document.querySelectorAll(`[data-ve-block-id="${targetBlockId}"]`);
                        console.log(`   🎯 Elements with target block ID "${targetBlockId}": ${elementsWithBlockId.length}`);

                        elementsWithBlockId.forEach((el, i) => {
                            const sectionId = el.getAttribute('data-ve-section-id');
                            const blockId = el.getAttribute('data-ve-block-id');
                            const fullSelector = sectionId ?
                                `[data-ve-section-id="${sectionId}"] [data-ve-block-id="${blockId}"]` :
                                `[data-ve-block-id="${blockId}"]`;
                            console.log(`     ${i + 1}. <${el.tagName.toLowerCase()}> → selector: "${fullSelector}"`);
                            console.log(`        Expected: "${ov.targetSelector}"`);
                            console.log(`        Match: ${fullSelector === ov.targetSelector ? '✅' : '❌'}`);
                        });
                    }
                });

                // Show first 10 elements for general debugging
                if (veElements.length > 0 && veElements.length <= 10) {
                    console.log('   📝 All VE elements (first 10):');
                    veElements.slice(0, 10).forEach((el, i) => {
                        const sectionId = el.getAttribute('data-ve-section-id');
                        const blockId = el.getAttribute('data-ve-block-id');
                        console.log(`     ${i + 1}. <${el.tagName.toLowerCase()}> section="${sectionId}" block="${blockId}"`);
                    });
                }
            }
        } catch (e) {
            console.error('❌ Failed to load content overrides', e);
        }
    }

    applyAllOverrides() {
        const timestamp = Date.now();
        console.log(`[VE] Applying all content overrides... (${timestamp})`);
        console.log(`[VE] Total overrides to apply: ${this.overrides.size}`);
        this.applyOverridesWithRetry();
    }

    // ✅ NEW: Apply overrides with retry mechanism for dynamic content
    async applyOverridesWithRetry(maxAttempts = 50, delay = 100) {
        let attempt = 0;
        let unappliedSelectors = [];

        while (attempt < maxAttempts) {
            unappliedSelectors = [];

            for (const [selector, ov] of this.overrides.entries()) {
                const targets = [...document.querySelectorAll(selector)].filter(el =>
                    selector.startsWith('.main-nav') ? true : !el.closest('.main-nav')
                );
                if (targets.length > 0) {
                    targets.forEach(el => this.applyOverride(el, ov));
                    console.log(`✅ Applied override: ${ov.contentType} for selector "${selector}"`);
                } else {
                    console.log(`⚠️ No targets found for selector: "${selector}"`);
                    console.log(`   Override details: type=${ov.contentType}, content="${ov.text || ov.image || 'N/A'}"`);

                    // Try to find similar elements for debugging
                    const selectorParts = selector.split(' ');
                    if (selectorParts.length > 1) {
                        const lastPart = selectorParts[selectorParts.length - 1];
                        const similarElements = document.querySelectorAll(lastPart);
                        console.log(`   Found ${similarElements.length} elements matching last part "${lastPart}"`);
                        if (similarElements.length > 0 && similarElements.length <= 5) {
                            similarElements.forEach((el, i) => {
                                const attrs = [];
                                if (el.id) attrs.push(`id="${el.id}"`);
                                if (el.className) attrs.push(`class="${el.className}"`);
                                if (el.getAttribute('data-ve-section-id')) attrs.push(`data-ve-section-id="${el.getAttribute('data-ve-section-id')}"`);
                                if (el.getAttribute('data-ve-block-id')) attrs.push(`data-ve-block-id="${el.getAttribute('data-ve-block-id')}"`);
                                console.log(`     ${i + 1}. <${el.tagName.toLowerCase()} ${attrs.join(' ')}>`);
                            });
                        }
                    }

                    unappliedSelectors.push(selector);
                }
            }

            // If all overrides applied successfully, we're done
            if (unappliedSelectors.length === 0) {
                console.log('%c[VE] All overrides applied successfully.', 'color:green;font-weight:bold;');

                // ✅ NEW: Dispatch completion event to prevent loops
                console.log('[VE-DBG] 🚩 ve-overrides-done event dispatched');
                window.dispatchEvent(new CustomEvent('ve-overrides-done'));
                return;
            }

            // If this is the last attempt, log failure and exit
            if (attempt === maxAttempts - 1) {
                console.error('%c[VE] FAILED: After 50 attempts, the selectors below are still missing:', 'color:red;font-weight:bold;', unappliedSelectors);
                return;
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }

    /**
     * Applies a single override to a specific DOM element.
     */
    applyOverride(element, override) {
        if (!element) return;

        // ✅ FIXED: Add debug logging for image overrides
        if (override.contentType === 'image') {
            console.log(`[VE-DBG] applyOverride → image [${override.targetSelector}]`, element, `src: ${override.image}`);
        }

        element.dataset.veManaged = 'true';
        switch (override.contentType) {
            case 'text':
                element.textContent = override.text;
                console.log(`[VE-DBG] applyOverride → text [${override.targetSelector}]`, element);
                break;
            case 'html':
                element.innerHTML = override.text;
                console.log(`[VE-DBG] applyOverride → html [${override.targetSelector}]`, element);
                break;
            case 'image': {
                const img = element.tagName === 'IMG' ? element : element.querySelector('img');
                if (img) {
                    img.src = override.image;
                    if (override.text) img.alt = override.text;
                    console.log(`[VE-DBG] Image updated: ${img.src}`);
                }
                break;
            }
            case 'link': {
                const a = element.tagName === 'A' ? element : element.querySelector('a');
                if (a) {
                    a.href = override.image; // API stores URL in image field for compatibility
                    a.textContent = override.text;
                    // Apply or remove aurora button styling based on isButton flag
                    BUTTON_CSS.split(/\s+/).forEach(cls => a.classList.toggle(cls, !!override.isButton));
                    console.log(`[VE-DBG] applyOverride → link [${override.targetSelector}]`, a, `isButton: ${override.isButton}`);
                }
                break;
            }
        }
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'img') return 'image';
        if (tagName === 'a') return 'link';
        // ✅ FIXED: All text-based elements should be treated as 'text', not 'html'
        // This includes headings, paragraphs, divs with text content, etc.
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'].includes(tagName)) return 'text';

        // ✅ FIXED: For any other element, default to 'text' to avoid HTML content type issues
        // The 'html' content type was causing infinite loops and persistence issues
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
            el.dataset[idKey] = self.crypto?.randomUUID?.() ?? `${type}-${Date.now()}`;
            console.log(`[VE] Assigning new persistent ID to element:`, el);
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
