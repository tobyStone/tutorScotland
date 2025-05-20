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

        // Group posts into pairs for the grid layout
        const postPairs = [];
        for (let i = 0; i < posts.length; i += 2) {
            if (i + 1 < posts.length) {
                // If we have a pair
                postPairs.push([posts[i], posts[i + 1]]);
            } else {
                // If we have an odd number of posts, the last one goes alone
                postPairs.push([posts[i]]);
            }
        }

        // Generate HTML for the blog grid
        const postsHtml = `
        <!-- Blog Grid Layout -->
        <div class="blog-grid-container">
            ${postPairs.map((pair, pairIndex) => `
            <!-- Blog Row ${pairIndex + 1} -->
            <div class="blog-row fade-in-section">
                ${pair.map((post, postIndex) => {
                    // Alternate styles between posts
                    const styleClass = (pairIndex + postIndex) % 2 === 0 ? 'parent-gradient-bg' : 'tutor-gradient-bg';
                    const boxClass = (pairIndex + postIndex) % 2 === 0 ? 'parent-box' : 'tutor-box';

                    return `
                <div class="blog-card">
                    <div class="blog-card-inner ${boxClass} curve-bottom-left">
                        ${post.imagePath ?
                            `<div class="blog-image-container">
                                <img src="${post.imagePath}" alt="${post.title}" class="blog-card-image">
                            </div>` : ''}
                        <div class="blog-card-content">
                            <h2 class="blog-card-title">${post.title}</h2>
                            <p class="blog-card-byline">By ${post.author}</p>
                            ${post.excerpt ?
                                `<p class="blog-card-excerpt">${post.excerpt}</p>` :
                                `<p class="blog-card-excerpt">${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>`}
                            <a href="/blog/${post._id}" class="blog-read-more">Read more</a>
                        </div>
                    </div>
                </div>`;
                }).join('')}
            </div>`).join('')}
        </div>

        <!-- Individual Blog Posts (hidden by default, shown when clicked) -->
        ${posts.map((post, index) => {
            // Alternate between parent-box and tutor-box styles
            const isEven = index % 2 === 0;
            const styleClass = isEven ? 'parent-gradient-bg' : 'tutor-gradient-bg';
            const boxClass = isEven ? 'parent-box' : 'tutor-box';

            return `
            <!-- Full Blog Post ${index + 1} -->
            <section id="post-${post._id}" class="blog-full-post fade-in-section" style="display: none;">
                <div class="zone-gradient-bg ${styleClass}">
                    <div class="zone-list-row">
                        <div class="${boxClass} curve-bottom-left">
                            <a href="/blog" class="blog-back-button">&larr; Back to all posts</a>
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
        }).join('\n\n        <!-- Add padding between sections -->\n        <div style="margin: 2rem 0;"></div>\n\n')}
        `;

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
          <style>
            /* Blog Grid Layout Styles */
            .blog-grid-container {
              display: flex;
              flex-direction: column;
              gap: 2rem;
              max-width: 1200px;
              margin: 0 auto;
              padding: 0 1rem;
            }

            .blog-row {
              display: flex;
              flex-wrap: wrap;
              gap: 2rem;
              justify-content: center;
            }

            .blog-card {
              flex: 1;
              min-width: 300px;
              max-width: 580px;
              margin-bottom: 1rem;
              border-radius: 0.5rem;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 57, 122, 0.1);
              transition: transform 0.3s ease, box-shadow 0.3s ease;
            }

            .blog-card:hover {
              transform: translateY(-5px);
              box-shadow: 0 8px 24px rgba(0, 57, 122, 0.15);
            }

            .blog-card-inner {
              height: 100%;
              display: flex;
              flex-direction: column;
              border-radius: 0.5rem;
              overflow: hidden;
            }

            .blog-image-container {
              width: 100%;
              height: 220px;
              overflow: hidden;
            }

            .blog-card-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              transition: transform 0.5s ease;
            }

            .blog-card:hover .blog-card-image {
              transform: scale(1.05);
            }

            .blog-card-content {
              padding: 1.5rem;
              display: flex;
              flex-direction: column;
              flex-grow: 1;
            }

            .blog-card-title {
              font-size: 1.5rem;
              margin-bottom: 0.5rem;
              color: #0057B7;
            }

            .blog-card-byline {
              font-size: 0.9rem;
              color: #666;
              margin-bottom: 1rem;
            }

            .blog-card-excerpt {
              margin-bottom: 1.5rem;
              flex-grow: 1;
              line-height: 1.6;
            }

            .blog-read-more {
              align-self: flex-start;
              padding: 0.5rem 1rem;
              background-color: #0057B7;
              color: white;
              text-decoration: none;
              border-radius: 0.25rem;
              font-weight: 500;
              transition: background-color 0.3s ease;
            }

            .blog-read-more:hover {
              background-color: #003A7A;
            }

            .blog-back-button {
              display: inline-block;
              margin-bottom: 1rem;
              padding: 0.5rem 1rem;
              background-color: #f0f0f0;
              color: #333;
              text-decoration: none;
              border-radius: 0.25rem;
              transition: background-color 0.3s ease;
            }

            .blog-back-button:hover {
              background-color: #e0e0e0;
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
              .blog-card {
                flex: 0 0 100%;
                max-width: 100%;
              }

              .blog-image-container {
                height: 180px;
              }
            }
          </style>
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

            // Check if we're viewing a specific post
            const urlPath = window.location.pathname;
            const postId = urlPath.match(/\\/blog\\/([a-f0-9]+)$/);

            if (postId && postId[1]) {
              // We're viewing a specific post
              const targetPostId = postId[1];
              const targetPost = document.getElementById('post-' + targetPostId);

              if (targetPost) {
                // Hide the grid and show the specific post
                document.querySelector('.blog-grid-container').style.display = 'none';
                document.querySelector('.faq-section').style.display = 'none';
                targetPost.style.display = 'block';

                // Update the page title
                const postTitle = targetPost.querySelector('h2').textContent;
                document.title = postTitle + ' - Tutors Alliance Scotland Blog';
              }
            }

            // Add click handlers to all "Read more" links
            document.querySelectorAll('.blog-read-more').forEach(link => {
              link.addEventListener('click', function(e) {
                e.preventDefault();
                const postUrl = this.getAttribute('href');
                window.history.pushState({}, '', postUrl);

                // Extract post ID from the URL
                const clickedPostId = postUrl.split('/').pop();

                // Hide all posts and show the clicked one
                document.querySelector('.blog-grid-container').style.display = 'none';
                document.querySelector('.faq-section').style.display = 'none';

                const fullPost = document.getElementById('post-' + clickedPostId);
                if (fullPost) {
                  fullPost.style.display = 'block';

                  // Update the page title
                  const postTitle = fullPost.querySelector('h2').textContent;
                  document.title = postTitle + ' - Tutors Alliance Scotland Blog';

                  // Scroll to top
                  window.scrollTo(0, 0);
                }
              });
            });

            // Handle back button clicks
            document.querySelectorAll('.blog-back-button').forEach(button => {
              button.addEventListener('click', function(e) {
                e.preventDefault();
                window.history.pushState({}, '', '/blog');

                // Hide all full posts
                document.querySelectorAll('.blog-full-post').forEach(post => {
                  post.style.display = 'none';
                });

                // Show the grid and filter
                document.querySelector('.blog-grid-container').style.display = 'flex';
                document.querySelector('.faq-section').style.display = 'block';

                // Reset the page title
                document.title = 'Tutors Alliance Scotland Blog';

                // Scroll to top
                window.scrollTo(0, 0);
              });
            });

            // Handle browser back/forward buttons
            window.addEventListener('popstate', function() {
              const currentPath = window.location.pathname;
              const currentPostId = currentPath.match(/\\/blog\\/([a-f0-9]+)$/);

              if (currentPostId && currentPostId[1]) {
                // We're viewing a specific post
                const targetPostId = currentPostId[1];

                // Hide all posts and show the target one
                document.querySelectorAll('.blog-full-post').forEach(post => {
                  post.style.display = 'none';
                });
                document.querySelector('.blog-grid-container').style.display = 'none';
                document.querySelector('.faq-section').style.display = 'none';

                const targetPost = document.getElementById('post-' + targetPostId);
                if (targetPost) {
                  targetPost.style.display = 'block';

                  // Update the page title
                  const postTitle = targetPost.querySelector('h2').textContent;
                  document.title = postTitle + ' - Tutors Alliance Scotland Blog';
                }
              } else {
                // We're back to the main blog page
                document.querySelectorAll('.blog-full-post').forEach(post => {
                  post.style.display = 'none';
                });
                document.querySelector('.blog-grid-container').style.display = 'flex';
                document.querySelector('.faq-section').style.display = 'block';
                document.title = 'Tutors Alliance Scotland Blog';
              }
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
