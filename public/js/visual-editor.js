/**
 * Visual Content Editor - Live editing system for admin users
 * Allows in-place editing of website content with visual overlays
 */

class VisualEditor {
    static BUTTON_CSS = 'button aurora';

    /** Detect anchors that already look like site-buttons and upgrade them so
     *  the editor can treat them exactly like the ones it inserts itself. */
    upgradeLegacyButtons() {
        if (!VisualEditor.BUTTON_CSS.trim()) return;  // Guard against empty CSS

        const cssParts = VisualEditor.BUTTON_CSS.split(/\s+/);   // ['button','aurora']
        document.querySelectorAll('a').forEach(a => {
            // Skip if already processed or in navigation/header
            if (a.classList.contains('ve-btn')) return;
            if (a.closest('nav, header, #edit-mode-toggle, #editor-modal, .edit-overlay')) return;
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
        this.currentPage = this.getCurrentPageName();
        this.editableElements = [];
        this.activeEditor = null;
        this.overrides = new Map();
        this.imgPage = 1;      // current page in browser
        this.imgTotalPage = 1; // set after first fetch

        this.init();
        this.upgradeLegacyButtons();  // Initial upgrade of legacy buttons
    }

    async init() {
        // Load existing overrides (always for everyone)
        await this.loadContentOverrides();

        // Apply existing overrides (always for everyone)
        this.applyContentOverrides();

        // Check if user is admin
        const isAdmin = await this.checkAdminStatus();

        // Stop here for non-admins - they see overrides but not editing UI
        if (!isAdmin) return;

        // Create edit mode toggle
        this.createEditModeToggle();

        // Create editor modal
        this.createEditorModal();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    getCurrentPageName() {
        const path = window.location.pathname;
        return path.split('/').pop() || 'index.html';
    }

    async checkAdminStatus() {
        try {
            const response = await fetch('/api/login?check=admin');
            const data = await response.json();
            return data.isAdmin || false;
        } catch (error) {
            console.error('Admin check failed:', error);
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
        const toggle = document.createElement('div');
        toggle.id = 'edit-mode-toggle';
        toggle.innerHTML = `
            <button id="toggle-edit-btn" class="edit-toggle-btn">
                <span class="edit-icon">✏️</span>
                <span class="edit-text">Edit Mode</span>
            </button>
        `;

        toggle.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #007bff;
            border-radius: 25px;
            padding: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const button = toggle.querySelector('#toggle-edit-btn');
        button.style.cssText = `
            background: none;
            border: none;
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;

        button.addEventListener('click', () => this.toggleEditMode());
        document.body.appendChild(toggle);
    }

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const button = document.getElementById('toggle-edit-btn');

        if (this.isEditMode) {
            this.enableEditMode();
            button.style.background = '#28a745';
            button.querySelector('.edit-text').textContent = 'Exit Edit';
        } else {
            this.disableEditMode();
            button.style.background = 'none';
            button.querySelector('.edit-text').textContent = 'Edit Mode';
        }
    }

    enableEditMode() {
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
            'ul:not(.no-edit)', 'ol:not(.no-edit)', 'li:not(.no-edit)',
            'a:not(.no-edit)',
            'img:not(.no-edit)',
            '.editable'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip elements inside admin controls
                if (!element.closest('#edit-mode-toggle, #editor-modal, .edit-overlay')) {
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
            /* 🖼️  images need a wrapper because they can't contain children */
            let mount = element;                  // where the overlay will live
            if (type === 'image') {
                // Dup-wrap guard: check if already wrapped
                if (element.parentElement && element.parentElement.classList.contains('ve-img-wrap')) {
                    mount = element.parentElement; // overlay goes on the existing wrapper
                } else {
                    // Create wrapper if it doesn't exist
                    const wrap = document.createElement('span');
                    wrap.className = 've-img-wrap';
                    wrap.style.cssText = 'display:inline-block;position:relative;';

                    element.parentNode.insertBefore(wrap, element);
                    wrap.appendChild(element);    // move img inside
                    mount = element.parentElement;    // overlay goes on the new wrapper
                }
            }

            /* 🆕 ensure each mount is a positioning context */
            if (getComputedStyle(mount).position === 'static') {
                mount.style.position = 'relative';
            }

            const overlay = this.createEditOverlay(element, selector, type); // keep IMG as "target" for events
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
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.imgPage = 1;
                this.loadImages();
            }, 300);
        });

        // Sort handling
        imageSort.addEventListener('change', () => {
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
        this.activeEditor = { element, selector, type };

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

        // Show modal
        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('editor-modal');
        modal.style.display = 'none';
        this.activeEditor = null;
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

        // 1. Handle dynamic sections first
        const sectionRoot = element.closest('[data-section-id]');
        if (sectionRoot) {
            const id = sectionRoot.dataset.sectionId;
            if (!id) {
                console.error('Dynamic section element found without data-section-id');
                this.showNotification('Error: Could not identify dynamic section', 'error');
                this.closeModal();
                return;
            }

            try {
                const formData = this.getFormData(type);
                const body = {};
                
                // Map editor data to Section fields
                if (type === 'image') {
                    body.image = formData.image;
                } else if (element.tagName.match(/^H[1-6]$/)) {
                    body.heading = formData.text;
                } else {
                    body.text = formData.text;
                }

                if (Object.keys(body).length === 0) {
                    this.showNotification('No changes detected for this element type', 'info');
                    this.closeModal();
                    return;
                }

                const res = await fetch(`/api/sections?id=${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'network error');
                }

                // Update DOM immediately
                if (type === 'image' && element.tagName === 'IMG') {
                    element.src = body.image;
                } else if (body.heading !== undefined) {
                    element.textContent = body.heading;
                } else if (body.text !== undefined) {
                    element.innerHTML = body.text;
                }

                this.closeModal();
                this.showNotification('Section updated ✔', 'success');
                return;
            } catch (err) {
                console.error('Section PATCH failed', err);
                this.showNotification('Failed to update Section: ' + err.message, 'error');
                return;
            }
        }

        // 2. Handle button/link content
        if (type === 'link' && element.classList.contains('ve-btn')) {
            const { image: url, text: label } = this.getFormData('link');
            
            // Update DOM immediately
            element.href = url;
            element.textContent = label;
            if (element.dataset.originalHref !== undefined) {
                element.dataset.originalHref = url;
            }

            // Save to database
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
                const stableSel = this.getStableLinkSelector(element);
                const already = this.overrides.get(stableSel);
                const method = already ? 'PUT' : 'POST';
                
                try {
                    const resp = await fetch('/api/content-manager?operation=override' + 
                        (already ? ('&id=' + already._id) : ''), {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            targetPage: this.currentPage,
                            targetSelector: stableSel,
                            contentType: 'link',
                            image: url,
                            text: label,
                            originalContent: this.getOriginalContent(element, 'link')
                        })
                    });
                    
                    if (!resp.ok) throw new Error('network');
                    const ov = await resp.json();
                    this.overrides.set(stableSel, ov);
                    this.applyOverride(element, ov);
                    this.closeModal();
                    this.showNotification('Button updated ✔', 'success');
                } catch (err) {
                    console.error('Failed to save link override for standalone button', err);
                    this.showNotification('Failed to save button update', 'error');
                }
            }
            return;
        }

        // 3. Handle regular content overrides
        const contentData = this.getFormData(type);
        try {
            const response = await fetch('/api/content-manager?operation=override', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                this.applyOverride(element, override);
                this.overrides.set(selector, override);
                this.closeModal();
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
        if (!this.activeEditor) return;

        let { element, selector, type } = this.activeEditor;
        if (type === 'link' && element.classList.contains('ve-btn')) {
            selector = this.getStableLinkSelector(element);
        }

        try {
            // Check if override exists
            const override = this.overrides.get(selector);
            if (override) {
                // Delete override from database
                const response = await fetch(`/api/content-manager?id=${override._id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    // Remove from local overrides
                    this.overrides.delete(selector);

                    // Restore original content (would need to be stored)
                    // For now, reload the page
                    window.location.reload();
                } else {
                    throw new Error('Failed to restore content');
                }
            }
        } catch (error) {
            console.error('Restore error:', error);
            this.showNotification('Failed to restore content', 'error');
        }
    }

    restoreElementContent(element, type, originalContent) {
        switch (type) {
            case 'text':
                element.textContent = originalContent;
                break;
            case 'html':
                element.innerHTML = originalContent;
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
                document.getElementById('button-preview').innerHTML = originalContent;
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
            this.showNotification('Failed to save paragraph after removing buttons', 'error');
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
        const imageGrid = document.getElementById('image-grid');
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        const searchQuery = document.getElementById('image-search').value;
        const sortBy = document.getElementById('image-sort').value;

        // Show loading state
        imageGrid.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const response = await fetch(
                `/api/content-manager?operation=list-images` +
                `&page=${this.imgPage}` +
                `&search=${encodeURIComponent(searchQuery)}` +
                `&sort=${sortBy}`
            );
            if (!response.ok) throw new Error('Failed to load images');
            
            const data = await response.json();
            const { images, total, perPage } = data;
            
            this.imgTotalPage = Math.ceil(total / perPage);
            
            // Update pagination
            prevPage.disabled = this.imgPage === 1;
            nextPage.disabled = this.imgPage === this.imgTotalPage;
            pageInfo.textContent = `Page ${this.imgPage} of ${this.imgTotalPage}`;

            // Clear grid and add images
            imageGrid.innerHTML = '';
            
            if (images.length === 0) {
                imageGrid.innerHTML = '<p class="text-center">No images found</p>';
                return;
            }

            images.forEach(image => {
                const item = document.createElement('div');
                item.className = 'image-item';
                item.tabIndex = 0;
                item.innerHTML = `
                    <img src="${image.thumb || image.url}" alt="${image.name}" loading="lazy">
                    <div class="image-name">${image.name}</div>
                `;

                // Handle image load errors
                const img = item.querySelector('img');
                img.onerror = () => {
                    img.src = '/images/placeholder.png';
                    img.alt = 'Failed to load image';
                };

                // Handle selection
                item.addEventListener('click', () => {
                    // Remove selection from other items
                    imageGrid.querySelectorAll('.image-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');

                    // Update the image URL and preview
                    const imageUrl = document.getElementById('content-image');
                    imageUrl.value = image.url;
                    
                    const preview = document.getElementById('image-preview');
                    const previewImg = preview.querySelector('img');
                    previewImg.src = image.thumb || image.url;
                    preview.style.display = 'block';

                    // Close browser
                    document.getElementById('image-browser').style.display = 'none';
                });

                imageGrid.appendChild(item);
            });

        } catch (error) {
            console.error('Failed to load images:', error);
            imageGrid.innerHTML = '<p class="text-center text-danger">Failed to load images. Please try again.</p>';
        }
    }

    openImageBrowser() {
        const imageBrowser = document.getElementById('image-browser');
        imageBrowser.style.display = 'block';
        this.imgPage = 1;
        this.loadImages();
    }
}

// Initialize visual editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // exactly ONE editor, globally reachable
    window.visualEditorInstance = new VisualEditor();
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
