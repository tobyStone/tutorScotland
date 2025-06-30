/**
 * Visual Editor ID Test Script
 * 
 * This script can be run in the browser console to verify that:
 * 1. No duplicate data-ve-button-id attributes exist
 * 2. Navigation elements don't have visual editor IDs
 * 3. Section-scoped selectors are working correctly
 * 
 * Usage: Copy and paste this into browser console on any page
 */

function testVisualEditorIds() {
    console.log('🧪 Testing Visual Editor ID System...\n');
    
    // Test 1: Check for duplicate button IDs
    console.log('1️⃣ Checking for duplicate button IDs...');
    const buttonIds = [...document.querySelectorAll('[data-ve-button-id]')]
        .map(el => el.dataset.veButtonId);
    
    const duplicateIds = buttonIds.filter((id, index, arr) => arr.indexOf(id) !== index);
    
    if (duplicateIds.length === 0) {
        console.log('✅ No duplicate button IDs found');
    } else {
        console.error('❌ Duplicate button IDs detected:', [...new Set(duplicateIds)]);
        duplicateIds.forEach(id => {
            const elements = document.querySelectorAll(`[data-ve-button-id="${id}"]`);
            console.error(`   ID "${id}" found on ${elements.length} elements:`, elements);
        });
    }
    
    // Test 2: Check navigation elements don't have VE IDs
    console.log('\n2️⃣ Checking navigation elements...');
    const navElements = document.querySelectorAll('.main-nav [data-ve-button-id], nav [data-ve-button-id]');
    
    if (navElements.length === 0) {
        console.log('✅ No navigation elements have visual editor IDs');
    } else {
        console.error('❌ Navigation elements with VE IDs found:', navElements);
    }
    
    // Test 3: Check section scoping
    console.log('\n3️⃣ Checking section scoping...');
    const sectionsWithButtons = document.querySelectorAll('[data-ve-section-id] [data-ve-button-id]');
    const unscopedButtons = document.querySelectorAll('[data-ve-button-id]:not([data-ve-section-id] [data-ve-button-id])');
    
    console.log(`   Buttons in sections: ${sectionsWithButtons.length}`);
    console.log(`   Unscoped buttons: ${unscopedButtons.length}`);
    
    if (unscopedButtons.length > 0) {
        console.warn('⚠️ Some buttons are not in sections:', unscopedButtons);
    }
    
    // Test 4: Verify unique ID generation
    console.log('\n4️⃣ Testing ID uniqueness...');
    const allIds = new Set(buttonIds);
    
    if (allIds.size === buttonIds.length) {
        console.log('✅ All button IDs are unique');
    } else {
        console.error('❌ Duplicate IDs detected in uniqueness test');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total buttons with IDs: ${buttonIds.length}`);
    console.log(`   Unique IDs: ${allIds.size}`);
    console.log(`   Navigation elements with IDs: ${navElements.length}`);
    console.log(`   Scoped buttons: ${sectionsWithButtons.length}`);
    
    const passed = duplicateIds.length === 0 && navElements.length === 0 && allIds.size === buttonIds.length;
    console.log(`\n${passed ? '✅ ALL TESTS ARE PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return {
        passed,
        totalButtons: buttonIds.length,
        uniqueIds: allIds.size,
        duplicates: duplicateIds.length,
        navElementsWithIds: navElements.length,
        scopedButtons: sectionsWithButtons.length
    };
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(testVisualEditorIds, 1000); // Wait for dynamic content
        });
    } else {
        setTimeout(testVisualEditorIds, 1000);
    }
}

// Export for manual use
window.testVisualEditorIds = testVisualEditorIds;
