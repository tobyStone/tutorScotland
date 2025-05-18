// api/blog.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');

module.exports = async (req, res) => {
    try {
        await connectToDatabase();

        // Grab ?category= from the query string (e.g. /blog?category=secondary)
        const { category } = req.query;

        // Build a query object:
        let query = {};

        if (category && category !== 'all') {
            if (category === 'general') {
                // "General" means posts that have BOTH "parent" and "tutor" in the category array.
                query.category = { $all: ['parent', 'tutor'] };
            } else {
                // Otherwise, filter by the specific category.
                query.category = category;
            }
        }

        // Fetch posts from DB with the optional filter, sorted by newest first
        const posts = await Blog.find(query).sort({ createdAt: -1 });

        // Build HTML for each post with alternating styles
        const postsHtml = posts.map((post, index) => {
            // Alternate between parent-box and tutor-box styles
            const isEven = index % 2 === 0;

            if (isEven) {
                return `
                <!-- BLOG POST: Full-width section -->
                <section class="parents-zone-section fade-in-section">
                    <div class="zone-gradient-bg parent-gradient-bg">
                        <div class="zone-list-row">
                            <div class="parent-box curve-bottom-left">
                                <h2>${post.title}</h2>
                                <p class="byline">By ${post.author}</p>
                                ${post.imagePath ? `<img src="${post.imagePath}" alt="Blog image" class="blog-image" style="max-width: 100%; height: auto; margin: 1rem auto; border-radius: 0.5rem; display: block;">` : ''}
                                <div style="text-align: left; margin: 1rem auto; max-width: 800px;">
                                    ${post.content}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                `;
            } else {
                return `
                <!-- BLOG POST: Full-width section -->
                <section class="tutor-zone-section fade-in-section">
                    <div class="zone-gradient-bg tutor-gradient-bg">
                        <div class="zone-list-row">
                            <div class="tutor-box curve-bottom-left">
                                <h2>${post.title}</h2>
                                <p class="byline">By ${post.author}</p>
                                ${post.imagePath ? `<img src="${post.imagePath}" alt="Blog image" class="blog-image" style="max-width: 100%; height: auto; margin: 1rem auto; border-radius: 0.5rem; display: block;">` : ''}
                                <div style="text-align: left; margin: 1rem auto; max-width: 800px;">
                                    ${post.content}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                `;
            }
        }).join('\n\n        <!-- Add padding between sections -->\n        <div style="margin: 3.6rem 0;"></div>\n\n');

        // Create the full HTML page with the filter form
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <link rel="icon" href="/images/bannerShield2.png" type="image/png">
          <title>Tutors Alliance Scotland Blog</title>
          <link rel="stylesheet" href="/styles2.css">
          <link rel="stylesheet" href="/header-banner.css">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="/responsive-helper.js"></script>
          <script src="/js/dynamic-nav.js" defer></script>
      </head>
      <body>
          <!-- Shared banner/header -->
          <header>
              <h1>Tutors Alliance Scotland</h1>
              <div class="header-links">
                  <a href="index.html" class="banner-login-link login-box">Home</a>
                  <a href="login.html?role=admin" class="banner-login-link login-box">Login</a>
              </div>
          </header>

          <!-- Dark-blue nav below banner -->
          <nav class="main-nav">
              <ul>
                  <li><a href="about-us.html">About Us</a></li>
                  <li><a href="tutorMembership.html">Tutor Membership</a></li>
                  <li><a href="parents.html">Enter Parent Zone</a></li>
                  <li><a href="contact.html">Contact Us</a></li>
                  <li><a href="/blog">Blog</a></li>
                  <li><a href="tutorDirectory.html">Tutor Directory</a></li>
              </ul>
          </nav>

          <!-- Rolling banner container -->
          <div class="rolling-banner">
              <div class="rolling-content" id="tutorBanner">
                  <!-- JS will populate tutor names/subjects here -->
              </div>
          </div>

          <main>
            <div class="mission-row">
                <!-- LEFT COLUMN: Shield + Ribbons -->
                <div class="left-col">
                    <img src="/images/centralShield.png" alt="Large STA Shield" class="main-shield" id="imageShield">
                    <img src="/images/bannerWithRibbons.png" alt="Banner Ribbon" class="main-ribbons" id="imageBanner">
                </div>

                <!-- RIGHT COLUMN: heading + about-us text -->
                <div class="right-col">
                    <div class="about-us-landing" id="aboutUsLanding">
                        <h1 class="mission-statement">TAS Blog</h1>
                    </div>
                </div>
            </div>

            <!-- Filter Form -->
            <section class="faq-section fade-in-section">
                <div class="faq-overlay-card curve-bottom-right">
                    <h2>Filter Blog Posts</h2>
                    <form id="blogFilterForm" style="margin: 1.5rem auto; max-width: 500px;">
                        <div style="display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap;">
                            <label for="categorySelect" style="font-weight: bold; font-size: 1.1rem;">Filter by category:</label>
                            <select id="categorySelect" name="category" style="padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid #ccc;">
                                <option value="">(All Posts)</option>
                                <option value="general">General</option>
                                <option value="parent">Parent</option>
                                <option value="tutor">Tutor</option>
                            </select>
                            <button type="submit" class="button aurora">Apply Filter</button>
                        </div>
                    </form>
                </div>
            </section>

            <!-- Add padding between sections -->
            <div style="margin: 3.6rem 0;"></div>

            <!-- Blog posts -->
            ${postsHtml}
          </main>

          <script>
            // Fetch tutors for the rolling banner
            fetch('/api/tutors?format=json')
              .then(res => res.json())
              .then(tutors => {
                const text = tutors.map(t => \`\${t.name} (\${t.subjects.join(', ')})\`).join(' | ');
                document.getElementById('tutorBanner').innerText = text;
              })
              .catch(err => console.error('Error fetching tutors:', err));

            // Set the dropdown to the current category (if any)
            const currentCategory = '${category || ''}';
            const catSelect = document.getElementById('categorySelect');
            if (catSelect) {
              catSelect.value = currentCategory;
            }

            // When the filter form is submitted, reload the page with ?category=...
            document.getElementById('blogFilterForm').addEventListener('submit', function(e) {
              e.preventDefault();
              const selectedCat = catSelect.value;
              let newUrl = '/blog';
              if (selectedCat) {
                newUrl += '?category=' + encodeURIComponent(selectedCat);
              }
              window.location.href = newUrl;
            });
          </script>

          <!-- Fade-in animation script -->
          <script>
              // Fade-in animation for sections
              const fadeEls = document.querySelectorAll('.fade-in-section');

              // Set initial styles
              fadeEls.forEach(el => {
                  el.style.opacity = '0';
                  el.style.transform = 'translateY(20px)';
              });

              // Create the Intersection Observer
              const observer = new IntersectionObserver((entries, obs) => {
                  entries.forEach(entry => {
                      if (entry.isIntersecting) {
                          // Fade it in
                          entry.target.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                          entry.target.style.opacity = '1';
                          entry.target.style.transform = 'translateY(0)';

                          // Once triggered, stop observing so it doesn't re-animate if user scrolls away
                          obs.unobserve(entry.target);
                      }
                  });
              }, { threshold: 0.1 }); // threshold=0.1 => trigger at 10% visibility

              // Observe each fadeEl
              fadeEls.forEach(el => observer.observe(el));

              // Single Intersection Observer for all fade-in elements
              const fadeObserver = new IntersectionObserver((entries) => {
                  entries.forEach(entry => {
                      if (entry.isIntersecting) {
                          entry.target.classList.add('is-visible');
                          fadeObserver.unobserve(entry.target);
                      }
                  });
              }, {
                  root: null,
                  rootMargin: '0px',
                  threshold: 0.1
              });

              // Function to observe all fade-in elements
              function observeFadeElements() {
                  // Observe all sections with fade-in-section class
                  document.querySelectorAll('.fade-in-section').forEach(section => {
                      fadeObserver.observe(section);
                  });
              }

              // Initial observation when DOM is loaded
              document.addEventListener('DOMContentLoaded', () => {
                  observeFadeElements();
              });
          </script>
      </body>
      </html>
    `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (err) {
        console.error('Error in blog route:', err);
        return res.status(500).send('<p>Server Error</p>');
    }
};
