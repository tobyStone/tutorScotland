/**
 * Responsive Helper Script for Tutors Alliance Scotland
 * This script provides utility functions for responsive design and UI enhancements
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize responsive features
    initResponsiveFeatures();
    
    // Initialize rolling banner if it exists
    initRollingBanner();
    
    // Add fade-in animations for elements with the fade-in class
    initFadeInAnimations();
});

/**
 * Initialize responsive features
 */
function initResponsiveFeatures() {
    // Add mobile menu toggle functionality if mobile menu exists
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('show');
            mobileMenuToggle.classList.toggle('active');
        });
    }
    
    // Handle viewport adjustments
    adjustForViewport();
    window.addEventListener('resize', adjustForViewport);
}

/**
 * Make adjustments based on viewport size
 */
function adjustForViewport() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const isNarrow = window.innerWidth < 600;
    
    // Add/remove classes based on viewport
    document.body.classList.toggle('portrait-mode', isPortrait);
    document.body.classList.toggle('narrow-viewport', isNarrow);
    
    // Adjust image sizes for small screens
    const mainImages = document.querySelectorAll('.main-shield, .main-ribbons');
    mainImages.forEach(img => {
        if (isNarrow) {
            img.style.maxWidth = '80%';
        } else {
            img.style.maxWidth = '';
        }
    });
}

/**
 * Initialize rolling banner if it exists
 */
function initRollingBanner() {
    const rollingBanner = document.querySelector('.rolling-banner');
    const rollingContent = document.querySelector('.rolling-content');
    
    if (rollingBanner && rollingContent) {
        // If the banner doesn't have content yet, add a loading message
        if (!rollingContent.textContent.trim()) {
            rollingContent.textContent = 'Loading tutor information...';
        }
        
        // Add scrolling animation
        animateRollingBanner(rollingContent);
    }
}

/**
 * Animate the rolling banner content
 */
function animateRollingBanner(element) {
    if (!element) return;
    
    // Only animate if content is wider than container
    const parent = element.parentElement;
    if (element.scrollWidth > parent.clientWidth) {
        // Set up the animation
        element.style.animationName = 'scrollBanner';
        element.style.animationDuration = Math.max(10, element.scrollWidth / 50) + 's';
        element.style.animationTimingFunction = 'linear';
        element.style.animationIterationCount = 'infinite';
    }
}

/**
 * Initialize fade-in animations for elements with the fade-in class
 */
function initFadeInAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in, .fade-in-on-scroll');
    
    if (fadeElements.length === 0) return;
    
    // Create intersection observer for fade-in-on-scroll elements
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    // Apply to each element
    fadeElements.forEach(el => {
        if (el.classList.contains('fade-in-on-scroll')) {
            // Initially hide and observe
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            observer.observe(el);
        } else {
            // Simple fade in
            setTimeout(() => {
                el.classList.add('visible');
            }, 300);
        }
    });
}

// Add CSS for animations if not already in stylesheet
if (!document.querySelector('#responsive-helper-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'responsive-helper-styles';
    styleSheet.textContent = `
        @keyframes scrollBanner {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
        }
        
        .fade-in, .fade-in-on-scroll {
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
        
        .fade-in.visible, .fade-in-on-scroll.visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(styleSheet);
}
