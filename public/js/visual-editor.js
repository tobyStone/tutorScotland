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
    // first retry with the full-res URL
    if (!this.dataset.fallbackAttempted && this.dataset.fullUrl) {
      this.dataset.fallbackAttempted = '1';
      this.src = this.dataset.fullUrl;
      return;
    }
    // second failure → placeholder
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
    static BUTTON_CSS = 'button aurora';
    static EDIT_ACTIVE_CLASS = 've-edit-active';

    /** Detect anchors that already look like site-buttons and upgrade them so
     *  the editor can treat them exactly like the ones it inserts itself. */
    upgradeLegacyButtons() {
        if (!VisualEditor.BUTTON_CSS.trim()) return;  // Guard against empty CSS

        const cssParts = VisualEditor.BUTTON_CSS.split(/\s+/);   // ['button','aurora']
        document.querySelectorAll('a').forEach(a => {
            // Skip if already processed or in navigation/header
            if (a.classList.contains('ve-btn')) return;
            if (a.closest('nav, header, #edit-mode-toggle, #editor-modal, .edit-overlay')) return;
            if (a.closest('.ve-no-edit')) return;
            if (a.closest('.edit-overlay')) return;  // Skip buttons being edited

            // Check if it matches our button styling
            const isBtn = cssParts.every(c => a.classList.contains(c));
            if (!isBtn) return;

            // Upgrade the button
            a.classList.add('ve-btn');
            if (!a.dataset.veButtonId) {
                a.dataset.veButtonId = 
                    (self.crypto?.randomUUID?.() ?? `ve-btn-${Date.now()}-${Math.random()}`);
            }

            // Register as editable if not already
            const selector = this.generateSelector(a);
            if (!this.editableElements.some(e => e.element === a)) {
                this.editableElements.push({ element: a, selector, type: 'link' });
            }
        });
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

        /** Image‑browser state */
        this.imgSearch = "";   // ⇠ non‑undefined defaults
        this.imgSort   = "newest";

        // ───── section-reorder state ───────────────────────────
        this.sortable          = null;   // SortableJS instance
        this.sectionOrder      = [];     // order pulled from DB
        this.reorderableSecs   = [];     // Node list cache

        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        /* 1️⃣ order first so overrides target the right elements */
        await this.loadSectionOrder();
        this.applySectionOrder();

        // 2️⃣ then normal overrides
        await this.loadContentOverrides();
        this.applyContentOverrides();

        // Initial admin check
        const isAdmin = await this.checkAdminStatus();
        if (isAdmin) {
            this.loadEditorStyles();
            this.createEditModeToggle();
            this.createEditorModal();
            this.setupKeyboardShortcuts();
            
            // Start polling for admin status every 10 minutes
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
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            const data = await response.json();
            const isAdmin = data.isAdmin || false;

            // If we were in edit mode but lost admin status, disable it
            if (!isAdmin && this.isEditMode) {
                this.disableEditMode();
                this.isEditMode = false;
                this.updateEditToggle();
            }

            return isAdmin;
        } catch (error) {
            console.error('Admin check failed:', error);
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
            const response = await fetch(`/api/content-manager?operation=overrides&page=${this.currentPage}`);
            const overrides = await response.json();

            overrides.forEach(override => {
                this.overrides.set(override.targetSelector, override);
            });
        } catch (error) {
            console.error('Failed to load content overrides:', error);
        }
    }

    applyContentOverrides() {
        this.overrides.forEach((ov, sel) =>
            document.querySelectorAll(sel).forEach(el => this.applyOverride(el, ov))
        );
    }

    applyOverride(element, override) {
        // upgrade old id-based selectors on the fly
        if(override.contentType==='link' &&
           override.targetSelector?.includes('data-ve-button-id')){
            const el = document.querySelector(override.targetSelector);
            if(el){
                const stable = this.getStableLinkSelector(el);
                this.overrides.set(stable, override);
                this.overrides.delete(override.targetSelector);
                override.targetSelector = stable;  // future saves reuse it
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
            case 'link':
                if (element.tagName === 'A') {
                    element.href = override.image;  // Using image field for URL
                    element.textContent = override.text;
                    if (element.dataset.originalHref !== undefined) {
                        element.dataset.originalHref = override.image;
                    }
                }
                break;
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

            // Enable section reordering
            await this.ensureSortableLoaded();
            this.scanForSections();
            this.activateSectionDragging();
        } else {
            this.disableEditMode();
        }
    }

    async enableEditMode() {
        // Add edit overlays to editable elements
        this.scanForEditableElements();
        this.addEditOverlays();

        // Disable links except in nav bar and header
        this.disableLinks();

        // Add visual indicator
        document.body.style.outline = '3px dashed #007bff';
        document.body.style.outlineOffset = '-3px';

        // Show edit instructions
        this.showEditInstructions();
    }

    disableEditMode() {
        // Remove edit overlays
        this.removeEditOverlays();

        // Re-enable links
        this.enableLinks();

        // Remove visual indicators
        document.body.style.outline = '';
        document.body.style.outlineOffset = '';

        // Hide instructions
        this.hideEditInstructions();

        // Disable section reordering
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
        document.querySelectorAll('.ve-drag-handle').forEach(h => h.remove());
    }

    disableLinks() {
        // Disable all links except those in nav bar, header, and admin controls
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            // Skip nav bar, header, and admin control links
            if (link.closest('nav, header, #edit-mode-toggle, #editor-modal, .edit-overlay')) {
                return;
            }

            // Store original href and disable link
            link.dataset.originalHref = link.href;
            link.href = 'javascript:void(0)';
            link.style.cursor = 'default';
            link.style.opacity = '0.6';

            // Add click prevention
            link.addEventListener('click', this.preventLinkClick, true);
        });
    }

    enableLinks() {
        // Re-enable all disabled links
        const links = document.querySelectorAll('a[data-original-href]');
        links.forEach(link => {
            link.href = link.dataset.originalHref;
            link.removeAttribute('data-original-href');
            link.style.cursor = '';
            link.style.opacity = '';

            // Remove click prevention
            link.removeEventListener('click', this.preventLinkClick, true);
        });
    }

    preventLinkClick(e) {
            // Allow clicks that originate in the visual-editor overlay
                if (e.target.closest('.edit-overlay')) return;
        
                e.preventDefault();
            e.stopPropagation();
            return false;
    }

    scanForEditableElements() {
        this.editableElements = [];
        this.upgradeLegacyButtons();  // Ensure legacy buttons are upgraded during scan
        
        // Define editable selectors
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p:not(.no-edit)',
            /* Lists: make every UL/OL editable unless explicitly opted-out */
            'ul:not(.no-edit):not(.ve-no-edit)',
            'ol:not(.no-edit):not(.ve-no-edit)',
            'a:not(.no-edit)',
            'img:not(.no-edit)',
            '.editable'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip elements inside admin controls
                if (!element.closest('#edit-mode-toggle, #editor-modal, .edit-overlay')) {
                    // Skip anything that sits inside a dynamic section
                    if (element.closest('.ve-no-edit')) return;
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
        /* 1️⃣  anchor individual buttons with their attribute */
        if (element.dataset.veButtonId) {
            return `[data-ve-button-id="${element.dataset.veButtonId}"]`;
        }

        /* 2️⃣  build a unique static path for block-level elements */
        const segments = [];
        let current = element;

        while (current && current.tagName !== 'BODY') {
            let seg = current.tagName.toLowerCase();

            /* id → done */
            if (current.id) {
                seg = `#${current.id}`;
                segments.unshift(seg);
                break;
            }

            /* first "real" class if any */
            const cls = [...current.classList]
                        .find(c => !c.startsWith('ve-') && c !== 'edit-overlay');
            if (cls) seg += `.${cls}`;

            /* add :nth-of-type when siblings share the tag */
            const parent = current.parentElement;
            if (parent) {
                const sibs = [...parent.children]
                             .filter(ch => ch.tagName === current.tagName);
                if (sibs.length > 1) {
                    seg += `:nth-of-type(${sibs.indexOf(current) + 1})`;
                }
            }

            segments.unshift(seg);

            /* stop if parent has an id (unique enough) */
            if (parent?.id) {
                segments.unshift(`#${parent.id}`);
                break;
            }
            current = parent;
        }
        return segments.join(' > ') || element.tagName.toLowerCase();
    }

    /** Build a selector that survives a re-generated data-ve-button-id.
     *  We temporarily strip the id so generateSelector() falls back to
     *  the structural path.  */
    getStableLinkSelector(el){
        if(!el) return '';
        const temp = el.dataset.veButtonId;
        delete el.dataset.veButtonId;
        const sel = this.generateSelector(el);
        if(temp) el.dataset.veButtonId = temp;      // restore
        return sel;
    }

    getElementType(element) {
        const tagName = element.tagName.toLowerCase();

        switch (tagName) {
            case 'img':
                return 'image';
            case 'a':
                return 'link';
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                return 'text';
            case 'ul':
            case 'ol':
            case 'li':
                return 'html';  // Always edit lists as HTML to preserve structure
            case 'p':
            case 'div':
            case 'span':
                return element.innerHTML.includes('<') ? 'html' : 'text';
            default:
                return 'text';
        }
    }

  
  

    addEditOverlays() {
        this.editableElements.forEach(({ element, selector, type }) => {
            let mount = element;
            if (type === 'link') {
                mount = element.closest('li') || element;
            }
            if (type === 'image') {
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

            // Ensure mount is a positioning context
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
        overlay.innerHTML = `
            <div class="edit-controls">
                <span class="edit-type">${type}</span>
                <button class="edit-btn" data-selector="${selector}" data-type="${type}">
                    ✏️ Edit
                </button>
            </div>
        `;

        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 123, 255, 0.1);
            border: 2px dashed #007bff;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s ease;
            border-radius: 4px;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
        `;

        const controls = overlay.querySelector('.edit-controls');
        controls.style.cssText = `
            position: absolute;
            top: -35px;
            left: 0;
            background: #007bff;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            pointer-events: auto;
            white-space: nowrap;
        `;

        const editBtn = overlay.querySelector('.edit-btn');
        editBtn.style.cssText = `
            background: #28a745;
            border: none;
            color: white;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        `;

        // Reveal on hover of the target; let CSS keep it visible once it's shown
        element.addEventListener('mouseenter', () => {
            if (this.isEditMode) overlay.style.opacity = '1';
        });

        // Hide *only* when we truly leave both the element *and* the overlay
        overlay.addEventListener('mouseleave', (e) => {
            if (!element.contains(e.relatedTarget)) {
                overlay.style.opacity = '0';
            }
        });

        // Edit button click
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openEditor(element, selector, type);
        });

        return overlay;
    }

    removeEditOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        // Reset cache – it will be rebuilt on next enableEditMode()
        this.editableElements = [];
    }

    showEditInstructions() {
        if (document.getElementById('edit-instructions')) return;

        const instructions = document.createElement('div');
        instructions.id = 'edit-instructions';
        instructions.innerHTML = `
            <div class="instructions-content">
                <h4>🎨 Edit Mode Active</h4>
                <p>Hover over elements to see edit controls. Click "Edit" to modify content.</p>
                <button id="close-instructions">×</button>
            </div>
        `;

        instructions.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(instructions);

        // Add event listener after element is in DOM
        const closeBtn = document.getElementById('close-instructions');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                instructions.remove();
            });
        }

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (instructions.parentNode) instructions.remove();
        }, 5000);
    }

    hideEditInstructions() {
        const instructions = document.getElementById('edit-instructions');
        if (instructions) instructions.remove();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + E to toggle edit mode
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.toggleEditMode();
            }

            // Escape to exit edit mode
            if (e.key === 'Escape' && this.isEditMode) {
                this.disableEditMode();
            }
        });
    }

    createEditorModal() {
        const modal = document.createElement('div');
        modal.id = 'editor-modal';
        
        // Add CSS for image wrapper
        const style = document.createElement('style');
        style.textContent = '.ve-img-wrap { position:relative; display:inline-block; }';
        document.head.appendChild(style);
        
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modal-title">Edit Content</h3>
                    <button id="close-modal" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <form id="content-form">
                        <div class="form-group">
                            <label for="content-type">Content Type:</label>
                            <select id="content-type" disabled>
                                <option value="text">Text</option>
                                <option value="html">HTML</option>
                                <option value="image">Image</option>
                                <option value="link">Link</option>
                            </select>
                        </div>

                        <div class="form-group" id="text-group">
                            <label for="content-text">Text Content:</label>
                            <textarea id="content-text" rows="4" placeholder="Enter text content..."></textarea>
                        </div>

                        <div class="form-group" id="html-group" style="display: none;">
                            <label for="content-html">HTML Content:</label>
                            <textarea id="content-html" rows="6" placeholder="Enter HTML content..."></textarea>
                            <small class="form-text text-muted">For lists, preserve the &lt;ul&gt;, &lt;ol&gt;, and &lt;li&gt; tags.</small>
                        </div>

                        <div class="form-group" id="image-group" style="display: none;">
                            <label for="content-image">Image URL:</label>
                            <div class="image-input-group">
                                <input type="url" id="content-image" placeholder="https://example.com/image.jpg">
                                <button type="button" id="browse-btn" class="btn btn-secondary">Browse Images</button>
                            </div>
                            <div id="image-preview" class="mt-2" style="display: none;">
                                <img src="" alt="Preview" style="max-width: 200px; max-height: 200px;">
                            </div>

                            <div class="upload-section">
                                <label for="image-upload">Or upload a new image:</label>
                                <input type="file" id="image-upload" accept="image/*">
                                <button type="button" id="upload-btn" class="btn btn-secondary">Upload Image</button>
                                <div id="upload-progress" style="display: none;">
                                    <div class="progress-bar">
                                        <div class="progress-fill"></div>
                                    </div>
                                    <span class="progress-text">Uploading...</span>
                                </div>
                            </div>

                            <label for="image-alt">Alt Text:</label>
                            <input type="text" id="image-alt" placeholder="Image description">
                        </div>

                        <div class="form-group" id="link-group" style="display: none;">
                            <label for="link-url">Link URL:</label>
                            <input type="url" id="link-url" placeholder="https://example.com">
                            <label for="link-text">Link Text:</label>
                            <input type="text" id="link-text" placeholder="Click here">
                            <div class="form-check mt-2">
                                <input type="checkbox" id="link-is-button" class="form-check-input">
                                <label for="link-is-button" class="form-check-label">Style as button</label>
                            </div>
                        </div>

                        <div class="form-group" id="button-group" style="display: none;">
                            <div class="alert alert-info">
                                <strong>Button Management</strong>
                                <p class="mb-0">Add or remove link buttons after this paragraph.</p>
                            </div>
                            <div class="button-preview mt-2">
                                <a href="#" class="ve-btn btn btn-primary">Button Preview</a>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" id="preview-btn" class="btn btn-secondary">Preview</button>
                            <button type="button" id="save-btn" class="btn btn-primary">Save Changes</button>
                            <button type="button" id="restore-btn" class="btn btn-warning">Restore Original</button>
                            <button type="button" id="add-btnlink" class="btn btn-success" style="display:none">Add Link Button</button>
                            <button type="button" id="del-btnlink" class="btn btn-danger" style="display:none">Remove Link Buttons</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Image Browser Modal -->
            <div id="image-browser" class="image-browser" style="display: none;">
                <div class="image-browser-header">
                    <h4>Browse Images</h4>
                    <button type="button" id="close-browser" class="close-btn">×</button>
                </div>
                <div class="image-browser-content">
                    <div class="image-browser-toolbar">
                        <input type="text" id="image-search" placeholder="Search images..." class="form-control">
                        <select id="image-sort" class="form-control">
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="name">Name</option>
                        </select>
                    </div>
                    <div id="image-grid" class="image-grid">
                        <div class="loading-spinner"></div>
                    </div>
                    <div id="image-pagination" class="image-pagination">
                        <button type="button" id="prev-page" class="btn btn-secondary" disabled>Previous</button>
                        <span id="page-info">Page 1</span>
                        <button type="button" id="next-page" class="btn btn-secondary">Next</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10002;
            display: none;
        `;

        this.addModalStyles();
        document.body.appendChild(modal);
        this.setupModalEvents();
    }

    addModalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #editor-modal .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
            }

            #editor-modal .modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            }

            #editor-modal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            #editor-modal .modal-header h3 {
                margin: 0;
                color: #333;
            }

            #editor-modal .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #editor-modal .modal-body {
                padding: 20px;
            }

            #editor-modal .form-group {
                margin-bottom: 20px;
            }

            #editor-modal label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
                color: #333;
            }

            #editor-modal input,
            #editor-modal textarea,
            #editor-modal select {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            }

            #editor-modal textarea {
                resize: vertical;
                font-family: monospace;
            }

            #editor-modal .form-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }

            #editor-modal .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            }

            #editor-modal .btn-primary {
                background: #007bff;
                color: white;
            }

            #editor-modal .btn-primary:hover {
                background: #0056b3;
            }

            #editor-modal .btn-secondary {
                background: #6c757d;
                color: white;
            }

            #editor-modal .btn-secondary:hover {
                background: #545b62;
            }

            #editor-modal .btn-warning {
                background: #ffc107;
                color: #212529;
            }

            #editor-modal .btn-warning:hover {
                background: #e0a800;
            }

            #editor-modal .upload-section {
                margin: 15px 0;
                padding: 15px;
                border: 2px dashed #ddd;
                border-radius: 4px;
                background: #f8f9fa;
            }

            #editor-modal .upload-section label {
                margin-bottom: 10px;
            }

            #editor-modal .progress-bar {
                width: 100%;
                height: 20px;
                background: #e9ecef;
                border-radius: 10px;
                overflow: hidden;
                margin: 10px 0 5px 0;
            }

            #editor-modal .progress-fill {
                height: 100%;
                background: #007bff;
                width: 0%;
                transition: width 0.3s ease;
            }

            #editor-modal .progress-text {
                font-size: 12px;
                color: #666;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* Image Browser Styles */
            .image-browser {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 800px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
            }

            .image-browser-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .image-browser-content {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }

            .image-browser-toolbar {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }

            .image-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .image-item {
                position: relative;
                aspect-ratio: 1;
                border-radius: 4px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s ease;
            }

            .image-item:hover {
                border-color: #007bff;
            }

            .image-item.selected {
                border-color: #28a745;
            }

            .image-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .image-item .image-name {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 4px 8px;
                font-size: 12px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .image-pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                margin-top: 20px;
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .image-input-group {
                display: flex;
                gap: 10px;
                margin-bottom: 10px;
            }

            .image-input-group input {
                flex: 1;
            }

            /* keep overlay visible whenever either the target OR the overlay itself is hovered */
            .ve-img-wrap:hover > .edit-overlay,
            .edit-overlay:hover {
                opacity: 1 !important;
            }

            /* Visual feedback for selected images */
            .image-item.selected {
                position: relative;
                border: 3px solid #28a745;
                border-radius: 4px;
            }

            .image-item.selected::after {
                content: '✓';
                position: absolute;
                right: 6px;
                top: 4px;
                font-size: 20px;
                color: #28a745;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }

            /* Section Reordering Styles */
            .ve-drag-handle {
                position: absolute;
                top: 10px;
                right: 10px;
                background: #007bff;
                color: #fff;
                padding: 6px 10px;
                border-radius: 6px;
                cursor: move;
                user-select: none;
                font-size: 16px;
                font-weight: bold;
                opacity: 0;
                transition: opacity 0.15s ease, transform 0.15s ease;
                z-index: 1001;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.2);
            }

            [data-ve-section-id]:hover .ve-drag-handle {
                opacity: 0.8;
                transform: scale(1.05);
            }

            .ve-drag-handle:hover {
                opacity: 1 !important;
                transform: scale(1.1) !important;
                background: #0056b3;
            }

            .ve-drag-ghost {
                opacity: 0.4;
                background: #c8ebfb !important;
                border: 2px dashed #007bff !important;
                transform: rotate(2deg);
            }

            .ve-drag-chosen {
                opacity: 0.8;
                transform: scale(1.02);
                box-shadow: 0 4px 12px rgba(0,123,255,0.3);
            }

            .ve-drag-active {
                opacity: 0.6;
                transform: rotate(-1deg);
            }

            .ve-dragging {
                cursor: grabbing !important;
            }

            .ve-dragging * {
                cursor: grabbing !important;
            }

            /* Enhanced visual feedback during drag */
            [data-ve-section-id] {
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }

            .ve-dragging [data-ve-section-id]:not(.ve-drag-chosen):not(.ve-drag-ghost) {
                opacity: 0.7;
            }
        `;
        document.head.appendChild(style);
    }

    setupModalEvents() {
        const modal = document.getElementById('editor-modal');
        const closeBtn = document.getElementById('close-modal');
        const backdrop = modal.querySelector('.modal-backdrop');
        const contentType = document.getElementById('content-type');
        const saveBtn = document.getElementById('save-btn');
        const previewBtn = document.getElementById('preview-btn');
        const restoreBtn = document.getElementById('restore-btn');
        const uploadBtn = document.getElementById('upload-btn');
        const addBtn = document.getElementById('add-btnlink');
        const delBtn = document.getElementById('del-btnlink');
        const buttonGroup = document.getElementById('button-group');

        // Close modal events
        closeBtn.addEventListener('click', () => this.closeModal());
        backdrop.addEventListener('click', () => this.closeModal());

        // Content type change
        contentType.addEventListener('change', () => this.updateFormFields());

        // Button events
        saveBtn.addEventListener('click', () => this.saveContent());
        previewBtn.addEventListener('click', () => this.previewContent());
        restoreBtn.addEventListener('click', () => this.restoreOriginal());
        uploadBtn.addEventListener('click', () => this.uploadImage());
        addBtn.addEventListener('click', () => this.injectButton());
        delBtn.addEventListener('click', () => this.removeButtons());

        const browseBtn = document.getElementById('browse-btn');
        const closeBrowser = document.getElementById('close-browser');
        const imageBrowser = document.getElementById('image-browser');
        const imageGrid = document.getElementById('image-grid');
        const imageSearch = document.getElementById('image-search');
        const imageSort = document.getElementById('image-sort');
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');

        let searchTimeout = null;

        browseBtn.addEventListener('click', async () => {
            // quick probe – ask for a single item in the standard folder
            const hasAny = await fetch(
                '/api/content-manager?operation=list-images&perPage=1&folder=content-images'
            )
            .then(r => r.ok ? r.json() : { total: 0 })
            .then(d => d.total > 0)
            .catch(() => false);

            if (hasAny) {
                this.openImageBrowser();
            } else {
                this.showNotification(
                    'No images in the library yet – upload one first!',
                    'info'
                );
            }
        });

        closeBrowser.addEventListener('click', () => imageBrowser.style.display = 'none');

        // Search handling with debounce
        imageSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            this.imgSearch = imageSearch.value.trim(); // keep state in sync 🔑
            searchTimeout = setTimeout(() => { this.imgPage = 1; this.loadImages(); }, 300);
        });

        // Sort handling
        imageSort.addEventListener('change', () => {
            this.imgSort = imageSort.value || "newest";
            this.imgPage = 1;
            this.loadImages();
        });

        // Pagination
        prevPage.addEventListener('click', () => {
            if (this.imgPage > 1) {
                this.imgPage--;
                this.loadImages();
            }
        });

        nextPage.addEventListener('click', () => {
            if (this.imgPage < this.imgTotalPage) {
                this.imgPage++;
                this.loadImages();
            }
        });

        // Keyboard navigation
        imageGrid.addEventListener('keydown', (e) => {
            const items = imageGrid.querySelectorAll('.image-item');
            const currentIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            
            switch (e.key) {
                case 'ArrowRight':
                    if (currentIndex < items.length - 1) {
                        items[currentIndex].classList.remove('selected');
                        items[currentIndex + 1].classList.add('selected');
                        items[currentIndex + 1].focus();
                    }
                    break;
                case 'ArrowLeft':
                    if (currentIndex > 0) {
                        items[currentIndex].classList.remove('selected');
                        items[currentIndex - 1].classList.add('selected');
                        items[currentIndex - 1].focus();
                    }
                    break;
                case 'Enter':
                    if (currentIndex >= 0) {
                        items[currentIndex].click();
                    }
                    break;
                case 'Escape':
                    imageBrowser.style.display = 'none';
                    break;
            }
        });
    }

    openEditor(element, selector, type) {
        if (type === 'link' && element.classList.contains('ve-btn')) {
            selector = this.getStableLinkSelector(element);
        }
        this.activeEditor = {
            element,
            selector,
            type,
            original: this.getOriginalContent(element, type)   // 🆕
        };

        const modal = document.getElementById('editor-modal');
        const title = document.getElementById('modal-title');
        const contentType = document.getElementById('content-type');
        const addBtn = document.getElementById('add-btnlink');
        const delBtn = document.getElementById('del-btnlink');
        const buttonGroup = document.getElementById('button-group');

        // Set modal title
        title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Content`;

        // Set content type
        contentType.value = type;
        this.updateFormFields();

        // Show/hide button management for paragraphs
        const isPara = element.tagName.toLowerCase() === 'p';
        addBtn.style.display = isPara ? 'inline-block' : 'none';
        delBtn.style.display = isPara ? 'inline-block' : 'none';
        buttonGroup.style.display = isPara ? 'block' : 'none';

        // Populate current content
        this.populateCurrentContent(element, type);

        // Set restore button state
        const restoreBtn = document.getElementById('restore-btn');
        if (restoreBtn) {
            restoreBtn.disabled = !this.overrides.has(selector);
        }

        // Show modal
        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('editor-modal');
        if (modal) {
            modal.style.display = 'none';
            this.cleanupEventListeners();
            if (!validateEditorState(this)) {
                recoverFromError(this);
            }
        }
    }

    updateFormFields() {
        const type = document.getElementById('content-type').value;

        // Hide all groups
        document.getElementById('text-group').style.display = 'none';
        document.getElementById('html-group').style.display = 'none';
        document.getElementById('image-group').style.display = 'none';
        document.getElementById('link-group').style.display = 'none';
        document.getElementById('button-group').style.display = 'none';

        // Show relevant group
        switch (type) {
            case 'text':
                document.getElementById('text-group').style.display = 'block';
                break;
            case 'html':
                document.getElementById('html-group').style.display = 'block';
                break;
            case 'image':
                document.getElementById('image-group').style.display = 'block';
                break;
            case 'link':
                document.getElementById('link-group').style.display = 'block';
                break;
            case 'button':
                document.getElementById('button-group').style.display = 'block';
                break;
        }
    }

    populateCurrentContent(element, type) {
        switch (type) {
            case 'text':
                // Clone element without overlay to get clean content
                const textClone = element.cloneNode(true);
                textClone.querySelectorAll('.edit-overlay').forEach(n => n.remove());
                document.getElementById('content-text').value = textClone.textContent.trim();
                break;
            case 'html':
                // Clone element without overlay to get clean content
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
                    // show the real URL (falls back to current href during preview)
                    const realHref = element.dataset.originalHref || element.href;
                    document.getElementById('link-url').value = realHref;

                    // Clone to get clean text content without edit overlay
                    const linkClone = element.cloneNode(true);
                    linkClone.querySelectorAll('.edit-overlay').forEach(n => n.remove());
                    document.getElementById('link-text').value = linkClone.textContent.trim();

                    // keep the "style as button" toggle in sync
                    const firstBtnClass = VisualEditor.BUTTON_CSS.split(/\s+/)[0]; // 'button'
                    document.getElementById('link-is-button').checked = 
                          element.classList.contains(firstBtnClass);
                }
                break;
            case 'button':
                // Clone to get clean text content without edit overlay
                const buttonClone = element.cloneNode(true);
                buttonClone.querySelectorAll('.edit-overlay').forEach(n => n.remove());
                document.getElementById('button-preview').innerHTML = buttonClone.innerHTML;
                break;
        }
    }

    async saveContent() {
        if (!this.activeEditor) return;

        const { element, selector, type } = this.activeEditor;

        if (type === 'link' && element.classList.contains('ve-btn')) {
            // 1️⃣ write the form values straight into the DOM
            const { image: url, text: label } = this.getFormData('link');
            element.href = url;
            element.textContent = label;

            // make the change persist past enableLinks()
            if (element.dataset.originalHref !== undefined) {
                element.dataset.originalHref = url;
            }

            /* 2️⃣ persist – paragraph when available, otherwise the anchor itself */
            const para = element.closest('p');

            if (para) {
                try {
                    const saved = await this.saveParagraphOverride(para);
                    this.applyOverride(para, saved);
                    this.closeModal();
                    this.showNotification('Button updated ✔', 'success');
                } catch (err) {
                    console.error('Failed to save paragraph override for button', err);
                    this.showNotification('Failed to save button update', 'error');
                }
            } else {
                /* fall-back: create / replace a normal link override */
                const stableSel = this.getStableLinkSelector(element);

                /* decide up-front whether we are updating (PUT) or creating (POST)  */
                const already = this.overrides.get(stableSel);
                const method  = 'POST';                               // API only knows POST
                const api     = '/api/content-manager?operation=override' +
                                (already ? ('&id=' + already._id) : '');

                try{
                    const resp = await fetch(api, {
                        method,
                        headers:{ 'Content-Type':'application/json' },
                        body: JSON.stringify({
                            targetPage    : this.currentPage,
                            targetSelector: stableSel,
                            contentType   : 'link',
                            image         : url,
                            text          : label,
                            originalContent: this.getOriginalContent(element,'link')
                        })
                    });
                    if(!resp.ok) throw new Error('network');

                    const ov = await resp.json();
                    this.overrides.set(stableSel, ov);        // idempotent
                    this.applyOverride(element, ov);
                    this.closeModal();
                    this.showNotification('Button updated ✔', 'success');
                }catch(err){
                    console.error('Failed to save link override for standalone button',err);
                    this.showNotification('Failed to save button update','error');
                }
            }
            return;
        }

        const contentData = this.getFormData(type);

        try {
            // Save to database - pass operation in query string for API compatibility
            const response = await fetch('/api/content-manager?operation=override', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetPage: this.currentPage,
                    targetSelector: selector,
                    contentType: type,
                    ...contentData,
                    originalContent: this.getOriginalContent(element, type)
                })
            });

            if (response.ok) {
                const override = await response.json();

                // Apply changes to element
                this.applyOverride(element, override);

                // Update local overrides
                this.overrides.set(selector, override);

                // Close modal
                this.closeModal();

                // Show success message
                this.showNotification('Content saved successfully!', 'success');
            } else {
                throw new Error('Failed to save content');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showNotification('Failed to save content', 'error');
        }
    }

    getFormData(type) {
        switch (type) {
            case 'text':
                return { text: document.getElementById('content-text').value };
            case 'html':
                return { text: document.getElementById('content-html').value };
            case 'image':
                return {
                    image: document.getElementById('content-image').value,
                    text: document.getElementById('image-alt').value
                };
            case 'link':
                return {
                    image: document.getElementById('link-url').value, // Using image field for URL
                    text: document.getElementById('link-text').value
                };
            case 'button':
                return { text: document.getElementById('button-preview').innerHTML };
            default:
                return {};
        }
    }

    getOriginalContent(element, type) {
        switch (type) {
            case 'text':
                return element.textContent;
            case 'html':
                return element.innerHTML;
            case 'image':
                return { src: element.src, alt: element.alt };
            case 'link':
                return { href: element.href, text: element.textContent };
            case 'button':
                return document.getElementById('button-preview').innerHTML;
            default:
                return element.outerHTML;
        }
    }

    previewContent() {
        if (!this.activeEditor) return;

        const { element, type } = this.activeEditor;
        const contentData = this.getFormData(type);

        // Temporarily apply changes for preview
        const originalContent = this.getOriginalContent(element, type);

        this.applyOverride(element, { contentType: type, ...contentData });

        // Revert after 3 seconds
        setTimeout(() => {
            this.restoreElementContent(element, type, originalContent);
        }, 3000);

        this.showNotification('Preview applied for 3 seconds', 'info');
    }

    async restoreOriginal() {
        if (!validateEditorState(this)) {
            recoverFromError(this);
            return;
        }

        let { element, selector, type, original } = this.activeEditor;
        if (type === 'link' && element.classList.contains('ve-btn')) {
            selector = this.getStableLinkSelector(element);
        }

        const override = this.overrides.get(selector);

        /* ---------- case 1: an override exists, delete it ---------- */
        if (override) {
            try {
                const response = await fetch(`/api/content-manager?id=${override._id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.overrides.delete(selector);
                    this.showNotification('Content restored successfully', 'success');
                    window.location.reload();
                    return;
                } else {
                    this.showNotification('Failed to restore content', 'error');
                    return;
                }
            } catch (error) {
                console.error('Restore error:', error);
                this.showNotification('Failed to restore content', 'error');
                return;
            }
        }

        /* ---------- case 2: no override – just roll back the edit ---------- */
        this.restoreElementContent(element, type, original);
        this.closeModal();
        this.showNotification('Changes discarded', 'success');
    }

    restoreElementContent(element, type, originalContent) {
        switch (type) {
            case 'text':
                element.textContent = originalContent.text;
                break;
            case 'html':
                element.innerHTML = originalContent.html;
                break;
            case 'image':
                if (element.tagName === 'IMG') {
                    element.src = originalContent.src;
                    element.alt = originalContent.alt;
                }
                break;
            case 'link':
                if (element.tagName === 'A') {
                    element.href = originalContent.href;
                    element.textContent = originalContent.text;
                }
                break;
            case 'button':
                document.getElementById('button-preview').innerHTML = originalContent.text;
                break;
        }
    }

    async uploadImage() {
        const fileInput = document.getElementById('image-upload');
        const file = fileInput.files[0];

        if (!file) {
            this.showNotification('Please select an image file first', 'error');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select a valid image file', 'error');
            return;
        }

        // Validate file size (4MB limit)
        if (file.size > 4 * 1024 * 1024) {
            this.showNotification('Image file is too large. Please select a file under 4MB', 'error');
            return;
        }

        // Validate image dimensions
        const dimensions = await this.getImageDimensions(file);
        if (dimensions.width > 2000 || dimensions.height > 2000) {
            this.showNotification('Image dimensions too large. Please use an image under 2000x2000 pixels', 'error');
            return;
        }
        console.log('[DEBUG] name', file.name, 'type', file.type);
        const progressDiv = document.getElementById('upload-progress');
        const progressFill = progressDiv.querySelector('.progress-fill');
        const progressText = progressDiv.querySelector('.progress-text');
        const uploadBtn = document.getElementById('upload-btn');
        const imagePreview = document.getElementById('image-preview');

        try {
            // Show progress
            progressDiv.style.display = 'block';
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';

            // Create FormData
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'content-images');

            // Upload with progress tracking
            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/upload-image', true);
                
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = (e.loaded / e.total) * 100;
                        progressFill.style.width = pct + '%';
                        progressText.textContent = `Uploading... ${Math.round(pct)}%`;
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error('Upload failed'));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
            });

            // Update progress to 100%
            progressFill.style.width = '100%';
            progressText.textContent = 'Upload complete!';

            // Update the image URL field and preview
            const imageUrl = document.getElementById('content-image');
            imageUrl.value = result.url;
            
            // Auto-set alt text if empty
            const altInput = document.getElementById('image-alt');
            if (!altInput.value) {
                altInput.value = result.url.split('/').pop()
                    .replace(/\.[^.]+$/, '')
                    .replace(/[-_]+/g, ' ');
            }
            
            // Show preview
            const imagePreview = document.getElementById('image-preview');
            const previewImg = imagePreview.querySelector('img');
            previewImg.src = result.thumb || result.url;
            imagePreview.style.display = 'block';

            // Show success message
            this.showNotification('Image uploaded successfully!', 'success');

            // Clear file input
            fileInput.value = '';

        } catch (error) {
            console.error('Upload error:', error);
            this.showNotification('Failed to upload image: ' + error.message, 'error');
        } finally {
            // Reset UI
            setTimeout(() => {
                progressDiv.style.display = 'none';
                progressFill.style.width = '0%';
                progressText.textContent = 'Uploading...';
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Image';
            }, 2000);
        }
    }

    getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    injectButton() {
        if (!this.activeEditor) return;
        const { element } = this.activeEditor;

        // 1️⃣ build the anchor
        const btn = document.createElement('a');
        btn.href = '#';
        btn.textContent = 'New Button';
        btn.classList.add('ve-btn', ...VisualEditor.BUTTON_CSS.split(' '));
        btn.style.marginLeft = '8px';
        btn.title = 'Click to edit this button';
        btn.style.pointerEvents = 'auto';

        // 2️⃣ give it a rock-solid selector
        const veId = `ve-btn-${Date.now()}`;
        btn.setAttribute('data-ve-button-id', veId);

        // 3️⃣ insert **inside the paragraph** so it's serialised
        element.appendChild(btn);

        // 4️⃣ register as editable
        const selector = this.generateSelector(btn);        // now data-based
        this.editableElements.push({ element: btn, selector, type: 'link' });
        const overlay = this.createEditOverlay(btn, selector, 'link');
        btn.style.position = 'relative';
        btn.appendChild(overlay);

        // 5️⃣ immediately open the link editor so the user sets label + URL first
        this.openEditor(btn, selector, 'link');
    }

    removeButtons() {
        if (!this.activeEditor) return;
        const { element } = this.activeEditor;
        const buttons = element.querySelectorAll('.ve-btn');
        if (buttons.length === 0) {
            this.showNotification('No buttons found to remove', 'info');
            return;
        }

        buttons.forEach(btn => {
            // clean up editableElements to prevent stale refs
            this.editableElements = this.editableElements.filter(
                item => item.element !== btn
            );
            btn.remove();
        });

        /* persist the new state of the paragraph */
        const para = this.activeEditor.element;
        const selector = this.generateSelector(para);
        fetch('/api/content-manager?operation=override', {
            method :'POST',
            headers:{ 'Content-Type':'application/json' },
            body   : JSON.stringify({
                        targetPage    : this.currentPage,
                        targetSelector: selector,
                        contentType   : 'html',
                        text          : para.innerHTML
                     })
        })
        .then(() => {
            this.showNotification(`${buttons.length} button${buttons.length>1?'s':''} removed and paragraph saved ✔`, 'success');
        })
        .catch(err => {
            console.error(err);
            this.showNotification('Failed to save paragraph after removing button', 'error');
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 15px 25px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10003;
            animation: slideDown 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    async saveParagraphOverride(paraElm) {
        this.ensureBlockMarker(paraElm);      // keeps editor happy
        let selector = this.generateSelector(paraElm);

        /* 🔒 5-line guard: if selector isn't unique, fall back to the marker */
        if (document.querySelectorAll(selector).length !== 1) {
            selector = `[data-ve-block-id="${paraElm.dataset.veBlockId}"]`;
            console.warn('Selector not unique, using', selector);
        }

        const res = await fetch('/api/content-manager?operation=override', {
            method : 'POST',
            headers: { 'Content-Type':'application/json' },
            body   : JSON.stringify({
                       targetPage    : this.currentPage,
                       targetSelector: selector,
                       contentType   : 'html',
                       text          : paraElm.innerHTML
                     })
        });
        const override = await res.json();
        this.overrides.set(selector, override);
        return override;
    }

    /** Give each block we override a stable, unique selector */
    ensureBlockMarker(el) {
        if (!el.dataset.veBlockId) {
            el.dataset.veBlockId = 
                (self.crypto?.randomUUID?.() ?? `ve-block-${Date.now()}-${Math.random()}`);   // virtually collision-proof
        }
    }

    async loadImages() {
        const grid = document.getElementById('image-grid');
        if (!grid) return;

        // Clear existing content
        grid.innerHTML = '<div class="loading-spinner"></div>';

        // Build the fetch URL with safe parameters
        const search = encodeURIComponent(this.imgSearch || "");
        const sort   = this.imgSort || "newest";
        fetch(`/api/content-manager?operation=list-images&page=${this.imgPage}&search=${search}&sort=${sort}`)
            .then(res => res.json())
            .then(data => {
                this.imgTotalPage = data.totalPages;
                grid.innerHTML = '';

                data.images.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'image-item';

                    // Use safeImg helper
                    const img = safeImg(document.createElement('img'));
                    img.src = item.thumb;
                    img.alt = item.name;
                    img.dataset.fullUrl = item.url;

                    div.appendChild(img);

                    // 🟢  NEW – choose this image when clicked
                    div.addEventListener('click', () => {
                        /* 1️⃣ visual feedback */
                        grid.querySelectorAll('.image-item.selected')
                            .forEach(el => el.classList.remove('selected'));
                        div.classList.add('selected');

                        /* 2️⃣ write into the form */
                        document.getElementById('content-image').value = item.url;
                        const previewBox = document.getElementById('image-preview');
                        const previewImg = previewBox.querySelector('img');
                        previewImg.src = item.thumb || item.url;
                        previewBox.style.display = 'block';

                        /* 3️⃣ fill alt automatically if empty */
                        const altInput = document.getElementById('image-alt');
                        if (!altInput.value) {
                            altInput.value = item.name
                                .replace(/\.[^.]+$/, '')
                                .replace(/[-_]+/g, ' ');
                        }

                        /* 4️⃣ close the browser for convenience */
                        document.getElementById('image-browser').style.display = 'none';
                    });

                    grid.appendChild(div);
                });

                // Update pagination
                const prevPage = document.getElementById('prev-page');
                const nextPage = document.getElementById('next-page');
                const pageInfo = document.getElementById('page-info');
                
                if (prevPage) prevPage.disabled = this.imgPage <= 1;
                if (nextPage) nextPage.disabled = this.imgPage >= this.imgTotalPage; // Fixed comparison
                if (pageInfo) pageInfo.textContent = `Page ${this.imgPage}`;
            })
            .catch(error => {
                console.error('Error loading images:', error);
                grid.innerHTML = '<div class="error-message">Failed to load images</div>';
            });
    }

    openImageBrowser() {
        const imageBrowser = document.getElementById('image-browser');
        imageBrowser.style.display = 'block';
        this.imgPage = 1;
        this.loadImages();
    }

    // Add event listener tracking
    addTrackedListener(element, event, handler) {
        if (!this._eventListeners.has(element)) {
            this._eventListeners.set(element, new Map());
        }
        const elementListeners = this._eventListeners.get(element);
        if (!elementListeners.has(event)) {
            elementListeners.set(event, new Set());
        }
        elementListeners.get(event).add(handler);
        element.addEventListener(event, handler);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION REORDERING FUNCTIONALITY
    // ═══════════════════════════════════════════════════════════════════

    async ensureSortableLoaded() {
        if (window.Sortable) return;
        try {
            await import('https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/+esm');
            console.log('SortableJS loaded successfully');
        } catch (error) {
            console.error('Failed to load SortableJS:', error);
            this.showNotification('Failed to load drag-and-drop library', 'error');
        }
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
        // 0️⃣  Bail early if there's nothing saved for this page
        if (!this.sectionOrder.length) return;

        // Filter out dynamic container IDs to prevent them from ever being moved by the editor.
        const forbiddenIDs = ['dynamicSectionsTop', 'dynamicSectionsMiddle', 'dynamicSections'];
        this.sectionOrder = this.sectionOrder.filter(id => !forbiddenIDs.includes(id));

        const parent = document.querySelector('main');
        if (!parent) {            console.warn('[VE] <main> not found – cannot apply order');
            return;
        }

        /* 1️⃣  gather only the reorderable STATIC sections
               (anything inside the dynamic containers is ignored)                */
        const staticSections = Array.from(
            parent.querySelectorAll('[data-ve-section-id]')
        ).filter(sec => !sec.closest('.dynamic-section-container'));

        if (!staticSections.length) {
            console.log('[VE] No reorderable sections on this page');
            return;
        }

        /* 2️⃣  Park a comment node where the first section lives.
               This survives while we rip the real nodes out of the tree.         */
        const anchorPlaceholder = document.createComment('ve-order-anchor');
        parent.replaceChild(anchorPlaceholder, staticSections[0]); // keeps position

        /* 3️⃣  Build a lookup → O(1) when stepping through saved order            */
        const lookup = new Map(
            staticSections.map(sec => [sec.dataset.veSectionId, sec])
        );

        const frag = document.createDocumentFragment();

        // 3a. append in the order stored in DB
        this.sectionOrder.forEach(id => {
            if (lookup.has(id)) {
                frag.appendChild(lookup.get(id));
                lookup.delete(id);
            }
        });

        // 3b. any new sections that weren't in the DB go to the end
        lookup.forEach(sec => frag.appendChild(sec));

        /* 4️⃣  Drop the reordered block back where it came from – **non-destructive** */
        parent.insertBefore(frag, anchorPlaceholder);
        anchorPlaceholder.remove();

        console.log('[VE] Applied non-destructive section order');
    }

    scanForSections() {
        // Only scan for static sections, not those inside dynamic containers
        const forbidden = new Set(['dynamicSectionsTop',
            'dynamicSectionsMiddle',
            'dynamicSections']);
        this.reorderableSecs = Array.from(
            document.querySelectorAll('[data-ve-section-id]'))
            .filter(sec =>
                !sec.closest('.dynamic-section-container') &&
                !forbidden.has(sec.dataset.veSectionId));
        console.log('Found reorderable sections:', this.reorderableSecs.length);
    }

    activateSectionDragging() {
        if (this.sortable || !this.reorderableSecs.length) return;

        // Add drag handles to sections
        this.reorderableSecs.forEach(section => {
            if (section.querySelector('.ve-drag-handle')) return;

            const handle = document.createElement('div');
            handle.className = 've-drag-handle';
            handle.innerHTML = '⇅';
            handle.title = 'Drag to reorder section';
            handle.setAttribute('aria-label', 'Drag handle for section reordering');

            // Ensure section is positioned for absolute handle
            if (getComputedStyle(section).position === 'static') {
                section.style.position = 'relative';
            }

            section.prepend(handle);
        });

        // Create sortable instance
        const container = document.querySelector('main') || document.body;
        this.sortable = Sortable.create(container, {
            handle: '.ve-drag-handle',
            draggable: '[data-ve-section-id]',
            animation: 150,
            ghostClass: 've-drag-ghost',
            chosenClass: 've-drag-chosen',
            dragClass: 've-drag-active',
            onStart: () => {
                document.body.classList.add('ve-dragging');
            },
            onEnd: (evt) => {
                document.body.classList.remove('ve-dragging');
                this.persistSectionOrder();
            }
        });

        console.log('Section dragging activated');
    }

    async persistSectionOrder() {
        // Only persist order for static sections, not those inside dynamic containers
        const forbidden = new Set(['dynamicSectionsTop',
            'dynamicSectionsMiddle',
            'dynamicSections']);
        const order = Array.from(
            document.querySelectorAll('[data-ve-section-id]'))
            .filter(sec =>
                !sec.closest('.dynamic-section-container') &&
                !forbidden.has(sec.dataset.veSectionId))
            .map(el => el.dataset.veSectionId);

        const currentPage = this.currentPage.replace(/^\//, '') || 'index';

        try {
            const response = await fetch('/api/content-manager?operation=set-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPage: currentPage,
                    order
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.sectionOrder = result.order;
            this.showNotification('Section order saved ✔', 'success');
            console.log('Section order persisted:', result);
        } catch (error) {
            console.error('Failed to persist section order:', error);
            this.showNotification('Could not save new order', 'error');

            // TODO: Implement rollback to previous order
        }
    }

    // Cleanup event listeners
    cleanupEventListeners() {
        this._eventListeners.forEach((eventMap, element) => {
            eventMap.forEach((handlers, event) => {
                handlers.forEach(handler => {
                    element.removeEventListener(event, handler);
                });
            });
        });
        this._eventListeners.clear();
    }
}

// Initialize visual editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VisualEditor();
});

// Add slide animations
const slideAnimations = document.createElement('style');
slideAnimations.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    @keyframes slideUp {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }

    .ve-btn {
        display: inline-block;          /* isolates line-height */
        padding: 0.5em 1.2em;
        margin: 0 0.25em;
        border-radius: 4px;
        text-decoration: none;
        color: #fff;
        background: #007bff;
        transition: background 0.2s;
    }
    .ve-btn:hover,
    .ve-btn:focus {
        background: #0056b3;
    }
`;
document.head.appendChild(slideAnimations);
