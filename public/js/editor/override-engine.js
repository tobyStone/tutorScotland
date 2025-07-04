// public/js/editor/override-engine.js

import { apiService } from './api-service.js';
import { editorState } from './editor-state.js';

const BUTTON_CSS = 'button aurora';

export class OverrideEngine {
    constructor() {
        this.overrides = new Map();
    }

    async init() {
        console.log('[VE] OverrideEngine initializing now...');
        await this.load();
    }

    async load() {
        try {
            console.log(`🏁 [RACE] OverrideEngine.load() starting at ${Date.now()}`);
            const data = await apiService.loadOverrides(editorState.currentPage);

            // Transform database format to expected format
            data.forEach(ov => {
                // Convert buttonLabel/buttonUrl to buttons array for text content
                if (ov.contentType === 'text' && ov.buttonLabel && ov.buttonUrl) {
                    ov.buttons = [{
                        text: ov.buttonLabel,
                        url: ov.buttonUrl
                    }];
                    console.log(`[VE-DBG] Converted button data for ${ov.targetSelector}:`, ov.buttons);
                } else if (ov.contentType === 'text') {
                    ov.buttons = []; // Ensure buttons array exists even if empty
                }
                this.overrides.set(ov.targetSelector, ov);
            });

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
                    // Check for both block-id and button-id patterns
                    const blockIdMatch = ov.targetSelector.match(/data-ve-block-id="([^"]+)"/);
                    const buttonIdMatch = ov.targetSelector.match(/data-ve-button-id="([^"]+)"/);

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

                            // Only show "Match: ❌" if we can't find a parent section to fix it
                            const isDirectMatch = fullSelector === ov.targetSelector;
                            let canBeFixed = false;
                            if (!isDirectMatch && !sectionId) {
                                // Check if we can find a parent section
                                let parent = el.parentElement;
                                while (parent && !parent.getAttribute('data-ve-section-id')) {
                                    parent = parent.parentElement;
                                }
                                canBeFixed = !!parent;
                            }

                            if (isDirectMatch) {
                                console.log(`        Match: ✅`);
                            } else if (canBeFixed) {
                                console.log(`        Match: 🔧 (can be fixed via parent section)`);
                            } else {
                                console.log(`        Match: ❌`);
                            }

                            // Show parent elements to find section containers (only if not direct match)
                            if (!isDirectMatch) {
                                let parent = el.parentElement;
                                let depth = 0;
                                console.log(`        🔍 Parent chain for missing section ID:`);
                                while (parent && depth < 5) {
                                    const parentSectionId = parent.getAttribute('data-ve-section-id');
                                    const parentBlockId = parent.getAttribute('data-ve-block-id');
                                    const parentId = parent.id;
                                    const parentClass = parent.className;
                                    console.log(`          ${depth + 1}. <${parent.tagName.toLowerCase()}> id="${parentId}" class="${parentClass}" section="${parentSectionId}" block="${parentBlockId}"`);
                                    if (parentSectionId) {
                                        console.log(`          🎯 Found section container! Could use: [data-ve-section-id="${parentSectionId}"] [data-ve-block-id="${blockId}"]`);
                                        break;
                                    }
                                    parent = parent.parentElement;
                                    depth++;
                                }
                            }
                        });
                    }

                    if (buttonIdMatch) {
                        const targetButtonId = buttonIdMatch[1];
                        const elementsWithButtonId = document.querySelectorAll(`[data-ve-button-id="${targetButtonId}"]`);
                        console.log(`   🎯 Elements with target button ID "${targetButtonId}": ${elementsWithButtonId.length}`);

                        // Also check for elements with matching block ID (common case)
                        const elementsWithBlockId = document.querySelectorAll(`[data-ve-block-id="${targetButtonId}"]`);
                        if (elementsWithBlockId.length > 0) {
                            console.log(`   🔄 Found ${elementsWithBlockId.length} elements with matching block ID instead of button ID`);
                            elementsWithBlockId.forEach((el, i) => {
                                console.log(`     ${i + 1}. <${el.tagName.toLowerCase()}> has data-ve-block-id="${targetButtonId}" (should be data-ve-button-id)`);
                            });
                        }

                        elementsWithButtonId.forEach((el, i) => {
                            const sectionId = el.getAttribute('data-ve-section-id');
                            const buttonId = el.getAttribute('data-ve-button-id');
                            const fullSelector = sectionId ?
                                `[data-ve-section-id="${sectionId}"] [data-ve-button-id="${buttonId}"]` :
                                `[data-ve-button-id="${buttonId}"]`;
                            console.log(`     ${i + 1}. <${el.tagName.toLowerCase()}> → selector: "${fullSelector}"`);
                            console.log(`        Expected: "${ov.targetSelector}"`);
                            console.log(`        Match: ${fullSelector === ov.targetSelector ? '✅' : '❌'}`);
                        });
                    }
                });

                // Show all section containers
                const sectionElements = document.querySelectorAll('[data-ve-section-id]');
                console.log(`   📍 Available sections: ${sectionElements.length}`);
                sectionElements.forEach((el, i) => {
                    const sectionId = el.getAttribute('data-ve-section-id');
                    console.log(`     ${i + 1}. <${el.tagName.toLowerCase()}> section="${sectionId}"`);
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

            console.log(`🏁 [RACE] About to call applyAllOverrides() at ${Date.now()}`);
            this.applyAllOverrides();
        } catch (e) {
            console.error('❌ Failed to load content overrides', e);
        }
    }

    applyAllOverrides() {
        const timestamp = Date.now();
        console.log(`🏁 [RACE] applyAllOverrides() called at ${timestamp}`);
        console.log(`[VE] Total overrides to apply: ${this.overrides.size}`);
        this.applyOverridesWithRetry();
    }

    // ✅ NEW: Apply overrides with retry mechanism for dynamic content
    async applyOverridesWithRetry(maxAttempts = 50, delay = 100) {
        let attempt = 0;
        let unappliedSelectors = [];

        console.log(`🏁 [RACE] applyOverridesWithRetry() starting at ${Date.now()}, attempt 1/${maxAttempts}`);

        while (attempt < maxAttempts) {
            unappliedSelectors = [];
            console.log(`🔄 [RETRY] Attempt ${attempt + 1}/${maxAttempts} at ${Date.now()}`);

            for (const [selector, ov] of this.overrides.entries()) {
                console.log(`🎯 [DECISION] Processing override: "${selector}"`);
                console.log(`   Content type: ${ov.contentType}, Active: ${ov.isActive}`);

                // Debug: Test the selector directly
                let allMatches = document.querySelectorAll(selector);
                console.log(`   🔍 Raw querySelectorAll found: ${allMatches.length} elements`);

                // FALLBACK: If no matches and selector uses data-ve-button-id, try data-ve-block-id
                if (allMatches.length === 0 && selector.includes('data-ve-button-id')) {
                    const fallbackSelector = selector.replace(/data-ve-button-id/g, 'data-ve-block-id');
                    console.log(`   🔄 Trying fallback selector: "${fallbackSelector}"`);
                    allMatches = document.querySelectorAll(fallbackSelector);
                    console.log(`   🔍 Fallback querySelectorAll found: ${allMatches.length} elements`);
                }

                const targets = [...allMatches].filter(el =>
                    selector.startsWith('.main-nav') ? true : !el.closest('.main-nav')
                );
                console.log(`   After nav filter: ${targets.length} elements`);

                if (targets.length > 0) {
                    console.log(`✅ [DECISION] APPLYING override - found ${targets.length} target(s)`);
                    targets.forEach((el, i) => {
                        console.log(`   ${i + 1}. Applying to: <${el.tagName.toLowerCase()}> with content: "${el.textContent?.substring(0, 50)}..."`);
                        this.applyOverride(el, ov);
                    });
                    console.log(`✅ [SUCCESS] Applied override: ${ov.contentType} for selector "${selector}"`);
                } else {
                    console.log(`❌ [DECISION] SKIPPING override - no targets found for selector: "${selector}"`);
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

                    console.log(`📝 [DECISION] Adding "${selector}" to unapplied list for retry`);
                    unappliedSelectors.push(selector);
                }
            }

            // If all overrides applied successfully, we're done
            if (unappliedSelectors.length === 0) {
                console.log(`🎉 [RACE] All overrides applied successfully at ${Date.now()}, attempt ${attempt + 1}/${maxAttempts}`);
                console.log('%c[VE] All overrides applied successfully.', 'color:green;font-weight:bold;');

                // ✅ NEW: Dispatch completion event to prevent loops
                console.log('[VE-DBG] 🚩 ve-overrides-done event dispatched');
                window.dispatchEvent(new CustomEvent('ve-overrides-done'));
                return;
            }

            // If this is the last attempt, log failure and exit
            if (attempt === maxAttempts - 1) {
                console.log(`💀 [RACE] Final attempt failed at ${Date.now()}, ${unappliedSelectors.length} selectors still unapplied`);
                console.error('%c[VE] FAILED: After 50 attempts, the selectors below are still missing:', 'color:red;font-weight:bold;', unappliedSelectors);
                return;
            }

            // Wait before next attempt
            console.log(`⏳ [RACE] Retrying in ${delay}ms... ${unappliedSelectors.length} selectors still need targets`);
            console.log(`   Unapplied selectors: ${unappliedSelectors.join(', ')}`);
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
                // Apply buttons - check both override.buttons and override.buttons array
                const buttons = override.buttons || [];
                console.log(`[VE-DBG] Applying text buttons:`, buttons);
                this.applyTextButtons(element, buttons);
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
                    // Apply or remove button styling based on isButton flag
                    BUTTON_CSS.split(/\s+/).forEach(cls => a.classList.toggle(cls, !!override.isButton));
                    console.log(`[VE-DBG] applyOverride → link [${override.targetSelector}]`, a, `isButton: ${override.isButton}`);
                }
                break;
            }
        }
    }

    applyTextButtons(element, buttons) {
        console.log(`[VE-DBG] applyTextButtons called with:`, { element, buttons, isArray: Array.isArray(buttons) });

        if (!buttons || !Array.isArray(buttons)) {
            console.log(`[VE-DBG] No buttons to apply or invalid format`);
            return;
        }

        if (buttons.length === 0) {
            console.log(`[VE-DBG] Empty buttons array`);
            return;
        }

        // Remove any existing buttons that were added by this system
        this.removeExistingTextButtons(element);

        // Add new buttons
        console.log(`[VE-DBG] Adding ${buttons.length} buttons`);
        buttons.forEach((button, index) => {
            console.log(`[VE-DBG] Creating button ${index + 1}:`, button);
            const buttonElement = document.createElement('a');
            buttonElement.href = button.url;
            buttonElement.textContent = button.text;
            buttonElement.className = BUTTON_CSS;
            buttonElement.dataset.veTextButton = 'true';
            buttonElement.dataset.veBlockId = this.generateUUID();

            // Insert button after the text element
            element.parentNode.insertBefore(buttonElement, element.nextSibling);
            console.log(`[VE-DBG] Button ${index + 1} inserted:`, buttonElement);
        });
    }

    removeExistingTextButtons(element) {
        // Find and remove any buttons that were added by this system
        let nextSibling = element.nextElementSibling;
        while (nextSibling && nextSibling.dataset && nextSibling.dataset.veTextButton === 'true') {
            const toRemove = nextSibling;
            nextSibling = nextSibling.nextElementSibling;
            toRemove.remove();
        }
    }

    generateUUID() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();

        // ✅ DEBUG: Log element details for troubleshooting
        console.log(`[VE-DEBUG] getElementType called on:`, element);
        console.log(`[VE-DEBUG] tagName: ${tagName}`);
        console.log(`[VE-DEBUG] element.href: ${element.href}`);
        console.log(`[VE-DEBUG] element.textContent: "${element.textContent?.substring(0, 50)}"`);

        if (tagName === 'img') return 'image';
        if (tagName === 'a') return 'link';
        // ✅ FIXED: All text-based elements should be treated as 'text', not 'html'
        // This includes headings, paragraphs, divs with text content, etc.
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'].includes(tagName)) return 'text';

        // ✅ FIXED: For any other element, default to 'text' to avoid HTML content type issues
        // The 'html' content type was causing infinite loops and persistence issues
        return 'text';
    }

    // ✅ NEW: Determine the context of an element for sandboxed editing
    getElementContext(element) {
        if (element.closest('header')) return 'header';
        if (element.closest('footer')) return 'footer';
        if (element.closest('.main-nav')) return 'nav';
        return 'main';
    }

    getStableSelector(el, type) {
        // ✅ NEW: Context-aware selector generation for header/footer/nav/main isolation
        const context = this.getElementContext(el);

        // Handle navigation links (existing logic)
        if (context === 'nav') {
            const href = el.getAttribute('href') || '#';
            return `.main-nav a[href="${href}"]`;
        }

        // ✅ NEW: Handle header and footer links with context isolation
        if ((context === 'header' || context === 'footer') && type === 'link') {
            const href = el.getAttribute('href') || '#';
            const blockId = el.dataset.veBlockId;
            if (blockId) {
                return `${context} [data-ve-block-id="${blockId}"]`;
            } else {
                // Fallback to href-based selector with context
                return `${context} a[href="${href}"]`;
            }
        }

        // ✅ FIXED: For links, prefer existing data-ve-block-id over creating new data-ve-button-id
        // This maintains consistency with existing HTML structure
        if (type === 'link' && el.dataset.veBlockId) {
            const sectionEl = el.closest('[data-ve-section-id]');
            const sectionId = sectionEl?.dataset.veSectionId || '';
            const contextPrefix = context !== 'main' ? `${context} ` : '';
            return sectionId ? `${contextPrefix}[data-ve-section-id="${sectionId}"] [data-ve-block-id="${el.dataset.veBlockId}"]` : `${contextPrefix}[data-ve-block-id="${el.dataset.veBlockId}"]`;
        }

        const idKey = (type === 'link') ? 'veButtonId' : 'veBlockId';
        const attr = `data-${idKey.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
        if (!el.dataset[idKey]) {
            el.dataset[idKey] = self.crypto?.randomUUID?.() ?? `${type}-${Date.now()}`;
            console.log(`[VE] Assigning new persistent ID to element:`, el);
        }
        const section = el.closest('[data-ve-section-id]');
        const idSelector = `[${attr}="${el.dataset[idKey]}"]`;

        // ✅ NEW: Add context prefix for non-main contexts to ensure isolation
        const contextPrefix = context !== 'main' ? `${context} ` : '';

        return section ? `${contextPrefix}[data-ve-section-id="${section.dataset.veSectionId}"] ${idSelector}` : `${contextPrefix}${idSelector}`;
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
            case 'text':
                // For text elements, also capture any existing text buttons
                const textContent = clone.textContent.trim();
                const existingButtons = this.getExistingTextButtons(el);
                return { text: textContent, buttons: existingButtons };
            case 'html': return clone.innerHTML.trim();
            case 'image': return { src: el.src, alt: el.alt };
            case 'link': return { href: el.dataset.originalHref || el.href, text: clone.textContent.trim() };
            default: return clone.textContent.trim();
        }
    }

    getExistingTextButtons(element) {
        const buttons = [];
        let nextSibling = element.nextElementSibling;

        while (nextSibling && nextSibling.classList && nextSibling.classList.contains('button')) {
            buttons.push({
                text: nextSibling.textContent.trim(),
                url: nextSibling.href || '#'
            });
            nextSibling = nextSibling.nextElementSibling;
        }

        return buttons;
    }
}

export const overrideEngine = new OverrideEngine();
