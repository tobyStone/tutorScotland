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

    // Initialize navigation buckets after DOM is ready
    window.navBuckets = {
        tutors: document.getElementById('tutors-submenu'),
        parents: document.getElementById('parents-submenu'),
        about: document.getElementById('about-tas-submenu')
    };
    let menuTimeout = null;
    let isHovering = false;
    let lastScrollY = window.scrollY;

    if (!nav || !navToggle) {
        console.error('Navigation elements not found');
        return;
    }

    // Function to check if menu should be closed based on scroll position
    const shouldCloseMenu = () => {
        if (!nav.classList.contains('nav-open')) return false;
        
        const menuBottom = nav.getBoundingClientRect().bottom;
        const viewportHeight = window.innerHeight;
        const scrollThreshold = 2.5 * 16; // 2.5rem in pixels
        
        // Only close if we've scrolled past the menu by 2.5rem
        return menuBottom < (viewportHeight - scrollThreshold);
    };

    // Hamburger menu toggle
    navToggle.addEventListener('click', function() {
        const isOpen = nav.classList.toggle('nav-open');
        navToggle.setAttribute('aria-expanded', isOpen);
        
        // Close all submenus when toggling main menu
        if (!isOpen) {
            nav.querySelectorAll('.has-submenu.open').forEach(menu => {
                menu.classList.remove('open');
            });
        }
        
        // Clear any existing timeout
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
                if (!isHovering && shouldCloseMenu()) {
                    nav.classList.remove('nav-open');
                    navToggle.setAttribute('aria-expanded', 'false');
                    // Also close any open submenus
                    nav.querySelectorAll('.has-submenu.open').forEach(menu => {
                        menu.classList.remove('open');
                    });
                }
            }, 1000);
        }
    });

    // Mobile accordion functionality for submenus
    submenuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Only handle on mobile
            if (window.innerWidth <= 900) {
                e.preventDefault();
                const parentLi = this.parentElement;
                
                // Close other open submenus
                nav.querySelectorAll('.has-submenu.open').forEach(openMenu => {
                    if (openMenu !== parentLi) {
                        openMenu.classList.remove('open');
                    }
                });
                
                // Toggle current submenu
                parentLi.classList.toggle('open');
            }
        });
    });

    // Close mobile menu on scroll
    const handleScroll = () => {
        if (window.innerWidth <= 900) {
            const currentScrollY = window.scrollY;
            // Only close if scrolling down and not hovering
            if (currentScrollY > lastScrollY && !isHovering && shouldCloseMenu()) {
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

        // Add each published page to the appropriate navigation bucket
        publishedPages.forEach(page => {
            const category = (page.navCategory || 'about').toLowerCase();
            const targetSubmenu = window.navBuckets[category] || window.navBuckets.about;

            if (!targetSubmenu) {
                console.error(`Navigation bucket not found for category: ${category}`);
                return;
            }

            // Check if the link already exists
            const existingLink = Array.from(targetSubmenu.querySelectorAll('a')).find(
                link => link.href.endsWith(`/page/${page.slug}`)
            );

            if (!existingLink) {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = `/page/${page.slug}`;
                link.textContent = page.heading;
                listItem.appendChild(link);
                targetSubmenu.appendChild(listItem);
                console.log(`Added custom page to ${category} dropdown: ${page.heading} -> /page/${page.slug}`);
            } else {
                console.log(`Link already exists in ${category} dropdown: ${page.heading}`);
            }
        });

        console.info(`✅ Successfully added ${publishedPages.length} custom page(s) to navigation dropdowns.`);

        // After adding pages, add section anchors
        await addSectionAnchors();

    } catch (error) {
        console.error('Error adding custom pages to navigation:', error);
    }
}

// Function to add section anchors to navigation
async function addSectionAnchors() {
    try {
        console.log('Fetching sections for navigation anchors...');
        const response = await fetch('/api/sections?showInNav=true');
        if (!response.ok) {
            console.log('No sections with navigation links found');
            return;
        }

        const sections = await response.json();
        const navSections = sections.filter(section => section.showInNav && !section.isFullPage);

        if (navSections.length === 0) {
            console.log('No sections configured for navigation display');
            return;
        }

        console.log(`Found ${navSections.length} sections to add to navigation`);

        navSections.forEach(section => {
            const category = (section.navCategory || 'about').toLowerCase();
            const targetSubmenu = window.navBuckets[category] || window.navBuckets.about;

            if (!targetSubmenu) {
                console.error(`Navigation bucket not found for section category: ${category}`);
                return;
            }

            // Determine the URL base
            const urlBase = section.page === 'index' ? '/' : `/${section.page}.html`;
            const href = `${urlBase}#${section.navAnchor || section.heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}`;

            // Check if link already exists
            const existingLink = Array.from(targetSubmenu.querySelectorAll('a')).find(
                link => link.getAttribute('href') === href
            );

            if (!existingLink) {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = href;
                link.textContent = section.heading;
                listItem.appendChild(link);
                targetSubmenu.appendChild(listItem);
                console.log(`Added section anchor to ${category} dropdown: ${section.heading} -> ${href}`);
            } else {
                console.log(`Section anchor already exists in ${category} dropdown: ${section.heading}`);
            }
        });

        console.info(`✅ Successfully added ${navSections.length} section anchor(s) to navigation dropdowns.`);

    } catch (error) {
        console.error('Error adding section anchors to navigation:', error);
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
