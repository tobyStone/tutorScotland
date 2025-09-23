/**
 * @fileoverview Secure bootstrap for visual editor - only loads for authenticated admins
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 * 
 * @description Security-first bootstrap that:
 * - Checks admin authentication before loading visual editor
 * - Prevents exposure of admin tooling to unauthenticated users
 * - Dynamically imports visual editor only when authorized
 * 
 * @security Only loads visual editor after successful admin authentication
 */

console.log('🔒 Visual Editor Bootstrap: Checking admin authentication...');

/**
 * Check if user has admin authentication
 * @returns {Promise<boolean>} True if user is authenticated admin
 */
async function checkAdminAuth() {
    try {
        const response = await fetch('/api/protected?role=admin', {
            method: 'GET',
            credentials: 'include', // Include cookies for JWT
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('🔒 Admin authentication verified:', data);
            return true;
        } else {
            console.log('🔒 Admin authentication failed:', response.status);
            return false;
        }
    } catch (error) {
        console.log('🔒 Admin authentication error:', error);
        return false;
    }
}

/**
 * Dynamically load and initialize visual editor for authenticated admins
 */
async function loadVisualEditor() {
    try {
        console.log('🎨 Loading visual editor for authenticated admin...');

        // Dynamically import the visual editor module
        const visualEditorModule = await import('/js/visual-editor-v2.js?v=20250101-CACHE-BUST&t=' + Date.now());

        console.log('🎨 Visual editor module loaded');

        // Initialize the visual editor via the secure initialization function
        if (window.initializeVisualEditor) {
            window.initializeVisualEditor();
            console.log('🎨 Visual editor initialized successfully');
        } else {
            console.error('❌ Visual editor initialization function not found');
        }

    } catch (error) {
        console.error('❌ Failed to load visual editor:', error);
    }
}

/**
 * Main bootstrap function
 */
async function initializeVisualEditorBootstrap() {
    console.log('🔒 Visual Editor Bootstrap: Starting authentication check...');
    
    const isAdmin = await checkAdminAuth();
    
    if (isAdmin) {
        console.log('✅ Admin authenticated - loading visual editor');
        await loadVisualEditor();
    } else {
        console.log('🚫 Not authenticated as admin - visual editor not loaded');
        
        // Clean up any potential window references that might have been set
        if (window.visualEditor) {
            delete window.visualEditor;
        }
        if (window.sectionSorter) {
            delete window.sectionSorter;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVisualEditorBootstrap);
} else {
    initializeVisualEditorBootstrap();
}

// Export for debugging purposes (only in development)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.visualEditorBootstrap = {
        checkAdminAuth,
        loadVisualEditor,
        reinitialize: initializeVisualEditorBootstrap
    };
}
