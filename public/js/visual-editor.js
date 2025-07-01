import { editorState } from './editor/editor-state.js';
import { apiService } from './editor/api-service.js';
import { overrideEngine } from './editor/override-engine.js';
import { UIManager } from './editor/ui-manager.js';
import { sectionSorter } from './editor/features/section-sorter.js';

class VisualEditor {
    constructor() {
        this.uiManager = new UIManager({
            onToggle: this.toggleEditMode.bind(this),
            onEdit: this.handleEditClick.bind(this),
            onSave: this.handleSave.bind(this),
            onPreview: this.handlePreview.bind(this),
            onRestore: this.handleRestore.bind(this),
            onUpload: this.handleUpload.bind(this),
            getType: el => overrideEngine.getElementType(el),
            getOriginalContent: (el, type) => overrideEngine.getOriginalContent(el, type),
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        await this.waitForDynamicSections();
        await sectionSorter.init();
        await overrideEngine.load();
        overrideEngine.applyAllOverrides();

        // ✅ NEW: Set up listener for dynamic content changes
        this.setupDynamicContentListener();

        try {
            const { isAdmin } = await apiService.checkAdminStatus();
            if (isAdmin) {
                this.enableEditorUI();
            }
        } catch (error) {
            console.error('[VE] Admin check failed, editor not enabled.', error);
        }
    }

    // ✅ NEW: Listen for dynamic content changes and refresh accordingly
    setupDynamicContentListener() {
        // Listen for additional dynamic content loads (e.g., from page.html)
        window.addEventListener('dyn-sections-loaded', () => {
            console.log('[VE] Dynamic sections loaded, reapplying overrides...');

            // Reapply overrides to newly loaded content
            setTimeout(() => {
                overrideEngine.applyAllOverrides();

                // Refresh UI overlays if in edit mode
                this.uiManager.refreshEditableElements();
            }, 100); // Small delay to ensure DOM is fully updated
        });
    }

    waitForDynamicSections() {
        return new Promise(resolve => {
            if (document.body.classList.contains('dyn-ready')) {
                console.log('[VE] Dynamic sections already ready.');
                return resolve();
            }
            console.log('[VE] Waiting for dyn-sections-loaded event...');
            window.addEventListener('dyn-sections-loaded', resolve, { once: true });
        });
    }

    enableEditorUI() {
        this.uiManager.initialize();
        this.setupShortcuts();
        setInterval(async () => {
            try {
                const { isAdmin } = await apiService.checkAdminStatus();
                if (!isAdmin && editorState.isEditMode) editorState.setEditMode(false);
            } catch {}
        }, 600000);
    }

    toggleEditMode() {
        const newMode = !editorState.isEditMode;
        editorState.setEditMode(newMode);
        if (newMode) {
            const els = this.uiManager.scanEditableElements();
            this.uiManager.addOverlays(els);
            this.uiManager.disableLinks();
            sectionSorter.activate();
        } else {
            this.uiManager.removeOverlays();
            this.uiManager.enableLinks();
            sectionSorter.deactivate();
        }
    }

    handleEditClick(el) {
        const type = overrideEngine.getElementType(el);
        const selector = overrideEngine.getStableSelector(el, type);
        const original = overrideEngine.getOriginalContent(el, type);
        const canRestore = overrideEngine.overrides.has(selector);
        editorState.setActiveEditor({ element: el, selector, type, original, canRestore });
    }

    async handleSave(data) {
        const result = await overrideEngine.save(data);
        this.uiManager.showNotification(result.success ? 'Saved!' : 'Save failed', result.success ? 'success' : 'error');
        if (result.success) editorState.setActiveEditor(null);
    }

    handlePreview(data) {
        if (!editorState.validate()) return;
        const { element, type, original } = editorState.activeEditor;
        overrideEngine.applyOverride(element, { contentType:type, ...data });
        this.uiManager.showNotification('Preview for 3s');
        setTimeout(()=> overrideEngine.restoreElementContent(element,type,original),3000);
    }

    async handleRestore() {
        const result = await overrideEngine.restore();
        this.uiManager.showNotification(result?.success ? 'Restored' : 'Failed', result?.success ? 'success' : 'error');
        editorState.setActiveEditor(null);
        if (result?.reload) location.reload();
    }

    async handleUpload() {
        const fileInput = document.getElementById('image-upload');
        const file = fileInput.files[0];
        if (!file) { this.uiManager.showNotification('Choose file','error'); return; }
        const fd = new FormData();
        fd.append('file', file); fd.append('folder','content-images');
        try {
            const res = await apiService.uploadImage(fd, pct => {/*progress ignored*/});
            this.uiManager.handleImageSelect(res);
            this.uiManager.showNotification('Upload complete','success');
            fileInput.value = '';
        } catch (e) {
            this.uiManager.showNotification('Upload failed','error');
        }
    }

    setupShortcuts() {
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey||e.metaKey)&&e.key==='e'){ e.preventDefault(); this.toggleEditMode(); }
            if (e.key==='Escape' && editorState.isEditMode){ this.toggleEditMode(); }
        });
    }
}

new VisualEditor();
