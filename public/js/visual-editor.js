/**
 * Visual Content Editor - Live editing system for admin users
 * Allows in-place editing of website content with visual overlays
 */

// 150×150 light-grey square SVG (≈ 280 bytes)
const PLACEHOLDER_IMAGE_URI =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='100%25' height='100%25' fill='%23e0e0e0'/%3E%3C/svg%3E";

// Helper to safely handle image loading errors
function safeImg(img) {
    if (!img) return null;
    img.onerror = function () {
        if (!this.dataset.fallbackAttempted && this.dataset.fullUrl) {
            this.dataset.fallbackAttempted = '1';
            this.src = this.dataset.fullUrl;
            return;
        }
        if (!this.dataset.fallbackApplied) {
            this.dataset.fallbackApplied = '1';
            this.src = PLACEHOLDER_IMAGE_URI;
            this.alt = 'Image failed to load';
        }
    };
    return img;
}

// Basic state validation helper
function validateEditorState(editor) {
    if (!editor.activeEditor) return false;
    if (!editor.activeEditor.element || !editor.activeEditor.element.isConnected) {
        editor.activeEditor = null;
        return false;
    }
    return true;
}

// Simple error recovery
function recoverFromError(editor) {
    if (editor.activeEditor) {
        editor.closeModal();
        editor.activeEditor = null;
    }
    editor.showNotification('Operation recovered from errors', 'info');
}

class VisualEditor {

    static _closestScope(el) {
        if (el.closest('.main-nav')) return '.main-nav';
        if (el.closest('header')) return 'header';
        if (el.closest('[data-ve-section-id]'))     // section gets handled later
                return null;                            // <- we’ll add section id below
        return null;                                // body-level fallback
    }

    static BUTTON_CSS = 'button aurora';
    static EDIT_ACTIVE_CLASS = 've-edit-active';
    static IMAGE_UPLOAD_URL = '/api/upload-image'; // Centralized API endpoint

    upgradeLegacyButtons() {
        if (!VisualEditor.BUTTON_CSS.trim()) return;
        const cssParts = VisualEditor.BUTTON_CSS.split(/\s+/);
        document.querySelectorAll('a').forEach(a => {
            // Enhanced exclusion: exclude navigation, header, and any elements with navigation-related classes
            if (a.classList.contains('ve-btn') ||
                a.closest('nav, header, #edit-mode-toggle, #editor-modal, .edit-overlay, .ve-no-edit, .main-nav, .nav-link, .menu-item') ||
                a.classList.contains('nav-link') ||
                a.classList.contains('banner-login-link') ||
                a.closest('.main-nav')) return;

            if (cssParts.every(c => a.classList.contains(c))) {
                a.classList.add('ve-btn');
                if (!a.dataset.veButtonId) {
                    a.dataset.veButtonId = (self.crypto?.randomUUID?.() ?? `ve-btn-${Date.now()}-${Math.random()}`);
                }
                const selector = this.generateSelector(a);
                if (!this.editableElements.some(e => e.element === a)) {
                    this.editableElements.push({ element: a, selector, type: 'link' });
                }
            }
        });

        // Check for duplicate button IDs after assignment
        this.checkForDuplicateButtonIds();
    }

    checkForDuplicateButtonIds() {
        const buttonIds = [...document.querySelectorAll('[data-ve-button-id]')]
            .map(el => el.dataset.veButtonId);
        const duplicates = buttonIds.filter((id, index, arr) => arr.indexOf(id) !== index);

        if (duplicates.length > 0) {
            console.error('[VE] Duplicate button IDs detected:', [...new Set(duplicates)]);
            duplicates.forEach(id => {
                const elements = document.querySelectorAll(`[data-ve-button-id="${id}"]`);
                console.error(`[VE] ID "${id}" found on ${elements.length} elements:`, elements);
            });
        }
    }

    constructor() {
        this.isEditMode = false;
        this.currentPage = location.pathname;
        this.editableElements = [];
        this.activeEditor = null;
        this.overrides = new Map();
        this.imgPage = 1;
        this.imgTotalPage = 1;
        this._eventListeners = new Map();
        this._adminCheckInterval = null;
        this.imgSearch = "";
        this.imgSort = "newest";
        this.sortable = null;
        this.sectionOrder = [];
        this.reorderableSecs = [];
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }




    waitForDynamicSections() {
        return new Promise(resolve => {
            if (document.body.classList.contains('dyn-ready')) return resolve();
            const handler = () => { window.removeEventListener('dyn-sections-loaded', handler); resolve(); };
            window.addEventListener('dyn-sections-loaded', handler, { once: true });
            setTimeout(resolve, 2000);
        });
    }

    async initialize() {
        await this.waitForDynamicSections();
        console.log('[VE] Dynamic sections are ready. Initializing editor.');
        await this.loadSectionOrder();
        this.applySectionOrder();
        await this.loadContentOverrides();
        this._applyAndMigrateOverridesWithRetry();
        const isAdmin = await this.checkAdminStatus();
        if (isAdmin) {
            this.loadEditorStyles();
            this.createEditModeToggle();
            this.createEditorModal();
            this.setupKeyboardShortcuts();
            this._adminCheckInterval = setInterval(() => this.checkAdminStatus(), 600000);
        }
    }

    loadEditorStyles() {
        if (document.getElementById('ve-style')) return;
        const link = document.createElement('link');
        link.id = 've-style';
        link.rel = 'stylesheet';
        link.href = '/editor.css';
        document.head.appendChild(link);
    }

    async checkAdminStatus() {
        try {
            const response = await fetch('/api/login?check=admin', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
            });
            const data = await response.json();
            const isAdmin = data.isAdmin || false;
            if (!isAdmin && this.isEditMode) {
                this.disableEditMode();
                this.isEditMode = false;
                this.updateEditToggle();
            }
            return isAdmin;
        } catch (error) {
            console.error('[VE] Admin check failed:', error);
            if (this.isEditMode) {
                this.disableEditMode();
                this.isEditMode = false;
                this.updateEditToggle();
            }
            return false;
        }
    }

    async loadContentOverrides() {
        try {
            const pageKey = (this.currentPage.replace(/^\//, '') || 'index').replace(/\.html?$/i, '');
            const response = await fetch(`/api/content-manager?operation=overrides&page=${pageKey}`);
            const overrides = await response.json();
            overrides.forEach(override => {
                this.overrides.set(override.targetSelector, override);
            });
            console.log('[VE] Overrides map populated:', this.overrides);
        } catch (error) {
            console.error('Failed to load content overrides:', error);
        }
    }

    /* ------------------------------------------------------------------ *
   *  Apply overrides, re-hydrating late-loaded elements and migrating   *
   *  stale selectors for any content-type (text, html, image, link)   *
   * ------------------------------------------------------------------ */
    async _applyAndMigrateOverridesWithRetry(maxRetries = 50, delay = 100) {
        let attempt = 0;

        const execute = async () => {
            let pendingOverrides = new Map(this.overrides);
            let successfullyApplied = new Set();

            /* ── Pass 1: Apply everything we can find directly ──────── */
            for (const [selector, ov] of pendingOverrides.entries()) {
                try {
                      // Filter out anything living in header or nav so we never “paint” the menu
                          const foundElements = [...document.querySelectorAll(selector)]
                                    .filter(el => !el.closest('nav, header, .main-nav'));

                    // Enhanced diagnostics: warn about duplicate matches
                    if (foundElements.length > 1) {
                        // After scoping, duplicate matches are effectively bugs
                        const logLevel = selector.includes('[data-ve-section-id') ? 'error' : 'warn';
                        console[logLevel](`[VE] ${logLevel.toUpperCase()}: selector "${selector}" matched ${foundElements.length} elements`, foundElements);
                        console[logLevel]('[VE] This may indicate duplicate IDs or overly broad selectors');
                    }

                    if (foundElements.length > 0) {
                        foundElements.forEach(el => this.applyOverride(el, ov));
                        successfullyApplied.add(selector);
                    }
                } catch (e) {
                    console.warn(`[VE] Invalid selector in overrides map: "${selector}"`, e.message);
                    successfullyApplied.add(selector);
                }
            }

            successfullyApplied.forEach(selector => pendingOverrides.delete(selector));

            if (pendingOverrides.size === 0) {
                console.log('%c[VE] All overrides applied successfully.', 'color:green;font-weight:bold;');
                this._cleanUpTwins();
                window.dispatchEvent(new CustomEvent('ve-overrides-done'));
                dbg('🚩 ve-overrides-done event dispatched');
                return;
            }

            if (attempt >= maxRetries) {
                console.error(
                    `%c[VE] FAILED: After ${maxRetries} attempts, the selectors below are still missing:`,
                    'color:red;font-weight:bold;',
                    Array.from(pendingOverrides.keys())
                );
                return;
            }

            /* ── Pass 2: Re-hydrate or Migrate missing overrides ──────── */
            const norm = s => (s || '').replace(/\s+/g, ' ').trim();

            for (const [staleSelector, ov] of pendingOverrides.entries()) {
                if (!ov.originalContent) continue;

                let candidate = null;
                candidate = Array.from(
                    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,span,li,a,img')
                )
                    .filter(el => !el.dataset.veBlockId && !el.dataset.veButtonId && !el.closest('.ve-no-edit'))
                    .find(el => {
                        const originalText = (typeof ov.originalContent === 'string') ? ov.originalContent : ov.originalContent.text;
                        return norm(el.textContent) === norm(originalText);
                    });

                if (!candidate) continue;

                // --- THIS IS THE CORE FIX ---
                // We now check for BOTH block and button IDs and re-hydrate accordingly.
                const blockIdMatch = staleSelector.match(/\[data-ve-block-id="([^"]+)"\]/);
                const buttonIdMatch = staleSelector.match(/\[data-ve-button-id="([^"]+)"\]/);

                let rehydrationSuccess = false;

                if (blockIdMatch && blockIdMatch[1]) {
                    candidate.dataset.veBlockId = blockIdMatch[1];
                    rehydrationSuccess = true;
                } else if (buttonIdMatch && buttonIdMatch[1]) {
                    candidate.dataset.veButtonId = buttonIdMatch[1];
                    rehydrationSuccess = true;
                }

                if (rehydrationSuccess) {
                    console.log(
                        `%c[VE Re-hydration]`, 'color:#17a2b8; font-weight:bold;',
                        `Found element for "${staleSelector}" based on original content. Restoring correct ID.`
                    );
                    this.applyOverride(candidate, ov);
                    pendingOverrides.delete(staleSelector);
                } else {
                    console.warn(`[VE] Found candidate for selector, but it has no re-hydratable ID.`, staleSelector);
                }
            }

            attempt++;
            setTimeout(execute, delay);
        };

        execute();
    }

    applyOverride(element, override) {
        // Auto-migrate legacy un-scoped selectors to section-scoped ones
        if (override.contentType === 'link' &&
            override.targetSelector?.includes('data-ve-button-id') &&
            !override.targetSelector.includes('[data-ve-section-id')) {

            // Prefer a match that is INSIDE a section; ignore nav/header clones
            const el = [...document.querySelectorAll(override.targetSelector)]
                                .find(node => node.closest('[data-ve-section-id]'));
            if (el && el.closest('[data-ve-section-id]')) {
                const scopedSelector = this.getStableLinkSelector(el);
                console.log(`[VE] Migrating selector from "${override.targetSelector}" to "${scopedSelector}"`);
                this.overrides.set(scopedSelector, override);
                this.overrides.delete(override.targetSelector);
                override.targetSelector = scopedSelector;
            }
        }
        switch (override.contentType) {
            case 'text':
                element.textContent = override.text || override.heading;
                break;
            case 'html':
                element.innerHTML = override.text;
                break;
            case 'image':
                if (element.tagName === 'IMG') {
                    element.src = override.image;
                    if (override.text) element.alt = override.text;
                }
                break;

            // --- MODIFIED SECTION START ---
            case 'link':
                // Find the actual <a> tag, whether it's the element itself or a child of it.
                const linkElement = element.tagName === 'A' ? element : element.querySelector('a');

                if (linkElement) {
                    linkElement.href = override.image; // 'image' field holds the URL for links
                    linkElement.textContent = override.text;
                    if (linkElement.dataset.originalHref !== undefined) {
                        // If we are in edit mode, update the data-attribute too
                        linkElement.dataset.originalHref = override.image;
                    }
                } else {
                    console.warn('[VE] applyOverride failed for link: could not find an <a> tag in', element);
                }
                break;
            // --- MODIFIED SECTION END ---
        }
    }
    // visual-editor.js

    async saveContent() {
        if (!this.activeEditor) return;

        // Use the 'original' content captured when the editor was first opened. This is more reliable.
        const { element, type, original } = this.activeEditor;
        const contentData = this.getFormData(type);

        let overrideToUpdate = null;
        for (const ov of this.overrides.values()) {
            try {
                if (document.querySelector(ov.targetSelector) === element) {
                    overrideToUpdate = ov;
                    break;
                }
            } catch (e) { /* Ignore invalid selectors */ }
        }

        const api = `/api/content-manager?operation=override` + (overrideToUpdate ? `&id=${overrideToUpdate._id}` : '');

          /*
   *  ⬇️  Force links to be saved with a section-scoped selector.
   *      (If the element is NOT inside a section we still fall back to the
   *      plain [data-ve-button-id] selector, but nav / header are excluded.)
   */
        const stableSelector = type === 'link'
                ? this.getStableLinkSelector(element)
            : this.ensureBlockId(element);

        const pageKey = (this.currentPage.replace(/^\//, '') || 'index').replace(/\.html?$/i, '');

        try {
            const response = await fetch(api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPage: pageKey,
                    targetSelector: stableSelector,
                    contentType: type,
                    ...contentData,
                    isButton: (type === 'link' && document.getElementById('link-is-button')?.checked),
                    // CRITICAL CHANGE: Use the pristine 'original' content.
                    originalContent: original
                })
            });

            if (!response.ok) throw new Error('API request failed');

            const savedOverride = await response.json();

            if (overrideToUpdate && overrideToUpdate.targetSelector !== stableSelector) {
                this.overrides.delete(overrideToUpdate.targetSelector);
            }
            this.overrides.set(stableSelector, savedOverride);

            this.applyOverride(element, savedOverride);
            this.closeModal();
            this.showNotification('Content saved successfully!', 'success');
        } catch (err) {
            console.error('Failed to save override:', err);
            this.showNotification('Failed to save override.', 'error');
        }
    }

    createEditModeToggle() {
        const button = document.createElement('button');
        button.id = 'edit-mode-toggle';
        button.className = VisualEditor.BUTTON_CSS;
        button.textContent = 'Edit Mode';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-label', 'Toggle edit mode');

        button.addEventListener('click', () => this.toggleEditMode());
        document.body.appendChild(button);
    }

    updateEditToggle() {
        const button = document.getElementById('edit-mode-toggle');
        if (button) {
            button.setAttribute('aria-pressed', this.isEditMode.toString());
            button.textContent = this.isEditMode ? 'Exit Edit' : 'Edit Mode';
            button.style.background = this.isEditMode ? '#28a745' : '#007bff';
        }
    }

    async toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        document.body.classList.toggle(VisualEditor.EDIT_ACTIVE_CLASS, this.isEditMode);
        this.updateEditToggle();

        if (this.isEditMode) {
            this.scanForEditableElements();
            this.addEditOverlays();
            this.disableLinks();
            document.body.style.outline = '3px dashed #007bff';
            document.body.style.outlineOffset = '-3px';
            this.showEditInstructions();
            await this.ensureSortableLoaded();
            this.scanForSections();
            this.activateSectionDragging();
        } else {
            this.disableEditMode();
        }
    }

    disableEditMode() {
        this.removeEditOverlays();
        this.enableLinks();
        document.body.style.outline = '';
        document.body.style.outlineOffset = '';
        this.hideEditInstructions();
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
        document.querySelectorAll('.ve-drag-handle').forEach(h => h.remove());
    }

    disableLinks() {
        document.querySelectorAll('a').forEach(link => {
            if (link.closest('nav, header, #edit-mode-toggle, #editor-modal, .edit-overlay')) return;
            link.dataset.originalHref = link.href;
            link.href = 'javascript:void(0)';
            link.style.cursor = 'default';
            link.style.opacity = '0.6';
            link.addEventListener('click', this.preventLinkClick, true);
        });
    }

    enableLinks() {
        document.querySelectorAll('a[data-original-href]').forEach(link => {
            link.href = link.dataset.originalHref;
            link.removeAttribute('data-original-href');
            link.style.cursor = '';
            link.style.opacity = '';
            link.removeEventListener('click', this.preventLinkClick, true);
        });
    }

    preventLinkClick(e) {
        if (e.target.closest('.edit-overlay')) return;
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    scanForEditableElements() {
        this.editableElements = [];
        this.upgradeLegacyButtons();
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p:not(.no-edit)',
            'ul:not(.no-edit):not(.ve-no-edit)',
            'ol:not(.no-edit):not(.ve-no-edit)',
            'a:not(.no-edit)',
            'img:not(.no-edit)',
            '.editable'
        ];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!element.closest('#edit-mode-toggle, #editor-modal, .edit-overlay, .ve-no-edit')) {
                    this.editableElements.push({
                        element,
                        selector: this.generateSelector(element),
                        type: this.getElementType(element)
                    });
                }
            });
        });
    }

    generateSelector(element) {
        if (element.dataset.veBlockId) {
            return `[data-ve-block-id="${element.dataset.veBlockId}"]`;
        }
        if (element.dataset.veButtonId) {
            return `[data-ve-button-id="${element.dataset.veButtonId}"]`;
        }
        const segments = [];
        let current = element;
        while (current && current.tagName !== 'BODY') {
            let seg = current.tagName.toLowerCase();
            if (current.id) {
                segments.unshift(`#${current.id}`);
                break;
            }
            const cls = [...current.classList].find(c => !c.startsWith('ve-') && c !== 'edit-overlay');
            if (cls) seg += `.${cls}`;
            const parent = current.parentElement;
            if (parent) {
                const sibs = [...parent.children].filter(ch => ch.tagName === current.tagName);
                if (sibs.length > 1) {
                    seg += `:nth-of-type(${sibs.indexOf(current) + 1})`;
                }
            }
            segments.unshift(seg);
            if (parent?.id) {
                segments.unshift(`#${parent.id}`);
                break;
            }
            current = parent;
        }
        return segments.join(' > ') || element.tagName.toLowerCase();
    }

    getStableLinkSelector(el) {
        if (!el) return '';
    
            /* 1️⃣ ensure the element itself has a button-id */
            if (!el.dataset.veButtonId) {
                    el.dataset.veButtonId =
                        (self.crypto?.randomUUID?.() ?? `ve-btn-${Date.now()}-${Math.random()}`);
                }
    
            /* 2️⃣ decide which container we must prepend */
            const scope = VisualEditor._closestScope(el);
    
            /* ─ content section ─────────────────────── */
            if (!scope) {
                    const section = el.closest('[data-ve-section-id]');
                    return section
                            ? `[data-ve-section-id="${section.dataset.veSectionId}"] [data-ve-button-id="${el.dataset.veButtonId}"]`
                        : `[data-ve-button-id="${el.dataset.veButtonId}"]`;   // (rare) truly global element
                }
    
            /* ─ nav / header ────────────────────────── */
            return `${scope} [data-ve-button-id="${el.dataset.veButtonId}"]`;
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();
        switch (tagName) {
            case 'img': return 'image';
            case 'a': return 'link';
            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'text';
            case 'ul': case 'ol': case 'li': return 'html';
            case 'p': case 'div': case 'span': return element.innerHTML.includes('<') ? 'html' : 'text';
            default: return 'text';
        }
    }

    addEditOverlays() {
        this.editableElements.forEach(({ element, selector, type }) => {
            let mount = element;
            if (type === 'link') {
                mount = element.closest('li') || element;
            } else if (type === 'image') {
                if (element.parentElement?.classList.contains('ve-img-wrap')) {
                    mount = element.parentElement;
                } else {
                    const wrap = document.createElement('span');
                    wrap.className = 've-img-wrap';
                    element.parentNode.insertBefore(wrap, element);
                    wrap.appendChild(element);
                    mount = wrap;
                }
            }
            if (getComputedStyle(mount).position === 'static') {
                mount.style.position = 'relative';
            }
            const overlay = this.createEditOverlay(element, selector, type);
            mount.appendChild(overlay);
        });
    }

    createEditOverlay(element, selector, type) {
        const overlay = document.createElement('div');
        overlay.className = 'edit-overlay';
        overlay.innerHTML = `<div class="edit-controls"><span class="edit-type">${type}</span><button class="edit-btn" data-selector="${selector}" data-type="${type}">✏️ Edit</button></div>`;
        overlay.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 123, 255, 0.1); border: 2px dashed #007bff; pointer-events: none; z-index: 1000; opacity: 0; transition: all 0.3s ease; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);`;
        const controls = overlay.querySelector('.edit-controls');
        controls.style.cssText = `position: absolute; top: -35px; left: 0; background: #007bff; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 10px; pointer-events: auto; white-space: nowrap;`;
        const editBtn = overlay.querySelector('.edit-btn');
        editBtn.style.cssText = `background: #28a745; border: none; color: white; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;`;
        element.addEventListener('mouseenter', () => { if (this.isEditMode) overlay.style.opacity = '1'; });
        overlay.addEventListener('mouseleave', (e) => { if (!element.contains(e.relatedTarget)) overlay.style.opacity = '0'; });
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); this.openEditor(element, selector, type); });
        return overlay;
    }

    removeEditOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        this.editableElements = [];
    }

    showEditInstructions() {
        if (document.getElementById('edit-instructions')) return;
        const instructions = document.createElement('div');
        instructions.id = 'edit-instructions';
        instructions.innerHTML = `<div class="instructions-content"><h4>🎨 Edit Mode Active</h4><p>Hover over elements to see edit controls. Click "Edit" to modify content.</p><button id="close-instructions">×</button></div>`;
        instructions.style.cssText = `position: fixed; top: 80px; right: 20px; background: #28a745; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10001; max-width: 300px; animation: slideIn 0.3s ease;`;
        document.body.appendChild(instructions);
        const closeBtn = document.getElementById('close-instructions');
        if (closeBtn) closeBtn.addEventListener('click', () => instructions.remove());
        setTimeout(() => { if (instructions.parentNode) instructions.remove(); }, 5000);
    }

    hideEditInstructions() {
        const instructions = document.getElementById('edit-instructions');
        if (instructions) instructions.remove();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.toggleEditMode();
            }
            if (e.key === 'Escape' && this.isEditMode) {
                this.disableEditMode();
            }
        });
    }

    createEditorModal() {
        const modal = document.createElement('div');
        modal.id = 'editor-modal';
        const style = document.createElement('style');
        style.textContent = '.ve-img-wrap { position:relative; display:inline-block; }';
        document.head.appendChild(style);
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header"><h3 id="modal-title">Edit Content</h3><button id="close-modal" class="close-btn">×</button></div>
                <div class="modal-body">
                    <form id="content-form">
                        <div class="form-group"><label for="content-type">Content Type:</label><select id="content-type" disabled><option value="text">Text</option><option value="html">HTML</option><option value="image">Image</option><option value="link">Link</option></select></div>
                        <div class="form-group" id="text-group"><label for="content-text">Text Content:</label><textarea id="content-text" rows="4" placeholder="Enter text content..."></textarea></div>
                        <div class="form-group" id="html-group" style="display: none;"><label for="content-html">HTML Content:</label><textarea id="content-html" rows="6" placeholder="Enter HTML content..."></textarea><small class="form-text text-muted">For lists, preserve the <ul>, <ol>, and <li> tags.</small></div>
                        <div class="form-group" id="image-group" style="display: none;">
                            <label for="content-image">Image URL:</label>
                            <div class="image-input-group"><input type="url" id="content-image" placeholder="https://example.com/image.jpg"><button type="button" id="browse-btn" class="btn btn-secondary">Browse Images</button></div>
                            <div id="image-preview" class="mt-2" style="display: none;"><img src="" alt="Preview" style="max-width: 200px; max-height: 200px;"></div>
                            <div class="upload-section"><label for="image-upload">Or upload a new image:</label><input type="file" id="image-upload" accept="image/*"><button type="button" id="upload-btn" class="btn btn-secondary">Upload Image</button><div id="upload-progress" style="display: none;"><div class="progress-bar"><div class="progress-fill"></div></div><span class="progress-text">Uploading...</span></div></div>
                            <label for="image-alt">Alt Text:</label><input type="text" id="image-alt" placeholder="Image description">
                        </div>
                        <div class="form-group" id="link-group" style="display: none;"><label for="link-url">Link URL:</label><input type="url" id="link-url" placeholder="https://example.com"><label for="link-text">Link Text:</label><input type="text" id="link-text" placeholder="Click here"><div class="form-check mt-2"><input type="checkbox" id="link-is-button" class="form-check-input"><label for="link-is-button" class="form-check-label">Style as button</label></div></div>
                        <div class="form-actions"><button type="button" id="preview-btn" class="btn btn-secondary">Preview</button><button type="button" id="save-btn" class="btn btn-primary">Save Changes</button><button type="button" id="restore-btn" class="btn btn-warning">Restore Original</button></div>
                    </form>
                </div>
            </div>
            <div id="image-browser" class="image-browser" style="display: none;">
                <div class="image-browser-header"><h4>Browse Images</h4><button type="button" id="close-browser" class="close-btn">×</button></div>
                <div class="image-browser-content">
                    <div class="image-browser-toolbar"><input type="text" id="image-search" placeholder="Search images..." class="form-control"><select id="image-sort" class="form-control"><option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="name">Name</option></select></div>
                    <div id="image-grid" class="image-grid"><div class="loading-spinner"></div></div>
                    <div id="image-pagination" class="image-pagination"><button type="button" id="prev-page" class="btn btn-secondary" disabled>Previous</button><span id="page-info">Page 1</span><button type="button" id="next-page" class="btn btn-secondary">Next</button></div>
                </div>
            </div>`;
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10002; display: none;`;
        this.addModalStyles();
        document.body.appendChild(modal);
        this.setupModalEvents();
    }

    addModalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #editor-modal .modal-backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); }
            #editor-modal .modal-content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
            #editor-modal .modal-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            #editor-modal .modal-header h3 { margin: 0; color: #333; }
            #editor-modal .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
            #editor-modal .modal-body { padding: 20px; }
            #editor-modal .form-group { margin-bottom: 20px; }
            #editor-modal label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
            #editor-modal input, #editor-modal textarea, #editor-modal select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
            #editor-modal textarea { resize: vertical; font-family: monospace; }
            #editor-modal .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
            #editor-modal .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.3s ease; }
            #editor-modal .btn-primary { background: #007bff; color: white; }
            #editor-modal .btn-primary:hover { background: #0056b3; }
            #editor-modal .btn-secondary { background: #6c757d; color: white; }
            #editor-modal .btn-secondary:hover { background: #545b62; }
            #editor-modal .btn-warning { background: #ffc107; color: #212529; }
            #editor-modal .btn-warning:hover { background: #e0a800; }
            .image-browser { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); width: 90%; max-width: 800px; max-height: 80vh; display: flex; flex-direction: column; }
            .image-browser-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .image-browser-content { padding: 20px; overflow-y: auto; flex: 1; }
            .image-browser-toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
            .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; }
            .image-item { position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: all 0.2s ease; }
            .image-item:hover { border-color: #007bff; }
            .image-item img { width: 100%; height: 100%; object-fit: cover; }
            .image-pagination { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; }
            .loading-spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .image-input-group { display: flex; gap: 10px; margin-bottom: 10px; }
            .image-input-group input { flex: 1; }
            .ve-img-wrap:hover > .edit-overlay, .edit-overlay:hover { opacity: 1 !important; }
            .image-item.selected { position: relative; border: 3px solid #28a745; border-radius: 4px; }
            .image-item.selected::after { content: '✓'; position: absolute; right: 6px; top: 4px; font-size: 20px; color: #28a745; background: rgba(255, 255, 255, 0.9); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    setupModalEvents() {
        const modal = document.getElementById('editor-modal');
        modal.querySelector('#close-modal').addEventListener('click', () => this.closeModal());
        modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
        modal.querySelector('#save-btn').addEventListener('click', () => this.saveContent());
        modal.querySelector('#preview-btn').addEventListener('click', () => this.previewContent());
        modal.querySelector('#restore-btn').addEventListener('click', () => this.restoreOriginal());
        modal.querySelector('#upload-btn').addEventListener('click', () => this.uploadImage());

        const browseBtn = document.getElementById('browse-btn');
        const closeBrowser = document.getElementById('close-browser');
        const imageBrowser = document.getElementById('image-browser');
        const imageSearch = document.getElementById('image-search');
        const imageSort = document.getElementById('image-sort');
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');

        browseBtn.addEventListener('click', async () => {
            const hasAny = await fetch('/api/content-manager?operation=list-images&perPage=1&folder=content-images').then(r => r.ok ? r.json() : { total: 0 }).then(d => d.total > 0).catch(() => false);
            if (hasAny) this.openImageBrowser();
            else this.showNotification('No images in the library yet – upload one first!', 'info');
        });

        closeBrowser.addEventListener('click', () => imageBrowser.style.display = 'none');
        let searchTimeout = null;
        imageSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            this.imgSearch = imageSearch.value.trim();
            searchTimeout = setTimeout(() => { this.imgPage = 1; this.loadImages(); }, 300);
        });
        imageSort.addEventListener('change', () => {
            this.imgSort = imageSort.value || "newest";
            this.imgPage = 1;
            this.loadImages();
        });
        prevPage.addEventListener('click', () => { if (this.imgPage > 1) { this.imgPage--; this.loadImages(); } });
        nextPage.addEventListener('click', () => { if (this.imgPage < this.imgTotalPage) { this.imgPage++; this.loadImages(); } });
    }

    openEditor(element, selector, type) {
        if (type === 'link' && element.classList.contains('ve-btn')) {
            selector = this.getStableLinkSelector(element);
        }
        this.activeEditor = { element, selector, type, original: this.getOriginalContent(element, type) };
        const modal = document.getElementById('editor-modal');
        modal.querySelector('#modal-title').textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Content`;
        modal.querySelector('#content-type').value = type;
        this.updateFormFields();
        this.populateCurrentContent(element, type);
        const restoreBtn = document.getElementById('restore-btn');
        if (restoreBtn) restoreBtn.disabled = !this.overrides.has(selector);
        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('editor-modal');
        if (modal) {
            modal.style.display = 'none';
            if (!validateEditorState(this)) recoverFromError(this);
        }
    }

    updateFormFields() {
        const type = document.getElementById('content-type').value;
        document.getElementById('text-group').style.display = 'none';
        document.getElementById('html-group').style.display = 'none';
        document.getElementById('image-group').style.display = 'none';
        document.getElementById('link-group').style.display = 'none';
        if (document.getElementById(`${type}-group`)) {
            document.getElementById(`${type}-group`).style.display = 'block';
        }
    }

    populateCurrentContent(element, type) {
        switch (type) {
            case 'text':
                const textClone = element.cloneNode(true);
                textClone.querySelectorAll('.edit-overlay').forEach(n => n.remove());
                document.getElementById('content-text').value = textClone.textContent.trim();
                break;
            case 'html':
                const htmlClone = element.cloneNode(true);
                htmlClone.querySelectorAll('.edit-overlay').forEach(n => n.remove());
                document.getElementById('content-html').value = htmlClone.innerHTML;
                break;
            case 'image':
                if (element.tagName === 'IMG') {
                    document.getElementById('content-image').value = element.src;
                    document.getElementById('image-alt').value = element.alt;
                }
                break;
            case 'link':
                if (element.tagName === 'A') {
                    const realHref = element.dataset.originalHref || element.href;
                    document.getElementById('link-url').value = realHref;
                    const linkClone = element.cloneNode(true);
                    linkClone.querySelectorAll('.edit-overlay').forEach(n => n.remove());
                    document.getElementById('link-text').value = linkClone.textContent.trim();
                    const firstBtnClass = VisualEditor.BUTTON_CSS.split(/\s+/)[0];
                    document.getElementById('link-is-button').checked = element.classList.contains(firstBtnClass);
                }
                break;
        }
    }

    getFormData(type) {
        switch (type) {
            case 'text': return { text: document.getElementById('content-text').value };
            case 'html': return { text: document.getElementById('content-html').value };
            case 'image': return { image: document.getElementById('content-image').value, text: document.getElementById('image-alt').value };
            case 'link': return { image: document.getElementById('link-url').value, text: document.getElementById('link-text').value };
            default: return {};
        }
    }

    // visual-editor.js

    getOriginalContent(element, type) {
        // Clone the element to safely work on it without affecting the live page
        const clone = element.cloneNode(true);

        // IMPORTANT: Remove any editor-specific UI artifacts from the clone before getting content
        clone.querySelectorAll('.edit-overlay, .edit-controls, .ve-drag-handle').forEach(n => n.remove());

        switch (type) {
            case 'text':
                return clone.textContent.trim();
            case 'html':
                return clone.innerHTML.trim();
            case 'image':
                // For images, the original `src` and `alt` are what matter
                return { src: element.src, alt: element.alt };
            case 'link':
                // For links, get the clean text and the real href (in case edit mode has disabled it)
                return { href: element.dataset.originalHref || element.href, text: clone.textContent.trim() };
            default:
                return clone.outerHTML;
        }
    }

    previewContent() {
        if (!this.activeEditor) return;
        const { element, type } = this.activeEditor;
        const contentData = this.getFormData(type);
        const originalContent = this.getOriginalContent(element, type);
        this.applyOverride(element, { contentType: type, ...contentData });
        setTimeout(() => { this.restoreElementContent(element, type, originalContent); }, 3000);
        this.showNotification('Preview applied for 3 seconds', 'info');
    }

    async restoreOriginal() {
        if (!validateEditorState(this)) { recoverFromError(this); return; }
        let { selector, element, type } = this.activeEditor;
        const original = this.activeEditor.original; // Get original from the saved state

        if (type === 'link' && element.classList.contains('ve-btn')) {
            selector = this.getStableLinkSelector(element);
        }
        const override = this.overrides.get(selector);
        if (override) {
            try {
                const response = await fetch(`/api/content-manager?id=${override._id}`, { method: 'DELETE' });
                if (response.ok) {
                    this.overrides.delete(selector);
                    this.showNotification('Content restored successfully', 'success');
                    window.location.reload();
                } else {
                    this.showNotification('Failed to restore content', 'error');
                }
            } catch (error) {
                console.error('Restore error:', error);
                this.showNotification('Failed to restore content', 'error');
            }
        } else {
            this.restoreElementContent(element, type, original);
            this.closeModal();
            this.showNotification('Changes discarded', 'success');
        }
    }

    restoreElementContent(element, type, originalContent) {
        if (!originalContent) return; // Safety guard
        switch (type) {
            case 'text': element.textContent = originalContent; break;
            case 'html': element.innerHTML = originalContent; break;
            case 'image': if (element.tagName === 'IMG') { element.src = originalContent.src; element.alt = originalContent.alt; } break;
            case 'link': if (element.tagName === 'A') { element.href = originalContent.href; element.textContent = originalContent.text; } break;
        }
    }

    /* ---------------------------------------------------------- *
 *  Remove accidental twin elements and move ve-block-id back *
 *  to the original in-flow element (H1-H6, P, etc.)          *
 * ---------------------------------------------------------- */
    _cleanUpTwins() {
        const norm = s => (s || '').replace(/\s+/g, ' ').trim();

        /* handle legacy “dyn-content” clones */
        document.querySelectorAll('.dyn-content[data-ve-block-id]').forEach(clone => {
            const host = clone.closest('section[data-ve-section-id]');
            const real = host && host.querySelector(
                'h1,h2,h3,h4,h5,h6,p,div,span,li:not([data-ve-block-id])'
            );
            if (!real) return;

            real.dataset.veBlockId = clone.dataset.veBlockId;
            real.textContent = clone.textContent;
            clone.remove();
            dbg('[clean] moved ID to real node and deleted dyn-content');
        });

        /* existing duplicate-heading clean-up (old logic) */
        document.querySelectorAll('[data-ve-block-id]').forEach(el => {
            if (!/^h[1-6]$/.test(el.tagName)) return;
            const hostSection = el.closest('section[data-ve-section-id]') || document;
            const twin = hostSection.querySelector(
                    `${el.tagName}:not([data-ve-block-id])`);
            if (twin && norm(twin.textContent).startsWith('Raising Standards')) {
                twin.dataset.veBlockId = el.dataset.veBlockId;
                twin.textContent = el.textContent;
                el.remove();
            }
        });
        dbg('[clean] twin sweep finished');
    }



    async uploadImage() {
        const fileInput = document.getElementById('image-upload');
        const file = fileInput.files[0];

        if (!file) { this.showNotification('Please select an image file first', 'error'); return; }
        if (!file.type.startsWith('image/')) { this.showNotification('Please select a valid image file', 'error'); return; }
        if (file.size > 4 * 1024 * 1024) { this.showNotification('Image file is too large. Please select a file under 4 MB', 'error'); return; }

        const progressDiv = document.getElementById('upload-progress');
        const progressFill = progressDiv?.querySelector('.progress-fill');
        const progressText = progressDiv?.querySelector('.progress-text');
        const uploadBtn = document.getElementById('upload-btn');

        try {
            if (progressDiv) progressDiv.style.display = 'block';
            if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = 'Uploading…'; }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'content-images');

            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', VisualEditor.IMAGE_UPLOAD_URL, true);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = (e.loaded / e.total) * 100;
                        if (progressFill) progressFill.style.width = `${pct}%`;
                        if (progressText) progressText.textContent = `Uploading… ${Math.round(pct)}%`;
                    }
                };

                xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
                    ? resolve(JSON.parse(xhr.responseText))
                    : reject(new Error(`Upload failed: HTTP ${xhr.status}`));

                xhr.onerror = () => reject(new Error('Network error while uploading'));
                xhr.send(formData);
            });

            if (progressFill) progressFill.style.width = '100%';
            if (progressText) progressText.textContent = 'Upload complete!';
            document.getElementById('content-image').value = result.url;

            const altInput = document.getElementById('image-alt');
            if (altInput && !altInput.value) {
                altInput.value = result.url.split('/').pop()
                    .replace(/\.[^.]+$/, '')
                    .replace(/[-_]+/g, ' ');
            }

            const previewBox = document.getElementById('image-preview');
            if (previewBox) {
                const img = previewBox.querySelector('img');
                if (img) img.src = result.thumb || result.url;
                previewBox.style.display = 'block';
            }

            this.showNotification('Image uploaded successfully ✔', 'success');
            fileInput.value = '';

        } catch (err) {
            console.error('Upload error:', err);
            this.showNotification(`Failed to upload image: ${err.message}`, 'error');

        } finally {
            setTimeout(() => {
                if (progressDiv) progressDiv.style.display = 'none';
                if (progressFill) progressFill.style.width = '0%';
                if (progressText) progressText.textContent = 'Uploading…';
                if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Image'; }
            }, 2000);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'}; color: white; padding: 15px 25px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10003; animation: slideDown 0.3s ease;`;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    openImageBrowser() {
        document.getElementById('image-browser').style.display = 'block';
        this.imgPage = 1;
        this.loadImages();
    }

    async loadImages() {
        const grid = document.getElementById('image-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="loading-spinner"></div>';
        const search = encodeURIComponent(this.imgSearch || "");
        const sort = this.imgSort || "newest";
        fetch(`/api/content-manager?operation=list-images&page=${this.imgPage}&search=${search}&sort=${sort}`)
            .then(res => res.json())
            .then(data => {
                this.imgTotalPage = data.totalPages;
                grid.innerHTML = '';
                data.images.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'image-item';
                    const img = safeImg(document.createElement('img'));
                    img.src = item.thumb;
                    img.alt = item.name;
                    img.dataset.fullUrl = item.url;
                    div.appendChild(img);
                    div.addEventListener('click', () => {
                        grid.querySelectorAll('.image-item.selected').forEach(el => el.classList.remove('selected'));
                        div.classList.add('selected');
                        document.getElementById('content-image').value = item.url;
                        const previewBox = document.getElementById('image-preview');
                        previewBox.querySelector('img').src = item.thumb || item.url;
                        previewBox.style.display = 'block';
                        const altInput = document.getElementById('image-alt');
                        if (!altInput.value) altInput.value = item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
                        document.getElementById('image-browser').style.display = 'none';
                    });
                    grid.appendChild(div);
                });
                document.getElementById('prev-page').disabled = this.imgPage <= 1;
                document.getElementById('next-page').disabled = this.imgPage >= this.imgTotalPage;
                document.getElementById('page-info').textContent = `Page ${this.imgPage}`;
            })
            .catch(error => {
                console.error('Error loading images:', error);
                grid.innerHTML = '<div class="error-message">Failed to load images</div>';
            });
    }

    async ensureSortableLoaded() {
        if (window.Sortable) return;
        const mod = await import('https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/+esm');
        window.Sortable = mod.Sortable || mod.default;
        console.log('[VE] SortableJS loaded');
    }

    async loadSectionOrder() {
        try {
            const currentPage = this.currentPage.replace(/^\//, '') || 'index';
            const response = await fetch(`/api/content-manager?operation=get-order&page=${currentPage}`);
            const data = await response.json();
            this.sectionOrder = data.order || [];
            console.log('Loaded section order:', this.sectionOrder);
        } catch (error) {
            console.error('Failed to load section order:', error);
            this.sectionOrder = [];
        }
    }

    applySectionOrder() {
        if (!this.sectionOrder.length) return;
        const parent = document.querySelector('main');
        if (!parent) { console.warn('[VE] <main> not found – cannot apply order'); return; }
        const allSections = Array.from(parent.querySelectorAll('main > [data-ve-section-id]'));
        if (!allSections.length) { console.log('[VE] No reorderable sections on this page'); return; }
        const lookup = new Map(allSections.map(sec => [sec.dataset.veSectionId, sec]));
        const anchor = document.createComment('ve-order-anchor');
        if (allSections[0]) parent.insertBefore(anchor, allSections[0]); else parent.appendChild(anchor);
        const frag = document.createDocumentFragment();
        this.sectionOrder.forEach(id => {
            if (lookup.has(id)) {
                frag.appendChild(lookup.get(id));
                lookup.delete(id);
            }
        });
        lookup.forEach(sec => frag.appendChild(sec));
        parent.insertBefore(frag, anchor);
        anchor.remove();
        console.log('[VE] Applied non-destructive section order (containers included).');
    }

    scanForSections() {
        document.querySelectorAll('.ve-reorderable').forEach(el => el.classList.remove('ve-reorderable'));
        this.reorderableSecs = Array.from(document.querySelectorAll('main > [data-ve-section-id]'));
        this.reorderableSecs.forEach(sec => sec.classList.add('ve-reorderable'));
        console.log(`[VE] Found ${this.reorderableSecs.length} reorderable top-level sections.`);
    }

    activateSectionDragging() {
        if (this.sortable || !this.reorderableSecs.length) return;
        this.reorderableSecs.forEach(section => {
            if (section.querySelector('.ve-drag-handle')) return;
            const handle = document.createElement('div');
            handle.className = 've-drag-handle';
            handle.innerHTML = '⇅';
            handle.title = 'Drag to reorder section';
            handle.setAttribute('aria-label', 'Drag handle for section reordering');
            if (getComputedStyle(section).position === 'static') {
                section.style.position = 'relative';
            }
            section.prepend(handle);
        });
        const container = document.querySelector('main') || document.body;
        this.sortable = Sortable.create(container, {
            handle: '.ve-drag-handle',
            draggable: '.ve-reorderable',
            animation: 150,
            ghostClass: 've-drag-ghost',
            chosenClass: 've-drag-chosen',
            dragClass: 've-drag-active',
            onStart: () => document.body.classList.add('ve-dragging'),
            onEnd: () => {
                document.body.classList.remove('ve-dragging');
                this.persistSectionOrder();
            }
        });
        console.log('[VE] Section dragging activated');
    }

    async persistSectionOrder() {
        const order = Array.from(document.querySelectorAll('main > .ve-reorderable')).map(el => el.dataset.veSectionId);
        const currentPage = this.currentPage.replace(/^\//, '') || 'index';
        try {
            const response = await fetch('/api/content-manager?operation=set-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetPage: currentPage, order })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            this.sectionOrder = result.order;
            this.showNotification('Section order saved ✔', 'success');
            console.log('[VE] Section order persisted:', result);
        } catch (err) {
            console.error('[VE] Failed to persist order:', err);
            this.showNotification('Could not save new order', 'error');
        }
    }
}




// Initialize visual editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VisualEditor();

});




/* ✦ Diagnostic helper – can be switched on/off ✦ */
const VE = { DEBUG: true };                 // toggle in console

function dbg(...args) {
    if (VE.DEBUG) console.log('%c[VE-DBG]', 'color:#7AB7FF;font-weight:bold;', ...args);
}

/* monkey-patch ↓ AFTER the class exists */
const _oldApplyOverride = VisualEditor.prototype.applyOverride;
VisualEditor.prototype.applyOverride = function (el, ov) {
    dbg('applyOverride →', ov.contentType, ov.targetSelector, el);
    return _oldApplyOverride.call(this, el, ov);
};


const _oldDone = VisualEditor.prototype._applyAndMigrateOverridesWithRetry;
VisualEditor.prototype._applyAndMigrateOverridesWithRetry = async function (max, delay) {
    await _oldDone.call(this, max, delay);
    window.dispatchEvent(new CustomEvent('ve-overrides-done'));
    dbg('🚩 ve-overrides-done event dispatched');
};



// Add slide animations
const slideAnimations = document.createElement('style');
slideAnimations.textContent = `
    @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideUp {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
    .ve-btn {
        display: inline-block; padding: 0.5em 1.2em; margin: 0 0.25em;
        border-radius: 4px; text-decoration: none; color: #fff;
        background: #007bff; transition: background 0.2s;
    }
    .ve-btn:hover, .ve-btn:focus { background: #0056b3; }
`;
document.head.appendChild(slideAnimations);