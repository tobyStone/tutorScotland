/**
 * @fileoverview Rolling banner functionality for news and tutor information
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Rolling banner system:
 * - Initializes rolling banner on all pages
 * - Fetches news content from sections API
 * - Falls back to tutor information if no news available
 * - Integrates with responsive-helper.js for animation
 *
 * @requires responsive-helper.js for initRollingBanner function
 * @performance Implements efficient content fetching and animation
 */
// Rolling banner initialization is now handled entirely by responsive-helper.js
// This file is kept for backward compatibility but no longer performs initialization
// to prevent race conditions between multiple initialization systems.

console.log('rolling-banner.js: Initialization delegated to responsive-helper.js to prevent race conditions');
