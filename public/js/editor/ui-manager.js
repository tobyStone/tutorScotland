import { editorState } from './editor-state.js';
import { ImageBrowser } from './features/image-browser.js';

const BUTTON_CSS = 'button aurora';

class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks; // { onSave, onPreview, onRestore, onPromoteToButton, onUpload }
        this.editableElements = [];
        this.dom = {}; // To store references to modal elements
        this.imageBrowser = new ImageBrowser({
            onImageSelect: this.handleImageSelection.bind(this)
        });
        
        editorState.on('editModeChanged', this.handleEditModeChange.bind(this));
        editorState.on('activeEditorChanged', this.handleActiveEditorChange.bind(this));
    }

    initialize() {
        this.loadEditorStyles();
        this.createEditModeToggle();
        this.createEditorModal();
    }

    // --- Overlays & Element Scanning ---

    // ✅ FIX: This is the critical fix for making buttons and images editable again.
    scanAndCreateOverlays() {
        this.removeEditOverlays(); // Clear previous overlays first
        this.editableElements = [];

        // --- Step 1: Find all potential editable elements ---
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p:not(.no-edit)',
            'ul:not(.no-edit):not(.ve-no-edit)', 'ol:not(.no-edit):not(.ve-no-edit)',
            '.editable',
            'img:not(.no-edit)', // Explicitly find all images
            `a.${BUTTON_CSS.split(' ')[0]}` // Find all elements with the primary button class
        ];

        const foundElements = new Set(); // Use a Set to avoid duplicates

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                // Ensure we don't add elements from inside our own UI or excluded sections
                if (element.closest('.ve-no-edit, #edit-mode-toggle, #editor-modal')) return;
                foundElements.add(element);
            });
        });
        
        // --- Step 2: Create overlays for each unique element ---
        this.editableElements = Array.from(foundElements);
        
        this.editableElements.forEach(element => {
            const type = this.callbacks.onGetElementType(element);
            this.createEditOverlay(element, type);
        });

        this.callbacks.onCheckForDuplicateIds();
    }

    createEditOverlay(element, type) {
        // Prevent adding multiple overlays to the same element
        if (element.querySelector(':scope > .edit-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'edit-overlay';
        overlay.innerHTML = `<div class="edit-controls"><span class="edit-type">${type}</span><button class="edit-btn">✏️ Edit</button></div>`;
        
        const editBtn = overlay.querySelector('.edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onEditClick(element);
        });

        if (type === 'text' || type === 'html') {
            const addBtn = document.createElement('button');
            addBtn.textContent = '＋';
            addBtn.title = 'Add Aurora button';
            addBtn.className = 'promote-btn';
            addBtn.addEventListener('click', e => {
                e.stopPropagation();
                this.callbacks.onPromoteToButton(element);
            });
            overlay.querySelector('.edit-controls').appendChild(addBtn);
        }

        element.addEventListener('mouseenter', () => { if (editorState.isEditMode) overlay.style.opacity = '1'; });
        overlay.addEventListener('mouseleave', () => overlay.style.opacity = '0');

        let mount = this.getMountPoint(element, type);
        if (getComputedStyle(mount).position === 'static') {
            mount.style.position = 'relative';
        }
        mount.appendChild(overlay);
    }
    
    removeEditOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        // Safely unwrap images from their wrappers
        document.querySelectorAll('.ve-img-wrap').forEach(w => {
            if (w.parentNode) {
                w.replaceWith(...w.childNodes)
            }
        });
        this.editableElements = [];
    }

    // --- Modal Logic ---

    // ✅ FIX: This function needs to correctly get the original content
    // by calling the robust helper in the overrideEngine.
    populateForm(element, type) {
        const content = this.callbacks.onGetOriginalContent(element, type);
        switch (type) {
            case 'text':
                this.dom.modal.querySelector('#content-text').value = content;
                break;
            case 'html':
                this.dom.modal.querySelector('#content-html').value = content;
                break;
            case 'image':
                this.dom.modal.querySelector('#content-image').value = content.src;
                this.dom.modal.querySelector('#image-alt').value = content.alt;
                // Show preview
                const previewImg = this.dom.modal.querySelector('#image-preview img');
                previewImg.src = content.src;
                this.dom.modal.querySelector('#image-preview').style.display = 'block';
                break;
            case 'link':
                this.dom.modal.querySelector('#link-url').value = content.href;
                this.dom.modal.querySelector('#link-text').value = content.text;
                const firstBtnClass = BUTTON_CSS.split(/\s+/)[0];
                this.dom.modal.querySelector('#link-is-button').checked = element.classList.contains(firstBtnClass);
                break;
        }
    }
    
    // --- Unchanged methods from here down ---
    // (The rest of the ui-manager.js file remains the same as the previous version)
    
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.editableElements = [];
        this.dom = {};
        this.imageBrowser = new ImageBrowser({
            onImageSelect: this.handleImageSelection.bind(this)
        });
        
        editorState.on('editModeChanged', this.handleEditModeChange.bind(this));
        editorState.on('activeEditorChanged', this.handleActiveEditorChange.bind(this));
    }

    initialize() {
        this.loadEditorStyles();
        this.createEditModeToggle();
        this.createEditorModal();
    }

    loadEditorStyles() {
        if (document.getElementById('ve-style')) return;
            const link = document.createElement('link');
            link.id = 've-style';
            link.rel = 'stylesheet';
            link.href = '/editor.css';
            document.head.appendChild(link);
        }
    
    createEditModeToggle() {
        const button = document.createElement('button');
        button.id = 'edit-mode-toggle';
        button.className = BUTTON_CSS;
        button.textContent = 'Edit Mode';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-label', 'Toggle edit mode');
        button.addEventListener('click', () => this.callbacks.onToggleEditMode());
        document.body.appendChild(button);
    }

    createEditorModal() {
        const template = document.getElementById('ve-editor-modal-template');
        if (!template) {
            console.error('[VE] Editor modal template not found in HTML!');
            return;
    }
        const modalClone = template.content.cloneNode(true);
        document.body.appendChild(modalClone);

    createModal() {
        const tpl = document.getElementById('ve-editor-modal-template');
        if (!tpl) { console.error('[VE] modal template missing'); return; }
        const frag = tpl.content.cloneNode(true);
        document.body.appendChild(frag);
        this.dom.modal = document.getElementById('editor-modal');
        this.dom.imageBrowserContainer = this.dom.modal.querySelector('#image-browser');
        
        this.dom.modal.querySelector('#close-modal').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('#save-btn').addEventListener('click', () => this.callbacks.onSave(this.getFormData()));
        this.dom.modal.querySelector('#preview-btn').addEventListener('click', () => this.callbacks.onPreview(this.getFormData()));
        this.dom.modal.querySelector('#restore-btn').addEventListener('click', () => this.callbacks.onRestore());
        this.dom.modal.querySelector('#upload-btn').addEventListener('click', () => this.callbacks.onUpload());
        this.dom.modal.querySelector('#browse-btn').addEventListener('click', () => this.imageBrowser.open(this.dom.imageBrowserContainer));
    }

    handleEditModeChange(isEditMode) {
        document.body.classList.toggle('ve-edit-active', isEditMode);
        this.updateEditToggle(isEditMode);

        if (isEditMode) {
            this.scanAndCreateOverlays();
            this.disableLinks();
            document.body.style.outline = '3px dashed #007bff';
            document.body.style.outlineOffset = '-3px';
            this.showEditInstructions();
        } else {
            this.removeEditOverlays();
            this.enableLinks();
            document.body.style.outline = '';
            document.body.style.outlineOffset = '';
        }
    }

    handleActiveEditorChange(activeEditor) {
        if (activeEditor) {
            this.openModal(activeEditor);
        } else {
            this.closeModal();
        }
    }

    getMountPoint(element, type) {
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

    disableLinks() {
        document.querySelectorAll('a:not([data-ve-link-disabled])').forEach(link => {
            if (link.closest('.ve-no-edit, .main-nav, #edit-mode-toggle, #editor-modal')) return;
            link.dataset.originalHref = link.href;
            link.href = 'javascript:void(0)';
            link.dataset.veLinkDisabled = 'true';
        });
    }

    enableLinks() {
        document.querySelectorAll('a[data-ve-link-disabled]').forEach(link => {
            link.href = link.dataset.originalHref;
            link.removeAttribute('data-original-href');
            link.removeAttribute('data-ve-link-disabled');
        });
    }

    openModal(activeEditor) {
        const { element, type, canRestore } = activeEditor;
        this.dom.modal.querySelector('#modal-title').textContent = `Edit ${type}`;
        this.dom.modal.querySelector('#content-type').value = type;
        this.updateFormFieldsVisibility(type);
        this.populateForm(element, type);
        this.dom.modal.querySelector('#restore-btn').disabled = !canRestore;
        this.dom.modal.style.display = 'block';
    }

    closeModal() {
        if(this.dom.modal) this.dom.modal.style.display = 'none';
        editorState.setActiveEditor(null);
        }

    updateFormFieldsVisibility(type) {
        ['text', 'html', 'image', 'link'].forEach(group => {
            const el = this.dom.modal.querySelector(`#${group}-group`);
            if(el) el.style.display = 'none';
        });
        const currentGroup = this.dom.modal.querySelector(`#${type}-group`);
        if(currentGroup) currentGroup.style.display = 'block';
    }

    getFormData() {
        const type = this.dom.modal.querySelector('#content-type').value;
        switch (type) {
            case 'text': return { text: this.dom.modal.querySelector('#content-text').value };
            case 'html': return { text: this.dom.modal.querySelector('#content-html').value };
            case 'image': return { image: this.dom.modal.querySelector('#content-image').value, text: this.dom.modal.querySelector('#image-alt').value };
            case 'link': return { 
                image: this.dom.modal.querySelector('#link-url').value, 
                text: this.dom.modal.querySelector('#link-text').value,
                isButton: this.dom.modal.querySelector('#link-is-button').checked
            };
            default: return {};
        }
    }
    
    handleImageSelection({ url, thumb, name }) {
        this.dom.modal.querySelector('#content-image').value = url;
        const previewImg = this.dom.modal.querySelector('#image-preview img');
        previewImg.src = thumb || url;
        this.dom.modal.querySelector('#image-preview').style.display = 'block';
        const altInput = this.dom.modal.querySelector('#image-alt');
        if (!altInput.value) {
            altInput.value = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        }
    }
    
    updateUploadProgress(percentage, text) {
        const progressDiv = this.dom.modal.querySelector('#upload-progress');
        progressDiv.style.display = 'block';
        progressDiv.querySelector('.progress-fill').style.width = `${percentage}%`;
        progressDiv.querySelector('.progress-text').textContent = text;
    }
    
    resetUploadUI() {
        const progressDiv = this.dom.modal.querySelector('#upload-progress');
        setTimeout(() => {
            progressDiv.style.display = 'none';
            progressDiv.querySelector('.progress-fill').style.width = '0%';
            progressDiv.querySelector('.progress-text').textContent = 'Uploading...';
            this.dom.modal.querySelector('#upload-btn').disabled = false;
        }, 2000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `ve-notification ve-notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    showEditInstructions() {
        if (document.getElementById('edit-instructions')) return;
        const instructions = document.createElement('div');
        instructions.id = 'edit-instructions';
        instructions.innerHTML = `<div class="instructions-content"><h4>🎨 Edit Mode Active</h4><p>Hover over elements to see edit controls. Click "Edit" to modify content.</p><button id="close-instructions">×</button></div>`;
        document.body.appendChild(instructions);
        instructions.querySelector('#close-instructions').addEventListener('click', () => instructions.remove());
        setTimeout(() => instructions.remove(), 5000);
    }

    updateEditToggle(isEditMode) {
        const button = document.getElementById('edit-mode-toggle');
        if (button) {
            button.setAttribute('aria-pressed', isEditMode.toString());
            button.textContent = isEditMode ? 'Exit Edit' : 'Edit Mode';
        }
    }
}

export { UIManager };
