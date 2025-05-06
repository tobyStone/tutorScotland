/**
 * dynamic-nav.js - Adds custom pages to the navigation menu
 * This script fetches all published custom pages and adds them to the navigation menu
 */

// Function to add custom pages to the navigation menu
async function addCustomPagesToNav() {
    try {
        console.log('Fetching custom pages for navigation...');
        // Fetch all published custom pages
        const response = await fetch('/api/sections?isFullPage=true');
        if (!response.ok) {
            console.error('Failed to fetch custom pages:', response.status, response.statusText);
            return;
        }

        const pages = await response.json();
        console.log('Custom pages retrieved:', pages);

        // Filter only published pages
        const publishedPages = pages.filter(page => page.isPublished);
        console.log('Published pages:', publishedPages);

        // If there are no published pages, exit
        if (publishedPages.length === 0) {
            console.log('No published pages found');
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
            console.log('Creating dropdown for multiple pages');
            // Check if we already have a custom pages dropdown
            const existingDropdown = document.querySelector('.custom-pages-dropdown');
            if (existingDropdown) {
                // Update the existing dropdown
                console.log('Updating existing dropdown');
                const dropdownContent = existingDropdown.querySelector('.dropdown-content');
                dropdownContent.innerHTML = '';

                publishedPages.forEach(page => {
                    const link = document.createElement('a');
                    link.href = `/page/${page.slug}`;
                    link.textContent = page.heading;
                    dropdownContent.appendChild(link);
                    console.log(`Added link to dropdown: ${page.heading} -> /page/${page.slug}`);
                });
            } else {
                // Create a new dropdown
                console.log('Creating new dropdown');
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
                    console.log(`Added link to dropdown: ${page.heading} -> /page/${page.slug}`);
                });

                dropdownLi.appendChild(dropdownBtn);
                dropdownLi.appendChild(dropdownContent);

                // Add the dropdown to the navigation menu before the last item
                navMenu.insertBefore(dropdownLi, navMenu.lastElementChild);
                console.log('Dropdown added to navigation menu');
            }
        } else {
            // Add individual links for each page
            console.log('Adding individual links for pages');
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
                    console.log(`Added link to menu: ${page.heading} -> /page/${page.slug}`);
                } else {
                    console.log(`Link already exists for: ${page.heading}`);
                }
            });
        }
    } catch (error) {
        console.error('Error adding custom pages to navigation:', error);
    }
}

// Call the function when the DOM is loaded
document.addEventListener('DOMContentLoaded', addCustomPagesToNav);
