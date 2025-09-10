/**
 * @fileoverview Navigation loader for main navigation HTML injection
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Navigation loading system:
 * - Fetches main navigation HTML from partials
 * - Injects navigation into page DOM
 * - Emits nav:loaded event for other scripts
 * - Handles loading errors gracefully
 *
 * @performance Implements efficient HTML fetching and injection
 * @requires /partials/main-nav.html for navigation content
 */
(async () => {
  try {
    console.log('Loading navigation...');
    
    // Fetch the navigation HTML
    const response = await fetch('/partials/main-nav.html');
    if (!response.ok) {
      throw new Error(`Failed to load navigation: ${response.statusText}`);
    }
    
    const html = await response.text();
    
          const scrubVEids = rawHtml => {
                // Use the DOM so we don’t accidentally mangle inline scripts/templates
                    const tmp = document.createElement('div');
                tmp.innerHTML = rawHtml;
                // ✅ UPDATED: Only remove data-ve-button-id, keep data-ve-block-id for navigation editing
                tmp.querySelectorAll('[data-ve-button-id]')
                       .forEach(el => {
                             el.removeAttribute('data-ve-button-id');
                             // Keep data-ve-block-id for navigation link editing
                           });
                return tmp.innerHTML;
              };
      const cleanHtml = scrubVEids(html);
      
    // Find the header element and insert navigation after it
    const header = document.querySelector('header');
    if (header) {
        header.insertAdjacentHTML('afterend', cleanHtml);
    } else {
      // Fallback: insert at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', cleanHtml);
    }
    
    // Emit custom event to signal navigation is loaded
    document.dispatchEvent(new CustomEvent('nav:loaded'));
    console.log('✅ Navigation loaded successfully');
    
  } catch (error) {
    console.error('❌ Failed to load navigation:', error);
    
    // Fallback: show error message to user
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'background: #ff4444; color: white; padding: 1rem; text-align: center; font-weight: bold;';
    errorMsg.textContent = 'Navigation failed to load. Please refresh the page.';
    document.body.insertAdjacentElement('afterbegin', errorMsg);
  }
})();
