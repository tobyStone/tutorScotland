/**
 * nav-loader.js - Loads the main navigation from partials and emits nav:loaded event
 * This script fetches the navigation HTML and injects it into the page
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
