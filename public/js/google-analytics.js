/**
 * @fileoverview Google Analytics integration for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 2.0.0 - GDPR Compliant
 * @since 2025-01-12
 * @updated 2025-10-17 - Added cookie consent compliance
 *
 * @description Google Analytics 4 (GA4) integration:
 * - Loads Google Analytics gtag.js library asynchronously
 * - Initializes GA4 tracking with proper configuration
 * - Provides enhanced ecommerce and event tracking capabilities
 * - Implements privacy-compliant tracking practices
 * - 🔒 GDPR COMPLIANT: Only loads after user consent
 *
 * @performance Loads asynchronously to avoid blocking page rendering
 * @privacy Respects user privacy preferences and GDPR compliance
 *
 * NOTE: This script is now a placeholder. Actual Google Analytics loading
 * happens in cookie-consent.js after user accepts cookies.
 */

(function() {
    'use strict';

    // Google Analytics 4 Measurement ID
    const GA_MEASUREMENT_ID = 'G-7EGJG389YK';

    // 🔒 DO NOT auto-load Google Analytics
    // It will be loaded by cookie-consent.js only if user accepts cookies

    console.log('📊 Google Analytics script loaded (waiting for user consent)');
    console.log('📊 Analytics will only initialize after cookie consent is given');

    /**
     * Determine the type of page for analytics tracking
     * @returns {string} Page type identifier
     */
    function getPageType() {
        const path = window.location.pathname;
        const body = document.body;

        // Check for admin pages
        if (path.includes('admin') || body.classList.contains('admin-page')) {
            return 'admin';
        }

        // Check for dynamic pages
        if (body.classList.contains('dynamic-page')) {
            return 'dynamic';
        }

        // Check for specific page types
        if (path.includes('blog')) return 'blog';
        if (path.includes('tutor')) return 'tutor';
        if (path.includes('parent')) return 'parent';
        if (path.includes('contact')) return 'contact';
        if (path.includes('about')) return 'about';
        if (path === '/' || path.includes('index')) return 'home';

        return 'general';
    }

    /**
     * Determine user role for analytics tracking
     * @returns {string} User role identifier
     */
    function getUserRole() {
        // Check URL parameters for role hints
        const urlParams = new URLSearchParams(window.location.search);
        const roleParam = urlParams.get('role');

        if (roleParam) {
            return roleParam;
        }

        // Check for admin authentication (if available)
        if (window.location.pathname.includes('admin')) {
            return 'admin';
        }

        // Default to visitor
        return 'visitor';
    }

    /**
     * Track custom events (available globally)
     * @param {string} eventName - Name of the event
     * @param {Object} parameters - Event parameters
     */
    window.trackEvent = function(eventName, parameters = {}) {
        if (window.gtag) {
            gtag('event', eventName, {
                event_category: parameters.category || 'engagement',
                event_label: parameters.label || '',
                value: parameters.value || 0,
                ...parameters
            });
            console.log(`📊 Tracked event: ${eventName}`, parameters);
        } else {
            console.log('📊 Event not tracked (Google Analytics not loaded):', eventName);
        }
    };

    /**
     * Track form submissions
     * @param {string} formName - Name of the form
     * @param {string} formType - Type of form (contact, registration, etc.)
     */
    window.trackFormSubmission = function(formName, formType = 'form') {
        window.trackEvent('form_submit', {
            category: 'forms',
            label: formName,
            form_type: formType
        });
    };

    /**
     * Track file downloads
     * @param {string} fileName - Name of the downloaded file
     * @param {string} fileType - Type of file (pdf, image, etc.)
     */
    window.trackDownload = function(fileName, fileType = 'unknown') {
        window.trackEvent('file_download', {
            category: 'downloads',
            label: fileName,
            file_type: fileType
        });
    };

    // Expose helper functions globally for use by cookie-consent.js
    window.GAHelpers = {
        getPageType: getPageType,
        getUserRole: getUserRole
    };

})();
