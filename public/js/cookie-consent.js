/**
 * Cookie Consent Manager for TutorScotland
 * Manages user consent for Google Analytics cookies
 * GDPR/UK PECR compliant
 */

(function() {
    'use strict';

    const CONSENT_KEY = 'cookieConsent';
    const CONSENT_TIMESTAMP_KEY = 'cookieConsentTimestamp';
    const CONSENT_EXPIRY_DAYS = 365; // Consent valid for 1 year

    /**
     * Check if consent has been given and is still valid
     */
    function hasValidConsent() {
        const consent = localStorage.getItem(CONSENT_KEY);
        const timestamp = localStorage.getItem(CONSENT_TIMESTAMP_KEY);
        
        if (!consent || !timestamp) return false;
        
        // Check if consent is expired (older than 1 year)
        const consentDate = new Date(parseInt(timestamp));
        const expiryDate = new Date(consentDate);
        expiryDate.setDate(expiryDate.getDate() + CONSENT_EXPIRY_DAYS);
        
        if (new Date() > expiryDate) {
            // Consent expired, clear it
            localStorage.removeItem(CONSENT_KEY);
            localStorage.removeItem(CONSENT_TIMESTAMP_KEY);
            return false;
        }
        
        return consent === 'accepted';
    }

    /**
     * Check if user has made a consent decision (accepted or rejected)
     */
    function hasConsentDecision() {
        return localStorage.getItem(CONSENT_KEY) !== null;
    }

    /**
     * Accept cookies and load Google Analytics
     */
    function acceptCookies() {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        localStorage.setItem(CONSENT_TIMESTAMP_KEY, Date.now().toString());
        
        // Hide banner
        hideBanner();
        
        // Load Google Analytics
        loadGoogleAnalytics();
        
        console.log('✅ Cookie consent accepted - Google Analytics enabled');
    }

    /**
     * Reject cookies
     */
    function rejectCookies() {
        localStorage.setItem(CONSENT_KEY, 'rejected');
        localStorage.setItem(CONSENT_TIMESTAMP_KEY, Date.now().toString());
        
        // Hide banner
        hideBanner();
        
        console.log('❌ Cookie consent rejected - Google Analytics disabled');
    }

    /**
     * Show cookie consent banner
     */
    function showBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.style.display = 'flex';
            // Trigger animation
            setTimeout(() => {
                banner.classList.add('visible');
            }, 10);
        }
    }

    /**
     * Hide cookie consent banner
     */
    function hideBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.classList.remove('visible');
            setTimeout(() => {
                banner.style.display = 'none';
            }, 300); // Match CSS transition duration
        }
    }

    /**
     * Load Google Analytics if consent given
     */
    function loadGoogleAnalytics() {
        // Check if Google Analytics script is already loaded
        if (window.gtag) {
            console.log('📊 Google Analytics already loaded');
            return;
        }

        // Load Google Analytics script
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-7EGJG389YK';
        document.head.appendChild(script);

        // Initialize Google Analytics
        window.dataLayer = window.dataLayer || [];
        function gtag() {
            window.dataLayer.push(arguments);
        }
        window.gtag = gtag;

        gtag('js', new Date());
        gtag('config', 'G-7EGJG389YK', {
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure'
        });

        console.log('📊 Google Analytics loaded');
    }

    /**
     * Initialize cookie consent on page load
     */
    function init() {
        // Check if user has already made a decision
        if (hasConsentDecision()) {
            // If accepted and still valid, load Google Analytics
            if (hasValidConsent()) {
                loadGoogleAnalytics();
            }
        } else {
            // No decision made yet, show banner
            showBanner();
        }

        // Attach event listeners to buttons
        const acceptBtn = document.getElementById('cookie-accept-btn');
        const rejectBtn = document.getElementById('cookie-reject-btn');

        if (acceptBtn) {
            acceptBtn.addEventListener('click', acceptCookies);
        }

        if (rejectBtn) {
            rejectBtn.addEventListener('click', rejectCookies);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose functions for manual control if needed
    window.CookieConsent = {
        accept: acceptCookies,
        reject: rejectCookies,
        hasConsent: hasValidConsent,
        showBanner: showBanner
    };
})();

