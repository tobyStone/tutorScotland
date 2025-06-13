/**
 * dynamic-nav.js - Enhanced navigation with dropdown support and mobile functionality
 * This script handles mobile menu toggle, dropdown interactions, and adds custom pages
 */

/* ============================= NAV INTERACTIONS ============================= */
// Wait for navigation to be loaded by nav-loader.js
document.addEventListener('nav:loaded', function() {
    console.log('Initializing navigation interactions...');
    initializeNavigation();
    addCustomPagesToNav();
});

// Initialize navigation interactions
function initializeNavigation() {
    const nav = document.querySelector('.main-nav');
    const navToggle = nav.querySelector('.nav-toggle');
    const submenuLinks = nav.querySelectorAll('.has-submenu > a');
    let menuTimeout = null;
    let isHovering = false;

    if (!nav || !navToggle) {
        console.error('Navigation elements not found');
        return;
    }

    // Hamburger menu toggle
    navToggle.addEventListener('click', function() {
        const isOpen = nav.classList.toggle('nav-open');
        navToggle.setAttribute('aria-expanded', isOpen);
        
        // Clear any existing timeout when manually toggling
        if (menuTimeout) {
            clearTimeout(menuTimeout);
            menuTimeout = null;
        }
    });

    // Handle menu hover states
    nav.addEventListener('mouseenter', () => {
        isHovering = true;
        if (menuTimeout) {
            clearTimeout(menuTimeout);
            menuTimeout = null;
        }
    });

    nav.addEventListener('mouseleave', () => {
        isHovering = false;
        // Only start timeout if we're in mobile view
        if (window.innerWidth <= 900) {
            menuTimeout = setTimeout(() => {
                if (!isHovering) {
                    nav.classList.remove('nav-open');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            }, 1000); // 1 second delay before closing
        }
    });

    // Mobile accordion functionality for submenus
    submenuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Only prevent default and toggle on mobile
            if (window.innerWidth <= 900) {
                e.preventDefault();
                const parentLi = this.parentElement;
                
                // Close other open submenus
                if (!parentLi.classList.contains('open')) {
                    nav.querySelectorAll('.has-submenu.open').forEach(openMenu => {
                        if (openMenu !== parentLi) {
                            openMenu.classList.remove('open');
                        }
                    });
                }
                
                parentLi.classList.toggle('open');
            }
        });
    });

    // Close mobile menu on scroll
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
        if (window.innerWidth <= 900) {
            const currentScrollY = window.scrollY;
            // Only close if scrolling down and not hovering
            if (currentScrollY > lastScrollY && !isHovering) {
                nav.classList.remove('nav-open');
                navToggle.setAttribute('aria-expanded', 'false');
                // Also close any open submenus
                nav.querySelectorAll('.has-submenu.open').forEach(menu => {
                    menu.classList.remove('open');
                });
            }
            lastScrollY = currentScrollY;
        }
    };

    // Use passive scroll listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Function to ensure menu is collapsed on mobile viewports
    const collapseIfMobile = () => {
        if (window.innerWidth <= 900) {
            nav.classList.remove('nav-open');
            navToggle.setAttribute('aria-expanded', 'false');
            // Also close any open submenus
            nav.querySelectorAll('.has-submenu.open').forEach(menu => {
                menu.classList.remove('open');
            });
        }
    };

    // Close mobile menu on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 900) {
            nav.classList.remove('nav-open');
            navToggle.setAttribute('aria-expanded', 'false');
            // Reset all submenus
            nav.querySelectorAll('.has-submenu.open').forEach(menu => {
                menu.classList.remove('open');
            });
        }
        // Also ensure proper mobile state
        collapseIfMobile();
    });

    // Run collapse check on initial load
    collapseIfMobile();

    console.log('✅ Navigation interactions initialized');
}

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

        // Target the "About TAS" submenu specifically
        const aboutTasSubmenu = document.querySelector('#about-tas-submenu');
        if (!aboutTasSubmenu) {
            console.error('About TAS submenu not found - falling back to legacy method');
            addCustomPagesLegacy(publishedPages);
            return;
        }

        // Add each published page as a link in the "About TAS" dropdown
        publishedPages.forEach(page => {
            // Check if the link already exists
            const existingLink = Array.from(aboutTasSubmenu.querySelectorAll('a')).find(
                link => link.href.endsWith(`/page/${page.slug}`)
            );

            if (!existingLink) {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = `/page/${page.slug}`;
                link.textContent = page.heading;
                listItem.appendChild(link);
                aboutTasSubmenu.appendChild(listItem);
                console.log(`Added custom page to About TAS dropdown: ${page.heading} -> /page/${page.slug}`);
            } else {
                console.log(`Link already exists in About TAS dropdown: ${page.heading}`);
            }
        });

        console.info(`✅ Successfully added ${publishedPages.length} custom page(s) to the About TAS dropdown.`);

    } catch (error) {
        console.error('Error adding custom pages to navigation:', error);
    }
}

// Legacy fallback function for adding custom pages (maintains backward compatibility)
function addCustomPagesLegacy(publishedPages) {
    const navMenu = document.querySelector('.main-nav ul');
    if (!navMenu) {
        console.error('Navigation menu not found');
        return;
    }

    // Create a dropdown container for custom pages if there are more than 2
    if (publishedPages.length > 2) {
        console.log('Creating legacy dropdown for multiple pages');
        // Check if we already have a custom pages dropdown
        const existingDropdown = document.querySelector('.custom-pages-dropdown');
        if (existingDropdown) {
            // Update the existing dropdown
            console.log('Updating existing legacy dropdown');
            const dropdownContent = existingDropdown.querySelector('.dropdown-content');
            dropdownContent.innerHTML = '';

            publishedPages.forEach(page => {
                const link = document.createElement('a');
                link.href = `/page/${page.slug}`;
                link.textContent = page.heading;
                dropdownContent.appendChild(link);
                console.log(`Added link to legacy dropdown: ${page.heading} -> /page/${page.slug}`);
            });
        } else {
            // Create a new dropdown
            console.log('Creating new legacy dropdown');
            const dropdownLi = document.createElement('li');
            dropdownLi.className = 'custom-pages-dropdown nav-item';

            const dropdownBtn = document.createElement('a');
            dropdownBtn.href = '#';
            dropdownBtn.className = 'dropdown-btn nav-link';
            dropdownBtn.textContent = 'Custom Pages';

            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content nav-dropdown';

            publishedPages.forEach(page => {
                const link = document.createElement('a');
                link.href = `/page/${page.slug}`;
                link.textContent = page.heading;
                dropdownContent.appendChild(link);
                console.log(`Added link to legacy dropdown: ${page.heading} -> /page/${page.slug}`);
            });

            dropdownLi.appendChild(dropdownBtn);
            dropdownLi.appendChild(dropdownContent);

            // Add the dropdown to the navigation menu before the last item
            navMenu.insertBefore(dropdownLi, navMenu.lastElementChild);
            console.log('Legacy dropdown added to navigation menu');
        }
    } else {
        // Add individual links for each page
        console.log('Adding individual legacy links for pages');
        publishedPages.forEach(page => {
            // Check if the link already exists
            const existingLink = Array.from(navMenu.querySelectorAll('a')).find(
                link => link.href.endsWith(`/page/${page.slug}`)
            );

            if (!existingLink) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                const a = document.createElement('a');
                a.href = `/page/${page.slug}`;
                a.className = 'nav-link';
                a.textContent = page.heading;
                li.appendChild(a);

                // Add the link to the navigation menu before the last item
                navMenu.insertBefore(li, navMenu.lastElementChild);
                console.log(`Added legacy link to menu: ${page.heading} -> /page/${page.slug}`);
            } else {
                console.log(`Legacy link already exists for: ${page.heading}`);
            }
        });
    }
}
