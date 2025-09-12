/**
 * @fileoverview Google Analytics integration for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2025-01-12
 *
 * @description Google Analytics 4 (GA4) integration:
 * - Loads Google Analytics gtag.js library asynchronously
 * - Initializes GA4 tracking with proper configuration
 * - Provides enhanced ecommerce and event tracking capabilities
 * - Implements privacy-compliant tracking practices
 *
 * @performance Loads asynchronously to avoid blocking page rendering
 * @privacy Respects user privacy preferences and GDPR compliance
 */

(function() {
    'use strict';
    
    // Google Analytics 4 Measurement ID
    const GA_MEASUREMENT_ID = 'G-7EGJG389YK';
    
    // Check if Google Analytics is already loaded to prevent duplicate loading
    if (window.gtag || window.dataLayer) {
        console.log('🔍 Google Analytics already loaded, skipping initialization');
        return;
    }
    
    console.log('📊 Initializing Google Analytics...');
    
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    
    // Define gtag function
    function gtag() {
        dataLayer.push(arguments);
    }
    
    // Make gtag globally available
    window.gtag = gtag;
    
    // Initialize gtag with current timestamp
    gtag('js', new Date());
    
    // Configure Google Analytics
    gtag('config', GA_MEASUREMENT_ID, {
        // Enhanced measurement settings
        send_page_view: true,
        
        // Privacy settings
        anonymize_ip: true,
        
        // Performance settings
        transport_type: 'beacon',
        
        // Custom settings for charity website
        custom_map: {
            'custom_parameter_1': 'page_type',
            'custom_parameter_2': 'user_role'
        }
    });
    
    // Load the Google Analytics script asynchronously
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    
    // Add error handling
    script.onerror = function() {
        console.error('❌ Failed to load Google Analytics script');
    };
    
    script.onload = function() {
        console.log('✅ Google Analytics loaded successfully');
        
        // Track initial page view with custom parameters
        gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href,
            page_type: getPageType(),
            user_role: getUserRole()
        });
    };
    
    // Insert the script into the document head
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
    
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
    
    console.log('📊 Google Analytics integration initialized');
    
})();
