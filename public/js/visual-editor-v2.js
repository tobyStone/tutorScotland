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
        console.log(`🏁 [RACE] Visual Editor v2 init() starting at ${Date.now()}`);
        console.log('🎨 Visual Editor v2 initializing... (CACHE-BUST VERSION)');

        // 🎯 ORCHESTRATED CONTENT MANAGEMENT FLOW
        await this.orchestrateContentManagement();

        // Check admin status - only initialize editing UI if admin
        try {
            const { isAdmin } = await apiService.checkAdminStatus();
            if (isAdmin) {
                console.log('🔓 Admin user detected, enabling editing interface');

                // Initialize UI (only for admin users)
                this.uiManager.init();

                // Initialize section sorter
                sectionSorter.init();

                // Set up keyboard shortcuts
                this.setupKeyboardShortcuts();

                // Set up dynamic content listener
                this.setupDynamicContentListener();

                // Enable editor UI and set up periodic admin check
                this.enableEditorUI();

                console.log('✅ Visual Editor v2 ready with editing capabilities!');
            } else {
                console.log('👀 Non-admin user, overrides applied but editing disabled');
            }
        } catch (error) {
            console.error('🚫 Admin check failed, editing not enabled.', error);
        }
    }

    /**
     * 🎯 ORCHESTRATED CONTENT MANAGEMENT FLOW
     * Ensures proper order: HTML → Dynamic Sections → Content Overrides → Section Reordering
     */
    async orchestrateContentManagement() {
        console.log('🎭 [ORCHESTRATOR] Starting content management orchestration...');

        try {
            // STEP 1: Original HTML is already loaded (browser handles this)
            console.log('📄 [ORCHESTRATOR] Step 1: Original HTML loaded ✅');

            // STEP 2: Wait for dynamic sections to be placed
            console.log('🏗️ [ORCHESTRATOR] Step 2: Waiting for dynamic sections...');
            console.log(`🏁 [RACE] About to wait for dynamic sections at ${Date.now()}`);
            await this.waitForDynamicSections();
            console.log('🏗️ [ORCHESTRATOR] Step 2: Dynamic sections placed ✅');

            // STEP 3: Apply content overrides (both original and dynamic content)
            console.log('✏️ [ORCHESTRATOR] Step 3: Applying content overrides...');
            console.log(`🏁 [RACE] Dynamic sections ready, initializing override engine at ${Date.now()}`);
            await overrideEngine.init();
            console.log('✏️ [ORCHESTRATOR] Step 3: Content overrides applied ✅');

            // STEP 4: Apply section reordering (if admin and reordering data exists)
            console.log('🔄 [ORCHESTRATOR] Step 4: Checking for section reordering...');
            await this.applySectionReordering();
            console.log('🔄 [ORCHESTRATOR] Step 4: Section reordering complete ✅');

            console.log('🎉 [ORCHESTRATOR] Content management orchestration complete!');

        } catch (error) {
            console.error('❌ [ORCHESTRATOR] Error during content management orchestration:', error);
            throw error;
        }
    }

    /**
     * Apply section reordering if data exists
     */
    async applySectionReordering() {
        try {
            // Use the existing section sorter system to apply stored order from database
            const currentPage = this.getCurrentPageSlug();
            console.log(`🔄 [ORCHESTRATOR] Loading section order for page: ${currentPage}`);

            // Use the imported section sorter to apply order from database
            await sectionSorter.init();
            console.log('🔄 [ORCHESTRATOR] Section reordering applied via sectionSorter.init()');
        } catch (error) {
            console.error('❌ [ORCHESTRATOR] Error applying section reordering:', error);
            // Don't throw - reordering failure shouldn't break the whole system
        }
    }

    /**
     * Reorder sections based on stored data
     */
    async reorderSectionsFromData(orderData) {
        if (!orderData || !Array.isArray(orderData)) {
            console.log('🔄 [ORCHESTRATOR] Invalid order data, skipping');
            return;
        }

        const main = document.querySelector('main');
        if (!main) {
            console.log('🔄 [ORCHESTRATOR] No main element found, skipping reordering');
            return;
        }

        // Get all sections that have data-ve-section-id
        const sections = Array.from(main.querySelectorAll('[data-ve-section-id]'));
        console.log(`🔄 [ORCHESTRATOR] Found ${sections.length} reorderable sections`);

        // Create a map of section-id to element
        const sectionMap = new Map();
        sections.forEach(section => {
            const sectionId = section.getAttribute('data-ve-section-id');
            if (sectionId) {
                sectionMap.set(sectionId, section);
            }
        });

        // Reorder based on stored order
        orderData.forEach((sectionId, index) => {
            const section = sectionMap.get(sectionId);
            if (section) {
                main.appendChild(section); // Move to end in correct order
                console.log(`🔄 [ORCHESTRATOR] Moved section "${sectionId}" to position ${index + 1}`);
            }
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
        console.log('🔓 Enabling editor UI for admin user');
        // UI is already initialized, just set up periodic admin check
        setInterval(async () => {
            try {
                const { isAdmin } = await apiService.checkAdminStatus();
                if (!isAdmin && editorState.isEditMode) {
                    editorState.setEditMode(false);
                }
            } catch (error) {
                // Ignore errors in periodic check
            }
        }, 600000); // Check every 10 minutes
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.toggleEditMode();
            }
            if (e.key === 'Escape' && editorState.isEditMode) {
                this.toggleEditMode();
            }
        });
    }

    toggleEditMode() {
        console.log('🔄 Toggling edit mode...');
        const newMode = !editorState.isEditMode;
        editorState.setEditMode(newMode);

        if (newMode) {
            this.enableEditMode();
        } else {
            this.disableEditMode();
        }
    }

    enableEditMode() {
        console.log('🎨 Enabling edit mode');
        document.body.classList.add('visual-editor-active');

        // Scan for editable elements and add overlays
        const elements = this.uiManager.scanEditableElements();
        this.uiManager.addOverlays(elements);
        this.uiManager.disableLinks();

        // Activate section sorter for drag-and-drop functionality
        sectionSorter.activate();
    }

    disableEditMode() {
        console.log('👁️ Disabling edit mode');
        document.body.classList.remove('visual-editor-active');

        // Remove overlays and restore links
        this.uiManager.removeOverlays();
        this.uiManager.enableLinks();

        // Deactivate section sorter
        sectionSorter.deactivate();
    }

    handleEditClick(element) {
        console.log('✏️ Edit clicked for element:', element);
        const type = overrideEngine.getElementType(element);
        const selector = overrideEngine.getStableSelector(element, type);
        const original = overrideEngine.getOriginalContent(element, type);
        const canRestore = overrideEngine.overrides.has(selector);

        // Set active editor which will trigger the modal to open
        editorState.setActiveEditor({ element, selector, type, original, canRestore });
    }

    getElementSelector(element) {
        // Generate a selector for the element
        if (element.id) {
            return `#${element.id}`;
        }

        // Use data-ve-block-id if available
        if (element.dataset.veBlockId) {
            return `[data-ve-block-id="${element.dataset.veBlockId}"]`;
        }

        // Fallback to tag + class combination
        let selector = element.tagName.toLowerCase();
        if (element.className) {
            selector += '.' + element.className.split(' ').join('.');
        }

        return selector;
    }

    async handleSave(data) {
        console.log('💾 Saving content with data:', data);
        const result = await overrideEngine.save(data);
        this.uiManager.showNotification(result.success ? 'Saved!' : 'Save failed', result.success ? 'success' : 'error');
        if (result.success) editorState.setActiveEditor(null);
    }

    handlePreview(data) {
        console.log('👁️ Previewing content with data:', data);
        if (!editorState.validate()) return;
        const { element, type, original } = editorState.activeEditor;
        overrideEngine.applyOverride(element, { contentType: type, ...data });
        this.uiManager.showNotification('Preview for 3s');
        setTimeout(() => overrideEngine.restoreElementContent(element, type, original), 3000);
    }

    async handleRestore() {
        console.log('🔄 Restoring original content');
        const { selector } = editorState.activeEditor;
        const result = await overrideEngine.restore(selector);
        this.uiManager.showNotification(result.success ? 'Restored!' : 'Restore failed', result.success ? 'success' : 'error');
        if (result.success) editorState.setActiveEditor(null);
    }

    async handleUpload(file) {
        console.log('📤 Uploading file:', file);

        try {
            this.uiManager.showNotification('Uploading image...', 'info');

            const result = await apiService.uploadImage(file);

            if (result.success) {
                this.uiManager.showNotification('Image uploaded successfully!', 'success');
                return result.url;
            } else {
                throw new Error(result.error || 'Failed to upload image');
            }
        } catch (error) {
            console.error('❌ Error uploading image:', error);
            this.uiManager.showNotification('Failed to upload image: ' + error.message, 'error');
            throw error;
        }
    }



    // ✅ FIXED: Listen for dynamic content changes and refresh accordingly
    setupDynamicContentListener() {
        let isProcessingDynamicContent = false;
        let overrideApplicationCount = 0;

        // Listen for additional dynamic content loads (e.g., from page.html)
        window.addEventListener('dyn-sections-loaded', () => {
            console.log(`🏁 [RACE] dyn-sections-loaded event received at ${Date.now()}`);

            // ✅ FIXED: Prevent multiple simultaneous override applications
            if (isProcessingDynamicContent) {
                console.log(`🏁 [RACE] Already processing dynamic content, skipping at ${Date.now()}`);
                return;
            }

            isProcessingDynamicContent = true;
            overrideApplicationCount++;

            console.log(`🏁 [RACE] Dynamic content processing started (attempt #${overrideApplicationCount}) at ${Date.now()}`);
            console.log(`[VE] Dynamic content loaded (attempt #${overrideApplicationCount}), refreshing visual editor...`);

            // ✅ FIXED: Small delay to ensure DOM is fully updated
            setTimeout(async () => {
                try {
                    // Refresh UI manager to detect new elements
                    this.uiManager.refreshEditableElements();

                    // Overrides are now handled by the override engine automatically

                    console.log('[VE] ✅ Visual editor refreshed after dynamic content load');
                } catch (error) {
                    console.error('[VE] ❌ Error refreshing after dynamic content:', error);
                } finally {
                    isProcessingDynamicContent = false;
                }
            }, 100);
        });
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

        // ✅ IMPROVED: Better upload handling with retry logic
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder','content-images');

        try {
            this.uiManager.showNotification('Uploading image...','info');
            const res = await apiService.uploadImage(fd, () => {/*progress ignored*/});
            this.uiManager.handleImageSelect(res);
            this.uiManager.showNotification('Upload complete','success');
            fileInput.value = '';
        } catch (e) {
            console.error('Upload failed:', e);

            // ✅ NEW: Provide more specific error messages
            let errorMessage = 'Upload failed';
            if (e.message.includes('corrupted') || e.message.includes('invalid')) {
                errorMessage = 'Image appears corrupted. Please try a different image or format.';
            } else if (e.message.includes('too large')) {
                errorMessage = 'Image is too large. Please resize it first.';
            } else if (e.message.includes('network') || e.message.includes('Network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }

            this.uiManager.showNotification(errorMessage, 'error');
        }
    }

    /**
     * Get current page slug for localStorage keys
     */
    getCurrentPageSlug() {
        const path = window.location.pathname;
        // Normalize path: remove leading/trailing slashes, handle index.html
        let slug = path.replace(/^\/+|\/+$/g, '');
        if (slug === '' || slug === 'index.html') {
            slug = 'index';
        }
        // Remove .html extension if present
        slug = slug.replace(/\.html$/, '');
        return slug;
    }


}

// Initialize the visual editor when the script loads
console.log('🚀 Visual Editor v2 script loaded - CACHE BUSTED VERSION');
const visualEditor = new VisualEditor();

// Export for potential external use
window.visualEditor = visualEditor;
window.sectionSorter = sectionSorter;
