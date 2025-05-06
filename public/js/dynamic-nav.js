/**
 * dynamic-nav.js - Adds custom pages to the navigation menu
 * This script fetches all published custom pages and adds them to the navigation menu
 */

// Function to add custom pages to the navigation menu
async function addCustomPagesToNav() {
    try {
        // Fetch all published custom pages
        const response = await fetch('/api/sections?isFullPage=true');
        if (!response.ok) {
            console.error('Failed to fetch custom pages');
            return;
        }
        
        const pages = await response.json();
        
        // Filter only published pages
        const publishedPages = pages.filter(page => page.isPublished);
        
        // If there are no published pages, exit
        if (publishedPages.length === 0) {
            return;
        }
        
        // Get the navigation menu
        const navMenu = document.querySelector('.main-nav ul');
        if (!navMenu) {
            console.error('Navigation menu not found');
            return;
        }
        
        // Create a dropdown container for custom pages if there are more than 2
        if (publishedPages.length > 2) {
            // Check if we already have a custom pages dropdown
            const existingDropdown = document.querySelector('.custom-pages-dropdown');
            if (existingDropdown) {
                // Update the existing dropdown
                const dropdownContent = existingDropdown.querySelector('.dropdown-content');
                dropdownContent.innerHTML = '';
                
                publishedPages.forEach(page => {
                    const link = document.createElement('a');
                    link.href = `/page/${page.slug}`;
                    link.textContent = page.heading;
                    dropdownContent.appendChild(link);
                });
            } else {
                // Create a new dropdown
                const dropdownLi = document.createElement('li');
                dropdownLi.className = 'custom-pages-dropdown';
                
                const dropdownBtn = document.createElement('a');
                dropdownBtn.href = '#';
                dropdownBtn.className = 'dropdown-btn';
                dropdownBtn.textContent = 'Custom Pages';
                
                const dropdownContent = document.createElement('div');
                dropdownContent.className = 'dropdown-content';
                
                publishedPages.forEach(page => {
                    const link = document.createElement('a');
                    link.href = `/page/${page.slug}`;
                    link.textContent = page.heading;
                    dropdownContent.appendChild(link);
                });
                
                dropdownLi.appendChild(dropdownBtn);
                dropdownLi.appendChild(dropdownContent);
                
                // Add the dropdown to the navigation menu before the last item
                navMenu.insertBefore(dropdownLi, navMenu.lastElementChild);
            }
        } else {
            // Add individual links for each page
            publishedPages.forEach(page => {
                // Check if the link already exists
                const existingLink = Array.from(navMenu.querySelectorAll('a')).find(
                    link => link.href.endsWith(`/page/${page.slug}`)
                );
                
                if (!existingLink) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = `/page/${page.slug}`;
                    a.textContent = page.heading;
                    li.appendChild(a);
                    
                    // Add the link to the navigation menu before the last item
                    navMenu.insertBefore(li, navMenu.lastElementChild);
                }
            });
        }
    } catch (error) {
        console.error('Error adding custom pages to navigation:', error);
    }
}

// Call the function when the DOM is loaded
document.addEventListener('DOMContentLoaded', addCustomPagesToNav);
