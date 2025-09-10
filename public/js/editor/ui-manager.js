/**
 * @fileoverview UI Manager for Visual Editor interface management
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Core UI management system for the visual editor interface:
 * - Modal creation and management
 * - Edit mode toggling and state management
 * - Element highlighting and selection
 * - Form generation and validation
 * - Image upload and preview functionality
 *
 * @security Integrates with admin authentication system
 * @performance Implements efficient DOM manipulation and event handling
 */

/* ====================================================================== */
/*                          UI MANAGER MODULE                            */
/* ====================================================================== *
 *   - Editable element detection and overlay creation
 *   - Form handling and validation
 *   - Image browser integration
 *   - Edit mode state management
 * @dependencies
 *   - editor-state.js: Global state management
 *   - image-browser.js: Image selection functionality
 * @exports UIManager class
 */

import { editorState } from './editor-state.js';
import { ImageBrowser } from './features/image-browser.js';

/* ====================================================================== */
/*                          UTILITY FUNCTIONS                            */
/* ====================================================================== */

/**
 * Utility Functions
 *
 * @description Helper functions for UI operations
 * @functions
 *   - uuidv4(): Generate unique identifiers for content blocks
 *   - ensureBlockIds(): Add data-ve-block-id to HTML elements
 */

const BUTTON_CSS = 'button aurora';

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function ensureBlockIds(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  ['p', 'img', 'a', 'h1','h2','h3','h4','h5','h6'].forEach(tag => {
    tmp.querySelectorAll(tag).forEach(el => {
      if (!el.hasAttribute('data-ve-block-id')) {
        el.setAttribute('data-ve-block-id', uuidv4());
      }
    });
  });
  return tmp.innerHTML;
}

/* ====================================================================== */
/*                          UI MANAGER CLASS                             */
/* ====================================================================== */

/**
 * UIManager Class
 *
 * @description Main class for managing visual editor UI components
 * @constructor
 *   @param {Object} callbacks - Event callbacks for editor operations
 *   @param {Object} overrideEngine - Optional engine override for testing
 * @properties
 *   - editableElements: Array of detected editable elements
 *   - dom: DOM element references cache
 *   - imageBrowser: Image selection component instance
 * @methods
 *   - init(): Initialize the UI manager
 *   - initialize(): Create core UI components
 *   - refreshEditableElements(): Scan for editable content
 */

export class UIManager {
    constructor(callbacks, overrideEngine = null) {
        this.callbacks = callbacks;
        this.overrideEngine = overrideEngine;
        this.editableElements = [];
        this.dom = {};
        this.imageBrowser = new ImageBrowser({ onSelect: item => this.handleImageSelect(item) });
        editorState.on('editModeChange', m => this.onEditModeChange(m));
        editorState.on('activeEditorChange', ed => this.onActiveEditorChange(ed));
    }

    init() {
        console.log('[VE] UIManager initializing...');
        // Initialize image browser if it has an init method
        if (this.imageBrowser && typeof this.imageBrowser.init === 'function') {
            this.imageBrowser.init();
        }
        this.initialize(); // ✅ FIX: Call initialize to create toggle button and modal
        this.refreshEditableElements();
    }

    initialize() {
        this.loadStyles();
        this.createToggle();
        this.createModal();
    }

    loadStyles() {
        if (!document.getElementById('ve-style')) {
            const link = document.createElement('link');
            link.id = 've-style';
            link.rel = 'stylesheet';
            link.href = '/editor.css';
            document.head.appendChild(link);
        }
    }

    createToggle() {
        const btn = document.createElement('button');
        btn.id = 'edit-mode-toggle';
        btn.className = BUTTON_CSS;
        btn.textContent = 'Edit Mode';
        btn.addEventListener('click', () => this.callbacks.onToggle());
        document.body.appendChild(btn);
    }

    createModal() {
        const tpl = document.getElementById('ve-editor-modal-template');
        if (!tpl) { console.error('[VE] modal template missing'); return; }
        const frag = tpl.content.cloneNode(true);
        document.body.appendChild(frag);
        this.dom.modal = document.getElementById('editor-modal');
        this.dom.imageBrowser = this.dom.modal.querySelector('#image-browser');
        this.dom.modal.querySelector('#close-modal').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('#save-btn').addEventListener('click', () => this.callbacks.onSave(this.getFormData()));
        this.dom.modal.querySelector('#preview-btn').addEventListener('click', () => this.callbacks.onPreview(this.getFormData()));
        this.dom.modal.querySelector('#restore-btn').addEventListener('click', () => this.callbacks.onRestore());
        this.dom.modal.querySelector('#upload-btn').addEventListener('click', () => this.callbacks.onUpload());
        this.dom.modal.querySelector('#browse-btn').addEventListener('click', () => this.imageBrowser.open(this.dom.imageBrowser));

        // Button management event listeners
        this.setupButtonManagement();
    }

    setupButtonManagement() {
        const modal = this.dom.modal;

        // Add button functionality
        modal.querySelector('#add-text-button').addEventListener('click', () => {
            modal.querySelector('#new-button-form').style.display = 'block';
            modal.querySelector('#add-text-button').style.display = 'none';
        });

        // Cancel new button
        modal.querySelector('#cancel-new-button').addEventListener('click', () => {
            modal.querySelector('#new-button-form').style.display = 'none';
            modal.querySelector('#add-text-button').style.display = 'block';
            this.clearButtonForm();
        });

        // Save new button
        modal.querySelector('#save-new-button').addEventListener('click', () => {
            this.addTextButton();
        });
    }

    addTextButton() {
        const modal = this.dom.modal;
        const buttonText = modal.querySelector('#new-button-text').value.trim();
        const buttonUrl = modal.querySelector('#new-button-url').value.trim();

        if (!buttonText || !buttonUrl) {
            alert('Please enter both button text and URL');
            return;
        }

        // Add button to the list
        this.renderTextButton(buttonText, buttonUrl);

        // Hide form and clear inputs
        modal.querySelector('#new-button-form').style.display = 'none';
        modal.querySelector('#add-text-button').style.display = 'block';
        this.clearButtonForm();
    }

    renderTextButton(text, url, index = null) {
        const modal = this.dom.modal;
        const buttonsList = modal.querySelector('#text-buttons-list');

        const buttonItem = document.createElement('div');
        buttonItem.className = 'text-button-item';
        buttonItem.innerHTML = `
            <div class="text-button-info">
                <div class="button-text">${text}</div>
                <div class="button-url">${url}</div>
            </div>
            <div class="text-button-actions">
                <button type="button" class="btn btn-danger btn-sm remove-text-button">Remove</button>
            </div>
        `;

        // Add remove functionality
        buttonItem.querySelector('.remove-text-button').addEventListener('click', () => {
            buttonItem.remove();
        });

        buttonsList.appendChild(buttonItem);
    }

    clearButtonForm() {
        const modal = this.dom.modal;
        modal.querySelector('#new-button-text').value = '';
        modal.querySelector('#new-button-url').value = '';
    }

    onEditModeChange(val) {
        console.log(`[VE] onEditModeChange called with val: ${val}`);
        document.body.classList.toggle('ve-edit-active', val);
        const btn = document.getElementById('edit-mode-toggle');
        if (btn) btn.textContent = val ? 'Exit Edit' : 'Edit Mode';

        if (val) {
            // When entering edit mode, scan for elements and add overlays.
            const elements = this.scanEditableElements();
            console.log(`[VE] Found ${elements.length} editable elements:`, elements);
            this.addOverlays(elements);
            this.disableLinks();
        } else {
            // When exiting, remove all UI.
            this.removeOverlays();
            this.enableLinks();
        }
    }

    onActiveEditorChange(ed) {
        if (ed) this.openModal(ed); else this.closeModal();
    }

    // This function MUST find all editable types.
    scanEditableElements() {
        const elements = new Set();
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p:not(.no-edit)',
            '.editable',
            'img:not(.no-edit)',
            `a.${BUTTON_CSS.replace(/\s/g, '.')}`,
            'li:not(.no-edit):not(.main-nav li):not(footer li)',  // ✅ FIXED: Exclude navigation and footer li elements to prevent duplicates
            'header a',  // ✅ NEW: Include header links
            'footer a',  // ✅ NEW: Include footer links
            '.main-nav a'  // ✅ NEW: Include navigation links for editing (only the <a> tags, not <li>)
        ];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                // ✅ UPDATED: Modified exclusion logic for context-aware editing
                // Exclude editor UI elements only
                if (el.closest('.ve-no-edit, #editor-modal, #edit-mode-toggle')) return;

                // ✅ CRITICAL FIX: Exclude ALL elements inside dynamic sections from static editing
                // This prevents the static editor from interfering with dynamic content
                if (el.closest('.dynamic-section-container')) return;

                // Exclude buttons that were dynamically added by the text editing system
                if (el.dataset.veTextButton === 'true') return;
                elements.add(el);
            });
        });
        return Array.from(elements);
    }

    // ✅ NEW: Refresh editable elements after dynamic content changes
    refreshEditableElements() {
        if (!editorState.isEditMode) return;

        console.log('[VE] Refreshing editable elements after dynamic content change...');

        // Remove existing overlays
        this.removeOverlays();

        // Rescan and add overlays to new elements
        const elements = this.scanEditableElements();
        this.addOverlays(elements);

        console.log(`[VE] Refreshed ${elements.length} editable elements.`);
    }

    addOverlays(elements) {
        console.log(`[VE] addOverlays called with ${elements.length} elements`);
        elements.forEach((el) => {
            const type = this.callbacks.getType(el);

            // ✅ SKIP: Don't add static overlays to dynamic sections - they have their own overlays
            const isDynamicSection = el.closest('.dynamic-section-container');
            if (isDynamicSection && el.hasAttribute('data-ve-section-id')) {
                return; // Dynamic section has dedicated overlay
            }

            const target = this.getOverlayMount(el, type);
            if (target.querySelector(':scope > .edit-overlay')) {
                return; // Already has overlay
            }

            const overlay = document.createElement('div');
            overlay.className = 'edit-overlay';

            // ✅ NEW: Add context information to overlay
            const context = this.overrideEngine?.getElementContext ?
                           this.overrideEngine.getElementContext(el) : 'main';
            const contextLabel = this.getContextLabel(context);
            overlay.setAttribute('data-context', contextLabel);

            overlay.innerHTML = `<div class="edit-controls"><button class="edit-btn">✏️ Edit</button></div>`;
            overlay.querySelector('.edit-btn').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.callbacks.onEdit(el);
            });

            if (getComputedStyle(target).position === 'static') {
                target.style.position = 'relative';
            }
            target.appendChild(overlay);
        });
    }

    getOverlayMount(element, type) {
        if (type === 'image') {
            if (!element.parentElement?.classList.contains('ve-img-wrap')) {
                const wrap = document.createElement('span');
                wrap.className = 've-img-wrap';
                element.parentNode.insertBefore(wrap, element);
                wrap.appendChild(element);
            }
            return element.parentElement;
        }
        return element;
    }

    removeOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        document.querySelectorAll('.ve-img-wrap').forEach(w => {
            if (w.parentNode) w.replaceWith(...w.childNodes);
        });
    }

    disableLinks() {
        document.querySelectorAll('a').forEach(a => {
            // ✅ FIXED: Allow navigation links to be disabled for editing
            // Only exclude editor UI elements, not navigation
            if (a.closest('.ve-no-edit,#editor-modal,#edit-mode-toggle')) return;
            a.dataset.originalHref = a.href;
            a.href = 'javascript:void(0)';
        });
    }

    enableLinks() {
        document.querySelectorAll('a[data-original-href]').forEach(a => {
            a.href = a.dataset.originalHref;
            a.removeAttribute('data-original-href');
        });
    }

    openModal(ed) {
        const { element, type, canRestore } = ed;

        // ✅ NEW: Get context information for visual indicators
        const context = this.overrideEngine?.getElementContext ?
                       this.overrideEngine.getElementContext(element) : 'main';

        // ✅ NEW: Create context-aware title and styling
        const contextLabel = this.getContextLabel(context);
        const contextIcon = this.getContextIcon(context);

        this.dom.modal.querySelector('#modal-title').innerHTML =
            `${contextIcon} Edit ${type} <span class="context-badge context-${context}">${contextLabel}</span>`;

        // ✅ NEW: Add context class to modal for styling
        this.dom.modal.className = `ve-modal-container context-${context}`;

        this.dom.modal.querySelector('#content-type').value = type;
        ['text','html','image','link'].forEach(id => {
            const g = this.dom.modal.querySelector(`#${id}-group`);
            if (g) g.style.display = id===type? 'block':'none';
        });

        // Show/hide button management for text elements
        const buttonManagement = this.dom.modal.querySelector('.text-button-management');
        if (buttonManagement) {
            buttonManagement.style.display = type === 'text' ? 'block' : 'none';
        }

        // ✅ NEW: Hide button functionality for navigation and footer links
        if (type === 'link' && (context === 'nav' || context === 'footer')) {
            const buttonCheckbox = this.dom.modal.querySelector('#link-is-button');
            if (buttonCheckbox && buttonCheckbox.parentElement) {
                buttonCheckbox.parentElement.style.display = 'none';
            }
        } else if (type === 'link') {
            // Show button functionality for main content links
            const buttonCheckbox = this.dom.modal.querySelector('#link-is-button');
            if (buttonCheckbox && buttonCheckbox.parentElement) {
                buttonCheckbox.parentElement.style.display = 'block';
            }
        }

        this.fillForm(element, type);
        this.dom.modal.querySelector('#restore-btn').disabled = !canRestore;
        this.dom.modal.style.display = 'block';
    }

    // ✅ NEW: Get user-friendly context label
    getContextLabel(context) {
        const labels = {
            'header': 'Header',
            'footer': 'Footer',
            'nav': 'Navigation',
            'main': 'Main Content'
        };
        return labels[context] || 'Content';
    }

    // ✅ NEW: Get context-specific icon
    getContextIcon(context) {
        const icons = {
            'header': '🔝',
            'footer': '🔻',
            'nav': '🧭',
            'main': '📄'
        };
        return icons[context] || '✏️';
    }

    fillForm(el, type) {
        const modal = this.dom.modal;
        const content = this.callbacks.getOriginalContent(el, type);

        switch (type) {
            case 'text':
                // Handle both old string format and new object format
                if (typeof content === 'string') {
                    modal.querySelector('#content-text').value = content;
                    this.loadExistingTextButtons(el);
                } else {
                    // Use the editable text (which has newlines instead of <br> tags)
                    modal.querySelector('#content-text').value = content.text || '';
                    this.loadTextButtonsFromData(content.buttons || []);

                    // Store HTML formatting info for later use
                    if (content.isHTML) {
                        modal.dataset.isHtmlContent = 'true';
                        modal.dataset.originalHtml = content.originalHTML || '';
                        console.log(`[VE-HTML] Editing HTML content. Original: "${content.originalHTML}", Editable: "${content.text}"`);
                    } else {
                        modal.dataset.isHtmlContent = 'false';
                        delete modal.dataset.originalHtml;
                    }
                }
                break;
            case 'html':
                modal.querySelector('#content-html').value = content;
                break;
            case 'image':
                modal.querySelector('#content-image').value = content.src;
                modal.querySelector('#image-alt').value = content.alt;
                break;
            case 'link':
                modal.querySelector('#link-url').value = content.href;
                modal.querySelector('#link-text').value = content.text;
                modal.querySelector('#link-is-button').checked = el.classList.contains(BUTTON_CSS.split(/\s+/)[0]);
                break;
        }
    }

    loadExistingTextButtons(element) {
        const modal = this.dom.modal;
        const buttonsList = modal.querySelector('#text-buttons-list');

        // Clear existing buttons
        buttonsList.innerHTML = '';

        // Find any existing buttons that are siblings after this text element
        let nextSibling = element.nextElementSibling;
        while (nextSibling && nextSibling.classList && nextSibling.classList.contains('button')) {
            const buttonText = nextSibling.textContent.trim();
            const buttonUrl = nextSibling.href || '#';
            this.renderTextButton(buttonText, buttonUrl);
            nextSibling = nextSibling.nextElementSibling;
        }
    }

    loadTextButtonsFromData(buttons) {
        const modal = this.dom.modal;
        const buttonsList = modal.querySelector('#text-buttons-list');

        // Clear existing buttons
        buttonsList.innerHTML = '';

        // Load buttons from data
        buttons.forEach(button => {
            this.renderTextButton(button.text, button.url);
        });
    }

    getFormData() {
        const type = this.dom.modal.querySelector('#content-type').value;
        switch(type){
            case 'text':
                const buttons = this.getTextButtons();
                const textValue = this.dom.modal.querySelector('#content-text').value;
                const isHtmlContent = this.dom.modal.dataset.isHtmlContent === 'true';

                console.log(`[VE-DBG] getFormData() - text type, buttons:`, buttons, `isHTML: ${isHtmlContent}`);

                return {
                    text: textValue,
                    buttons: buttons,
                    isHTML: isHtmlContent
                };
            case 'html':
                return { text: ensureBlockIds(this.dom.modal.querySelector('#content-html').value) };
            case 'image':
                return { image: this.dom.modal.querySelector('#content-image').value, text: this.dom.modal.querySelector('#image-alt').value };
            case 'link':
                const linkData = {
                    href: this.dom.modal.querySelector('#link-url').value,
                    text: this.dom.modal.querySelector('#link-text').value
                };

                // ✅ NEW: Only include isButton for main content links, not nav/footer
                const buttonCheckbox = this.dom.modal.querySelector('#link-is-button');
                if (buttonCheckbox && buttonCheckbox.parentElement.style.display !== 'none') {
                    linkData.isButton = buttonCheckbox.checked;
                }

                return linkData;
            default: return {};
        }
    }

    getTextButtons() {
        const modal = this.dom.modal;
        const buttonItems = modal.querySelectorAll('.text-button-item');
        console.log(`[VE-DBG] getTextButtons() - found ${buttonItems.length} button items:`, buttonItems);
        const buttons = [];

        buttonItems.forEach((item, index) => {
            const text = item.querySelector('.button-text').textContent;
            const url = item.querySelector('.button-url').textContent;
            console.log(`[VE-DBG] Button ${index + 1}: text="${text}", url="${url}"`);
            buttons.push({ text, url });
        });

        console.log(`[VE-DBG] getTextButtons() returning:`, buttons);
        return buttons;
    }

    closeModal() { if(this.dom.modal) this.dom.modal.style.display='none'; }

    handleImageSelect(item) {
        const modal = this.dom.modal;
        modal.querySelector('#content-image').value = item.url;
        const img = modal.querySelector('#image-preview img');
        img.src = item.thumb || item.url;
        modal.querySelector('#image-preview').style.display = 'block';
        if(!modal.querySelector('#image-alt').value) modal.querySelector('#image-alt').value = item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    }

    showNotification(msg,type='info') {
        const n=document.createElement('div');
        n.className=`ve-notification ve-${type}`;
        n.textContent=msg;
        document.body.appendChild(n);
        setTimeout(()=>n.remove(),3000);
    }

    /* ------------------------------------------------------------------ */
    /* Enhanced Dynamic Section Overlays (Phase 1 Integration)            */
    /* ------------------------------------------------------------------ */

    addDynamicPageOverlay() {
        console.log('[VE] Adding dynamic page content overlay...');

        // Only add on dynamic pages
        if (!document.body.classList.contains('dynamic-page')) return;

        const pageContent = document.querySelector('#pageContent .two-col-content');
        if (!pageContent || pageContent.querySelector(':scope > .page-edit-overlay')) {
            return; // No content or already has overlay
        }

        // Get current page slug from URL
        const pathParts = window.location.pathname.split('/');
        const slug = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

        const overlay = document.createElement('div');
        overlay.className = 'page-edit-overlay';

        overlay.innerHTML = `
            <div class="page-edit-controls">
                <button class="page-edit-btn primary" data-action="edit-page" title="Edit this page's content">
                    ✏️ Edit Page Content
                </button>
            </div>
        `;

        const editBtn = overlay.querySelector('[data-action="edit-page"]');
        editBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();

            // Route to admin.html with page slug for editing
            const adminUrl = `/admin.html?editPage=${encodeURIComponent(slug)}`;
            console.log(`[VE] Opening admin panel to edit page: ${slug}`);
            this.showNotification('Opening admin panel to edit page content...', 'info');
            window.open(adminUrl, '_blank');
        });

        // Ensure section is positioned for overlay
        if (getComputedStyle(pageContent).position === 'static') {
            pageContent.style.position = 'relative';
        }

        pageContent.appendChild(overlay);
    }

    addDynamicSectionOverlays() {
        console.log('[VE] Adding dynamic section overlays...');
        document.querySelectorAll('[data-ve-section-id]').forEach(section => {
            if (section.querySelector(':scope > .dyn-edit-overlay')) {
                return; // Already has overlay
            }

            // ✅ RESTRICTION: Only add overlays to dynamic sections (not static sections)
            // Dynamic sections are inside dynamic-section-container elements
            const isDynamicSection = section.closest('.dynamic-section-container');
            if (!isDynamicSection) {
                return; // Static section
            }

            // ✅ NEW: Skip empty container elements - only add overlays to sections with actual content
            const hasContent = section.children.length > 0 &&
                              !section.matches('#dynamicSectionsTop, #dynamicSectionsMiddle, #dynamicSections');
            if (!hasContent) {
                return; // Empty container
            }

            // ✅ SAFETY: Skip sections that are currently being edited in visual editor
            if (section.dataset.veManaged === 'true') {
                return; // Being edited
            }

            // ✅ SAFETY: Check if section has any child elements being edited
            const hasActiveEdits = section.querySelector('[data-ve-managed="true"]');
            if (hasActiveEdits) {
                return; // Has active edits
            }

            const overlay = document.createElement('div');
            overlay.className = 'dyn-edit-overlay';

            // Enhanced contextual buttons
            const sectionId = section.dataset.veSectionId;
            const currentPage = editorState.currentPage;

            overlay.innerHTML = `
                <div class="dyn-edit-controls">
                    <button class="dyn-edit-btn primary" data-action="edit-content" title="Edit this section's content">
                        ✏️ Edit Content
                    </button>
                    <button class="dyn-edit-btn secondary" data-action="add-after" title="Add a new section after this one">
                        ➕ Add Section
                    </button>
                </div>
            `;

            // ✅ FIX: Attach event listeners to individual buttons, not the overlay
            const editBtn = overlay.querySelector('[data-action="edit-content"]');
            const addBtn = overlay.querySelector('[data-action="add-after"]');

            editBtn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();

                let adminUrl = `/admin.html?slug=${encodeURIComponent(currentPage)}`;
                adminUrl += `&editSection=${encodeURIComponent(sectionId)}`;
                console.log(`[VE] Opening admin panel to edit section: ${sectionId}`);
                this.showNotification('Opening admin panel for section editing...', 'info');
                window.open(adminUrl, '_blank');
            });

            addBtn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();

                let adminUrl = `/admin.html?slug=${encodeURIComponent(currentPage)}`;
                adminUrl += `&addAfter=${encodeURIComponent(sectionId)}`;
                console.log(`[VE] Opening admin panel to add section after: ${sectionId}`);
                this.showNotification('Opening admin panel to add new section...', 'info');
                window.open(adminUrl, '_blank');
            });

            // Ensure section is positioned for overlay
            if (getComputedStyle(section).position === 'static') {
                section.style.position = 'relative';
            }

            section.appendChild(overlay);
        });
    }

    removeDynamicPageOverlay() {
        console.log('[VE] Removing dynamic page overlay...');
        document.querySelectorAll('.page-edit-overlay').forEach(overlay => {
            overlay.remove();
        });
    }

    removeDynamicSectionOverlays() {
        console.log('[VE] Removing dynamic section overlays...');
        document.querySelectorAll('.dyn-edit-overlay').forEach(overlay => {
            overlay.remove();
        });
    }

    // ✅ NEW: Refresh editable elements after dynamic content changes
    refreshEditableElements() {
        if (!editorState.isEditMode) return;

        console.log('[VE] Refreshing editable elements after dynamic content change...');

        // ✅ SAFETY: Check for conflicts before refreshing
        const activeEditor = editorState.activeEditor;
        if (activeEditor && activeEditor.element) {
            console.log('[VE] Active editor detected, deferring refresh to prevent conflicts');
            setTimeout(() => this.refreshEditableElements(), 1000);
            return;
        }

        // Remove existing overlays
        this.removeOverlays();
        this.removeDynamicPageOverlay();
        this.removeDynamicSectionOverlays();

        // Rescan and add overlays to new elements
        const elements = this.scanEditableElements();
        this.addOverlays(elements);
        this.addDynamicPageOverlay();
        this.addDynamicSectionOverlays();

        console.log(`[VE] Refreshed ${elements.length} editable elements, page overlay, and dynamic section overlays.`);
    }

    // ✅ NEW: Safety method to check for editing conflicts
    hasEditingConflicts() {
        // Check if any elements are currently being edited
        const managedElements = document.querySelectorAll('[data-ve-managed="true"]');
        const activeModal = document.querySelector('#editor-modal[style*="block"]');

        return managedElements.length > 0 || activeModal !== null;
    }

    // ✅ NEW: Safe overlay addition with conflict detection
    safeAddOverlays(elements) {
        if (this.hasEditingConflicts()) {
            console.log('[VE] Editing conflicts detected, skipping overlay addition');
            return;
        }
        this.addOverlays(elements);
    }
}
