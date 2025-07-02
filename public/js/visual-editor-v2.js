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
        console.log('🎨 Visual Editor v2 initializing... (CACHE-BUST VERSION)');

        // Initialize override engine first
        await overrideEngine.init();

        // Initialize UI
        this.uiManager.init();

        // Initialize section sorter
        sectionSorter.init();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Set up dynamic content listener
        this.setupDynamicContentListener();

        // Apply any existing overrides
        await this.applyOverrides();

        console.log('✅ Visual Editor v2 ready!');
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.toggleEditMode();
            }
        });
    }

    toggleEditMode() {
        console.log('🔄 Toggling edit mode...');
        editorState.toggleEditMode();
        this.uiManager.updateUI();
        
        if (editorState.isEditMode) {
            this.enableEditMode();
        } else {
            this.disableEditMode();
        }
    }

    enableEditMode() {
        console.log('🎨 Enabling edit mode');
        document.body.classList.add('visual-editor-active');
        this.uiManager.showEditControls();
    }

    disableEditMode() {
        console.log('👁️ Disabling edit mode');
        document.body.classList.remove('visual-editor-active');
        this.uiManager.hideEditControls();
    }

    handleEditClick(element) {
        console.log('✏️ Edit clicked for element:', element);
        const type = overrideEngine.getElementType(element);
        const originalContent = overrideEngine.getOriginalContent(element, type);
        
        this.uiManager.showEditDialog(element, type, originalContent);
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

    async handleSave(element, newContent, type) {
        console.log('💾 Saving content for element:', element, 'Type:', type, 'Content:', newContent);
        
        try {
            // Apply the change immediately for instant feedback
            overrideEngine.applyOverride(element, newContent, type);
            
            // Save to backend
            const payload = {
                targetPage: window.location.pathname,
                targetSelector: this.getElementSelector(element),
                contentType: type,
                newContent: newContent
            };
            const result = await apiService.saveOverride(payload);
            
            if (result.success) {
                console.log('✅ Content saved successfully');
                this.uiManager.showSuccess('Content saved successfully!');
            } else {
                throw new Error(result.error || 'Failed to save content');
            }
        } catch (error) {
            console.error('❌ Error saving content:', error);
            this.uiManager.showError('Failed to save content: ' + error.message);
            
            // Revert the change on error
            const originalContent = overrideEngine.getOriginalContent(element, type);
            overrideEngine.applyOverride(element, originalContent, type);
        }
    }

    handlePreview(element, newContent, type) {
        console.log('👁️ Previewing content for element:', element);
        overrideEngine.applyOverride(element, newContent, type);
    }

    handleRestore(element) {
        console.log('🔄 Restoring original content for element:', element);
        const type = overrideEngine.getElementType(element);
        const originalContent = overrideEngine.getOriginalContent(element, type);
        
        overrideEngine.applyOverride(element, originalContent, type);
        this.uiManager.showSuccess('Content restored to original!');
    }

    async handleUpload(file, element) {
        console.log('📤 Uploading file for element:', element);
        
        try {
            this.uiManager.showLoading('Uploading image...');
            
            const result = await apiService.uploadImage(file);
            
            if (result.success) {
                const imageUrl = result.url;
                await this.handleSave(element, imageUrl, 'image');
                this.uiManager.showSuccess('Image uploaded and saved!');
            } else {
                throw new Error(result.error || 'Failed to upload image');
            }
        } catch (error) {
            console.error('❌ Error uploading image:', error);
            this.uiManager.showError('Failed to upload image: ' + error.message);
        } finally {
            this.uiManager.hideLoading();
        }
    }

    async applyOverrides() {
        console.log('🔄 Applying existing overrides...');

        try {
            const pageKey = window.location.pathname;
            const result = await apiService.loadOverrides(pageKey);
            const overrides = result.overrides || [];

            if (overrides && overrides.length > 0) {
                console.log(`📝 Found ${overrides.length} overrides to apply`);

                for (const override of overrides) {
                    const element = overrideEngine.findElementByOverride(override);
                    if (element) {
                        overrideEngine.applyOverride(element, override.newContent, override.contentType);
                        console.log('✅ Applied override for:', override.targetSelector);
                    } else {
                        console.warn('⚠️ Element not found for override:', override.targetSelector);
                    }
                }

                console.log('✅ All overrides applied');
            } else {
                console.log('📝 No existing overrides found');
            }
        } catch (error) {
            console.error('❌ Error applying overrides:', error);
        }
    }

    // ✅ FIXED: Listen for dynamic content changes and refresh accordingly
    setupDynamicContentListener() {
        let isProcessingDynamicContent = false;
        let overrideApplicationCount = 0;

        // Listen for additional dynamic content loads (e.g., from page.html)
        window.addEventListener('dyn-sections-loaded', () => {
            // ✅ FIXED: Prevent multiple simultaneous override applications
            if (isProcessingDynamicContent) {
                console.log('[VE] Already processing dynamic content, skipping...');
                return;
            }

            isProcessingDynamicContent = true;
            overrideApplicationCount++;

            console.log(`[VE] Dynamic content loaded (attempt #${overrideApplicationCount}), refreshing visual editor...`);

            // ✅ FIXED: Small delay to ensure DOM is fully updated
            setTimeout(async () => {
                try {
                    // Refresh UI manager to detect new elements
                    this.uiManager.refreshEditableElements();

                    // Reapply overrides to new content
                    await this.applyOverrides();

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

    setupShortcuts() {
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey||e.metaKey)&&e.key==='e'){ e.preventDefault(); this.toggleEditMode(); }
            if (e.key==='Escape' && editorState.isEditMode){ this.toggleEditMode(); }
        });
    }
}

// Initialize the visual editor when the script loads
console.log('🚀 Visual Editor v2 script loaded - CACHE BUSTED VERSION');
const visualEditor = new VisualEditor();

// Export for potential external use
window.visualEditor = visualEditor;
