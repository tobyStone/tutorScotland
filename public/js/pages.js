/**
 * @fileoverview Page configuration constants for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Static page configuration:
 * - Defines all available pages in the application
 * - Used by navigation and routing systems
 * - Maintains consistent page naming across the app
 *
 * @exports PAGES - Array of page identifiers
 */

/**
 * Array of all available pages in the application
 * @type {string[]}
 * @constant
 */
const PAGES = [
  'index',
  'about-us',
  'contact',
  'parents',
  // 'tutorConnect', // Now redirects to external MemberMojo
  'tutorDirectory',
  'tutorMembership',
  'tutorszone',
  'partnerships',
  'rolling-banner'
];

// Export compatibility for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
    // Node.js/CommonJS environment
    module.exports = { PAGES };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to window for global access
    window.PAGES = PAGES;
}

// ES module export (must be at top level)
export { PAGES };
