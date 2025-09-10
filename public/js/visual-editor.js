/**
 * @fileoverview DEPRECATED: Legacy visual editor (replaced by visual-editor-v2.js)
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 * @deprecated Use visual-editor-v2.js instead
 *
 * @description Legacy visual editor kept for compatibility:
 * - Replaced by visual-editor-v2.js in production
 * - Maintained for test page compatibility
 * - Exports stub to prevent import errors
 *
 * @todo Remove after all test dependencies are updated
 */

// ⚠️ DEPRECATED: This file has been replaced by visual-editor-v2.js
// This file is kept temporarily for compatibility with test pages
// All production pages should use visual-editor-v2.js instead

console.warn('⚠️ DEPRECATED: visual-editor.js is deprecated. Use visual-editor-v2.js instead.');

// Export a stub to prevent errors in test files that import from this file
export const visualEditor = {
    deprecated: true,
    message: 'This visual editor instance is deprecated. Use visual-editor-v2.js instead.'
};
