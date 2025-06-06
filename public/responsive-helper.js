/**
 * responsive-helper.js  Tutors Alliance Scotland
 * -------------------------------------------------
 * ?  Guarantees every page links the **global style bundle** _and_
 *    `header-banner.css` so dynamic HTML never ships un?styled.
 * ?  Adds viewport / page?type classes to <body> for CSS hooks.
 * ?  Handles the rolling news / tutor banner with width?aware
 *    animation.
 * ?  Provides a single IntersectionObserver fade?in that also
 *    watches for nodes injected later by the dynamic?sections
 *    loader.
 *
 * Drop this file in `/public/js/` and reference it with
 *   <script src="/js/responsive-helper.js" defer></script>
 * on every page (or via your EJS layout).
 * -------------------------------------------------
 */

(() => {
    /* -------------------------------------------------- */
    /* 0  �  CONFIG                                        */
    /* -------------------------------------------------- */
    /** Stylesheets that **must** be present on every page */
    const REQUIRED_STYLES = [
        "/styles2.css",        // main design?system bundle
        "/header-banner.css"   // header / nav specifics
    ];

    /** Pixels per second for the rolling banner */
    const SCROLL_SPEED = 40;

    /* -------------------------------------------------- */
    /* 1  �  UTILITY HELPERS                               */
    /* -------------------------------------------------- */
    /** Inject <link rel="stylesheet"> if it is missing */
    function ensureStylesheets(hrefs) {
        const head = document.head;
        hrefs.forEach(href => {
            if (!head.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = href;
                head.appendChild(link);
            }
        });
    }

    /** throttle helper � avoids running expensive funcs each resize */
    function throttle(fn, wait = 150) {
        let t;
        return function (...args) {
            if (!t) {
                fn.apply(this, args);
                t = setTimeout(() => (t = null), wait);
            }
        };
    }

    /* -------------------------------------------------- */
    /* 2  �  RESPONSIVE FEATURES                            */
    /* -------------------------------------------------- */
    function adjustForViewport() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        const isNarrow = w < 600;
        const isRestricted = (isPortrait && isNarrow) || w < 1200;
        const isPortraitRestricted = isPortrait && w < 1200;

        const body = document.body;
        body.classList.toggle("portrait-mode", isPortrait);
        body.classList.toggle("narrow-viewport", isNarrow);
        body.classList.toggle("restricted-viewport", isRestricted);
        body.classList.toggle("portrait-restricted", isPortraitRestricted);
        body.classList.toggle("contact-page", location.pathname.includes("contact"));

        // Shield / Ribbons visibility & sizing ---------------------------------
        ["imageShield", "imageBanner"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            if (isRestricted) {
                el.style.display = "none";
            } else {
                el.style.display = "";
                el.style.maxWidth = isNarrow ? "80%" : "";
            }
        });

        // parents.html � toggle search form vs directory link -------------------
        const searchFormContainer = document.querySelector(".form-container");
        const directoryLink = document.getElementById("directoryLinkContainer");

        if (searchFormContainer && directoryLink) {
            const showForm = !isRestricted;
            searchFormContainer.style.display = showForm ? "block" : "none";
            directoryLink.style.display = showForm ? "none" : "block";
        }
    }

    function initResponsiveFeatures() {
        // Mobile nav toggle -----------------------------------------------------
        const toggler = document.querySelector(".mobile-menu-toggle");
        const nav = document.querySelector(".main-nav");
        if (toggler && nav) {
            toggler.addEventListener("click", () => {
                nav.classList.toggle("show");
                toggler.classList.toggle("active");
            });
        }

        adjustForViewport();
        window.addEventListener("resize", throttle(adjustForViewport));
    }

    /* -------------------------------------------------- */
    /* 3  �  ROLLING NEWS / TUTOR BANNER                    */
    /* -------------------------------------------------- */
    function animateRollingBanner(el) {
        if (!el) return;
        const parent = el.parentElement;

        if (el.scrollWidth <= parent.clientWidth) {
            // No need to scroll – centre it
            el.style.cssText = "text-align:center;display:block;width:100%;";
            return;
        }

        const duration = Math.max(15, el.scrollWidth / SCROLL_SPEED);
        // inline styles keep things self-contained; class not required
        el.style.cssText = `display:inline-block;white-space:nowrap;padding-left:100%;` +
            `animation:tas-scroll ${duration}s linear infinite;`;
    }

    function loadBannerText() {
        return fetch("/api/sections?page=rolling-banner")
            .then(r => (r.ok ? r.json() : []))
            .then(list => {
                if (list && list.length) {
                    return list.map(s => s.text).join(" | ");
                }
                // fallback: tutors
                return fetch("/api/tutors?format=json")
                    .then(r => (r.ok ? r.json() : []))
                    .then(tutors => tutors.length
                        ? tutors.map(t => `${t.name} (${t.subjects.join(', ')})`).join(" | ")
                        : "Welcome to Tutors Alliance Scotland");
            })
            .catch(() => "Welcome to Tutors Alliance Scotland");
    }

    function initRollingBanner() {
        const wrapper = document.querySelector(".rolling-banner");
        const content = document.querySelector(".rolling-content");
        if (!wrapper || !content) return;

        if (!content.textContent.trim()) {
            content.textContent = "Loading ";
            loadBannerText().then(text => {
                content.textContent = text;
                animateRollingBanner(content);
            });
        } else {
            animateRollingBanner(content);
        }
    }

    /* make it visible to rolling-banner.js (classic script) */
    window.initRollingBanner = initRollingBanner;

    /* -------------------------------------------------- */
    /* 4    FADE?IN OBSERVER WITH FOOTER DELAY             */
    /* -------------------------------------------------- */
    function injectFadeCss() {
        if (document.getElementById("tas-fade-css")) return;
        const css = document.createElement("style");
        css.id = "tas-fade-css";
        css.textContent = `
      .fade-in-section,.fade-in-on-scroll{opacity:0;transform:translateY(20px);transition:opacity .6s ease,transform .6s ease;}
      .is-visible{opacity:1!important;transform:translateY(0)!important;}
      @keyframes tas-scroll{from{transform:translateX(0)}to{transform:translateX(-100%)}}
      @media screen and (max-width:600px) and (orientation:portrait){body.restricted-viewport .rolling-banner{height:auto;padding:8px 0;}}
    `;
        document.head.appendChild(css);
    }

    function initFadeObserver() {
        let hasScrolledDown = false;
        let footerDelayTimeout = null;

        const io = new IntersectionObserver((entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (isIntersecting) {
                    // Special handling for footer - don't fade in immediately
                    if (target.classList.contains('site-footer')) {
                        // Only fade in footer if user has scrolled down and after delay
                        if (hasScrolledDown && !footerDelayTimeout) {
                            footerDelayTimeout = setTimeout(() => {
                                target.classList.add("is-visible");
                                io.unobserve(target);
                            }, 1000); // 1 second delay
                        }
                        return;
                    }

                    // Normal fade-in for all other elements
                    target.classList.add("is-visible");
                    io.unobserve(target);
                }
            });
        }, {
            /* Use gentler trigger for sections */
            threshold: 0.15,
            rootMargin: "0px 0px -10% 0px"
        });

        // Track scroll events to detect when user scrolls down
        let lastScrollY = window.scrollY;
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                hasScrolledDown = true;

                // Check if footer is in view and start delay if needed
                const footer = document.querySelector('.site-footer');
                if (footer && !footer.classList.contains('is-visible') && !footerDelayTimeout) {
                    const footerRect = footer.getBoundingClientRect();
                    const isFooterVisible = footerRect.top < window.innerHeight && footerRect.bottom > 0;

                    if (isFooterVisible) {
                        footerDelayTimeout = setTimeout(() => {
                            footer.classList.add("is-visible");
                            io.unobserve(footer);
                        }, 1000);
                    }
                }

                // Remove scroll listener once we've detected downward scroll
                window.removeEventListener('scroll', handleScroll);
            }
            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        const observeAll = () => {
            document.querySelectorAll(".fade-in-section,.fade-in-on-scroll").forEach(el => {
                // Only observe elements that are NOT the footer with the main observer
                if (!el.classList.contains('site-footer')) {
                    io.observe(el);
                }
            });
        };

        observeAll();

        // auto?observe nodes added later (dynamic sections)
        new MutationObserver(muts => {
            if (muts.some(m => m.addedNodes.length)) {
                muts.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                         // Only observe elements that are NOT the footer with the main observer
                        if (node.nodeType === 1 && (node.classList.contains('fade-in-section') || node.classList.contains('fade-in-on-scroll')) && !node.classList.contains('site-footer')) {
                            io.observe(node);
                        }
                    });
                });
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    /* -------------------------------------------------- */
    /* 5  �  BOOTSTRAP                                      */
    /* -------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", () => {
        ensureStylesheets(REQUIRED_STYLES);
        injectFadeCss();
        initResponsiveFeatures();
        initRollingBanner();
        initFadeObserver();
    });
})();
