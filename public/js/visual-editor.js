import { editorState } from './editor/editor-state.js';
import { apiService } from './editor/api-service.js';
import { overrideEngine } from './editor/override-engine.js';
import { UIManager } from './editor/ui-manager.js';
import { sectionSorter } from './editor/features/section-sorter.js';

class VisualEditor {
    constructor() {
        this.ui = new UIManager({
            onToggle: () => this.toggleEditMode(),
            onEdit: el => this.startEditing(el),
            onSave: data => this.save(data),
            onPreview: data => this.preview(data),
            onRestore: () => this.restore(),
            onUpload: () => this.uploadImage(),
            getType: el => overrideEngine.getElementType(el)
        });
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        await this.waitForDynSections();
        await sectionSorter.init();
        await overrideEngine.load();
        overrideEngine.applyAllOverrides();
        try {
            const { isAdmin } = await apiService.checkAdminStatus();
            if (isAdmin) this.enable();
        } catch (e) {
            console.error('[VE] init failed', e);
        }
    }

    enable() {
        this.ui.initialize();
        this.setupShortcuts();
        setInterval(async () => {
            try {
                const { isAdmin } = await apiService.checkAdminStatus();
                if (!isAdmin && editorState.isEditMode) editorState.setEditMode(false);
            } catch {}
        }, 600000);
    }

    async waitForDynSections() {
        if (document.body.classList.contains('dyn-ready')) return;
        await new Promise(res => window.addEventListener('dyn-sections-loaded', res, { once: true }));
    }

    toggleEditMode() {
        editorState.setEditMode(!editorState.isEditMode);
        if (editorState.isEditMode) {
            const els = this.ui.scanEditableElements();
            this.ui.addOverlays(els);
            this.ui.disableLinks();
            sectionSorter.activate();
        } else {
            this.ui.removeOverlays();
            this.ui.enableLinks();
            sectionSorter.deactivate();
        }
    }

    startEditing(el) {
        const type = overrideEngine.getElementType(el);
        const selector = overrideEngine.getStableSelector(el, type);
        const original = overrideEngine.getOriginalContent(el, type);
        const canRestore = overrideEngine.overrides.has(selector);
        editorState.setActiveEditor({ element: el, selector, type, original, canRestore });
    }

    async save(data) {
        const result = await overrideEngine.save(data);
        this.ui.showNotification(result.success ? 'Saved!' : 'Save failed', result.success ? 'success' : 'error');
        if (result.success) editorState.setActiveEditor(null);
    }

    preview(data) {
        if (!editorState.validate()) return;
        const { element, type, original } = editorState.activeEditor;
        overrideEngine.applyOverride(element, { contentType:type, ...data });
        this.ui.showNotification('Preview for 3s');
        setTimeout(()=> overrideEngine.restoreElementContent(element,type,original),3000);
    }

    async restore() {
        const result = await overrideEngine.restore();
        this.ui.showNotification(result?.success ? 'Restored' : 'Failed', result?.success ? 'success' : 'error');
        editorState.setActiveEditor(null);
        if (result?.reload) location.reload();
    }

    async uploadImage() {
        const fileInput = document.getElementById('image-upload');
        const file = fileInput.files[0];
        if (!file) { this.ui.showNotification('Choose file','error'); return; }
        const fd = new FormData();
        fd.append('file', file); fd.append('folder','content-images');
        try {
            const res = await apiService.uploadImage(fd, pct => {/*progress ignored*/});
            this.ui.handleImageSelect(res);
            this.ui.showNotification('Upload complete','success');
            fileInput.value = '';
        } catch (e) {
            this.ui.showNotification('Upload failed','error');
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
