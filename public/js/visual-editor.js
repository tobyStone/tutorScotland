/**
 * Visual Content Editor - Live editing system for admin users
 * Allows in-place editing of website content with visual overlays
 */

class VisualEditor {
    constructor() {
        this.isEditMode = false;
        this.currentPage = this.getCurrentPageName();
        this.editableElements = [];
        this.activeEditor = null;
        this.overrides = new Map();

        this.init();
    }

    async init() {
        // Check if user is admin
        const isAdmin = await this.checkAdminStatus();
        if (!isAdmin) return;

        // Load existing overrides
        await this.loadContentOverrides();

        // Apply existing overrides
        this.applyContentOverrides();

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
        this.overrides.forEach((override, selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                this.applyOverride(element, override);
            });
        });
    }

    applyOverride(element, override) {
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
                    element.href = override.image; // Using image field for URL
                    element.textContent = override.text;
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

        // Add visual indicator
        document.body.style.outline = '3px dashed #007bff';
        document.body.style.outlineOffset = '-3px';

        // Show edit instructions
        this.showEditInstructions();
    }

    disableEditMode() {
        // Remove edit overlays
        this.removeEditOverlays();

        // Remove visual indicators
        document.body.style.outline = '';
        document.body.style.outlineOffset = '';

        // Hide instructions
        this.hideEditInstructions();
    }

    scanForEditableElements() {
        this.editableElements = [];

        // Define editable selectors
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p:not(.no-edit)',
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
        // Generate a unique CSS selector for the element
        if (element.id) {
            return `#${element.id}`;
        }

        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                return `${element.tagName.toLowerCase()}.${classes[0]}`;
            }
        }

        // Fallback to tag name with nth-child
        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(child =>
                child.tagName === element.tagName
            );
            const index = siblings.indexOf(element) + 1;
            return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
        }

        return element.tagName.toLowerCase();
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
            const overlay = this.createEditOverlay(element, selector, type);
            element.style.position = 'relative';
            element.appendChild(overlay);
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

        // Show overlay on hover
        element.addEventListener('mouseenter', () => {
            if (this.isEditMode) overlay.style.opacity = '1';
        });

        element.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
        });

        // Edit button click
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openEditor(element, selector, type);
        });

        return overlay;
    }

    removeEditOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(overlay => {
            overlay.remove();
        });
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

        document.getElementById('close-instructions').addEventListener('click', () => {
            instructions.remove();
        });

        document.body.appendChild(instructions);

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
                        </div>

                        <div class="form-group" id="image-group" style="display: none;">
                            <label for="content-image">Image URL:</label>
                            <input type="url" id="content-image" placeholder="https://example.com/image.jpg">
                            <label for="image-alt">Alt Text:</label>
                            <input type="text" id="image-alt" placeholder="Image description">
                        </div>

                        <div class="form-group" id="link-group" style="display: none;">
                            <label for="link-url">Link URL:</label>
                            <input type="url" id="link-url" placeholder="https://example.com">
                            <label for="link-text">Link Text:</label>
                            <input type="text" id="link-text" placeholder="Click here">
                        </div>

                        <div class="form-actions">
                            <button type="button" id="preview-btn" class="btn btn-secondary">Preview</button>
                            <button type="button" id="save-btn" class="btn btn-primary">Save Changes</button>
                            <button type="button" id="restore-btn" class="btn btn-warning">Restore Original</button>
                        </div>
                    </form>
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

        // Close modal events
        closeBtn.addEventListener('click', () => this.closeModal());
        backdrop.addEventListener('click', () => this.closeModal());

        // Content type change
        contentType.addEventListener('change', () => this.updateFormFields());

        // Button events
        saveBtn.addEventListener('click', () => this.saveContent());
        previewBtn.addEventListener('click', () => this.previewContent());
        restoreBtn.addEventListener('click', () => this.restoreOriginal());
    }

    openEditor(element, selector, type) {
        this.activeEditor = { element, selector, type };

        const modal = document.getElementById('editor-modal');
        const title = document.getElementById('modal-title');
        const contentType = document.getElementById('content-type');

        // Set modal title
        title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Content`;

        // Set content type
        contentType.value = type;
        this.updateFormFields();

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
        }
    }

    populateCurrentContent(element, type) {
        switch (type) {
            case 'text':
                document.getElementById('content-text').value = element.textContent;
                break;
            case 'html':
                document.getElementById('content-html').value = element.innerHTML;
                break;
            case 'image':
                if (element.tagName === 'IMG') {
                    document.getElementById('content-image').value = element.src;
                    document.getElementById('image-alt').value = element.alt;
                }
                break;
            case 'link':
                if (element.tagName === 'A') {
                    document.getElementById('link-url').value = element.href;
                    document.getElementById('link-text').value = element.textContent;
                }
                break;
        }
    }

    async saveContent() {
        if (!this.activeEditor) return;

        const { element, selector, type } = this.activeEditor;
        const contentData = this.getFormData(type);

        try {
            // Save to database
            const response = await fetch('/api/content-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    operation: 'override',
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

        const { element, selector, type } = this.activeEditor;

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
        }
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
`;
document.head.appendChild(slideAnimations);
