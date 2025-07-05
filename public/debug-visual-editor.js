/**
 * Visual Editor Debug Script
 * Run this in browser console to diagnose visual editor issues
 */

async function debugVisualEditor() {
    console.log('🔍 [DEBUG] Starting Visual Editor Diagnostics...');
    
    const results = {
        timestamp: new Date().toISOString(),
        issues: [],
        recommendations: []
    };
    
    // 1. Check if visual editor is loaded
    console.log('📦 [DEBUG] Checking visual editor loading...');
    if (typeof window.visualEditor === 'undefined') {
        results.issues.push('❌ Visual editor not found in global scope');
        results.recommendations.push('Check if visual-editor-v2.js is loading properly');
    } else {
        console.log('✅ Visual editor found');
        
        // Check UI manager
        if (!window.visualEditor.uiManager) {
            results.issues.push('❌ UI Manager not found');
        } else {
            console.log('✅ UI Manager found');
        }
    }
    
    // 2. Check admin status
    console.log('👤 [DEBUG] Checking admin status...');
    try {
        const response = await fetch('/api/protected');
        if (response.ok) {
            console.log('✅ User is logged in as admin');

            // 3. Check edit mode status
            console.log('🎨 [DEBUG] Checking edit mode status...');
            const editModeToggle = document.getElementById('edit-mode-toggle');
            if (!editModeToggle) {
                results.issues.push('❌ Edit mode toggle button not found');
                results.recommendations.push('Visual editor UI may not be initialized for admin users');
            } else {
                console.log('✅ Edit mode toggle found');
                const isEditMode = document.body.classList.contains('ve-edit-active');
                console.log(`Edit mode active: ${isEditMode}`);

                if (!isEditMode) {
                    results.recommendations.push('💡 Click "Edit Mode" button to activate visual editing');
                }
            }

        } else {
            results.issues.push('❌ User is not logged in as admin');
            results.recommendations.push('Log in as admin to access visual editor features');
        }
    } catch (error) {
        results.issues.push('❌ Failed to check admin status: ' + error.message);
        results.recommendations.push('Make sure you are connected to the internet and the API is working');
    }
    
    // 4. Check for dynamic sections
    console.log('🔄 [DEBUG] Checking dynamic sections...');
    const dynamicSections = document.querySelectorAll('[data-ve-section-id]');
    console.log(`Found ${dynamicSections.length} elements with data-ve-section-id`);
    
    if (dynamicSections.length === 0) {
        results.issues.push('⚠️ No dynamic sections found');
        results.recommendations.push('Add some dynamic content via admin panel to test overlays');
    } else {
        console.log('✅ Dynamic sections found:', Array.from(dynamicSections).map(s => s.dataset.veSectionId));
    }
    
    // 5. Check for static editable elements
    console.log('📝 [DEBUG] Checking static editable elements...');
    const staticElements = document.querySelectorAll('[data-ve-block-id]');
    console.log(`Found ${staticElements.length} elements with data-ve-block-id`);
    
    // 6. Check CSS loading
    console.log('🎨 [DEBUG] Checking CSS loading...');
    const editorCSS = document.querySelector('link[href*="editor.css"]');
    if (!editorCSS) {
        results.issues.push('❌ Editor CSS not found');
        results.recommendations.push('Check if editor.css is loading properly');
    } else {
        console.log('✅ Editor CSS found');
    }
    
    // 7. Check for existing overlays
    console.log('👁️ [DEBUG] Checking for existing overlays...');
    const editOverlays = document.querySelectorAll('.edit-overlay');
    const dynOverlays = document.querySelectorAll('.dyn-edit-overlay');
    console.log(`Found ${editOverlays.length} edit overlays and ${dynOverlays.length} dynamic overlays`);
    
    // 8. Check body classes
    console.log('🏷️ [DEBUG] Checking body classes...');
    const bodyClasses = Array.from(document.body.classList);
    console.log('Body classes:', bodyClasses);
    
    if (!bodyClasses.includes('ve-edit-active')) {
        results.recommendations.push('💡 Body does not have "ve-edit-active" class - edit mode may not be active');
    }
    
    // 9. Test overlay creation manually
    console.log('🧪 [DEBUG] Testing manual overlay creation...');
    if (window.visualEditor && window.visualEditor.uiManager) {
        try {
            const testResult = window.visualEditor.uiManager.hasEditingConflicts();
            console.log(`Conflict detection test: ${testResult}`);
        } catch (error) {
            results.issues.push('❌ Error testing UI manager methods: ' + error.message);
        }
    }
    
    // Summary
    console.log('📊 [DEBUG] Diagnostic Summary:');
    console.log('Issues found:', results.issues);
    console.log('Recommendations:', results.recommendations);
    
    // Quick fix suggestions
    console.log('\n🔧 [DEBUG] Quick Fix Suggestions:');
    console.log('1. Make sure you are logged in as admin');
    console.log('2. Click the "Edit Mode" button if it exists');
    console.log('3. Check browser console for any JavaScript errors');
    console.log('4. Try refreshing the page');
    
    return results;
}

// Auto-run diagnostics only in development or when explicitly enabled
// Check URL parameters or localStorage for debug flag
const urlParams = new URLSearchParams(window.location.search);
const debugEnabled = urlParams.has('debug') || localStorage.getItem('ve-debug-enabled') === 'true';

if (debugEnabled) {
    setTimeout(async () => {
        console.log('🚀 [DEBUG] Auto-running visual editor diagnostics (debug mode enabled)...');
        window.debugVisualEditor = debugVisualEditor;
        debugVisualEditor();
    }, 3000);
} else {
    // Silent mode - only make function available, don't auto-run
    console.log('🔍 [DEBUG] Visual editor debug script loaded. Use debugVisualEditor() to run diagnostics or add ?debug to URL for auto-run.');
}

// Always make the debug function available globally
window.debugVisualEditor = debugVisualEditor;

// Make available globally
if (typeof window !== 'undefined') {
    window.debugVisualEditor = debugVisualEditor;
    console.log('🔍 [DEBUG] Debug function available as window.debugVisualEditor()');
}
