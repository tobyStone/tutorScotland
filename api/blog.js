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

        // Select a hero image from available images
        const heroImages = [
            '/images/parentAndChild.PNG',
            '/images/childStudy.PNG',
            '/images/tutorStatic1.PNG',
            '/images/tutorStatic2.PNG',
            '/images/tutorStatic3.PNG',
            '/images/tutorStatic4.PNG'
        ];
        const heroImage = heroImages[Math.floor(Math.random() * heroImages.length)];

        // Generate HTML for the blog grid with hero section
        const postsHtml = `
        <!-- Hero Banner -->
        <section class="blog-hero-banner fade-in-section">
            <div class="blog-hero-overlay">
                <h1>Tutors Alliance Scotland Blog</h1>
                <p>Insights, tips and news for tutors, parents and students</p>
                <div class="hero-filter-buttons">
                    <button type="button" class="category-filter-btn category-all ${!category ? 'active' : ''}" data-category="">All Posts</button>
                    <button type="button" class="category-filter-btn category-general ${category === 'general' ? 'active' : ''}" data-category="general">General</button>
                    <button type="button" class="category-filter-btn category-parent ${category === 'parent' ? 'active' : ''}" data-category="parent">Parent</button>
                    <button type="button" class="category-filter-btn category-tutor ${category === 'tutor' ? 'active' : ''}" data-category="tutor">Tutor</button>
                </div>
            </div>
        </section>

        <!-- Blog Grid Layout -->
        <div class="blog-grid-container">
            ${postPairs.map((pair, pairIndex) => `
            <!-- Blog Row ${pairIndex + 1} -->
            <div class="blog-row fade-in-section">
                ${pair.map((post, postIndex) => {
                    // Alternate styles between posts
                    const styleClass = (pairIndex + postIndex) % 2 === 0 ? 'parent-gradient-bg' : 'tutor-gradient-bg';
                    const boxClass = (pairIndex + postIndex) % 2 === 0 ? 'parent-box' : 'tutor-box';

                    // Get category display name
                    let categoryDisplay = '';
                    let categoryClass = '';

                    if (post.category && post.category.length > 0) {
                        if (post.category.includes('parent') && post.category.includes('tutor')) {
                            categoryDisplay = 'General';
                            categoryClass = 'category-general';
                        } else if (post.category.includes('parent')) {
                            categoryDisplay = 'Parent';
                            categoryClass = 'category-parent';
                        } else if (post.category.includes('tutor')) {
                            categoryDisplay = 'Tutor';
                            categoryClass = 'category-tutor';
                        }
                    }

                    return `
                <div class="blog-card">
                    <div class="blog-card-inner">
                        ${post.imagePath ?
                            `<div class="blog-image-container">
                                <img src="${post.imagePath}" alt="${post.title}" class="blog-card-image">
                                ${categoryDisplay ? `<span class="blog-category ${categoryClass}">${categoryDisplay}</span>` : ''}
                            </div>` :
                            `${categoryDisplay ? `<span class="blog-category ${categoryClass} no-image">${categoryDisplay}</span>` : ''}`
                        }
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
            // Get category display name for full post
            let categoryDisplay = '';
            let categoryClass = '';

            if (post.category && post.category.length > 0) {
                if (post.category.includes('parent') && post.category.includes('tutor')) {
                    categoryDisplay = 'General';
                    categoryClass = 'category-general';
                } else if (post.category.includes('parent')) {
                    categoryDisplay = 'Parent';
                    categoryClass = 'category-parent';
                } else if (post.category.includes('tutor')) {
                    categoryDisplay = 'Tutor';
                    categoryClass = 'category-tutor';
                }
            }

            return `
            <!-- Full Blog Post ${index + 1} -->
            <section id="post-${post._id}" class="blog-full-post fade-in-section" style="display: none;">
                <div class="blog-post-hero" style="background-image: url('${post.imagePath || heroImage}')">
                    <div class="blog-post-hero-overlay">
                        <h1>${post.title}</h1>
                        <p>By ${post.author}</p>
                        ${categoryDisplay ? `<span class="blog-category ${categoryClass}">${categoryDisplay}</span>` : ''}
                    </div>
                </div>
                <div class="blog-post-content">
                    <a href="/blog" class="blog-back-button">&larr; Back to all posts</a>
                    <div class="blog-post-text">
                        ${post.content}
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
            /* Blog Hero Banner */
            .blog-hero-banner {
              position: relative;
              width: 100%;
              height: 400px;
              background: linear-gradient(rgba(0, 27, 68, 0.7), rgba(0, 87, 183, 0.7)),
                          url('${heroImage}') center/cover no-repeat;
              margin-bottom: 3rem;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              border-radius: 0;
            }

            .blog-hero-overlay {
              padding: 2rem;
              color: white;
              max-width: 800px;
              z-index: 2;
            }

            .blog-hero-overlay h1 {
              font-size: 3rem;
              margin-bottom: 1rem;
              text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }

            .blog-hero-overlay p {
              font-size: 1.5rem;
              opacity: 0.9;
              text-shadow: 0 1px 2px rgba(0,0,0,0.3);
              margin-bottom: 1.5rem;
            }

            .hero-filter-buttons {
              display: flex;
              gap: 1rem;
              justify-content: center;
              flex-wrap: wrap;
              margin-top: 1.5rem;
            }

            .blog-hero-banner .category-filter-btn {
              background-color: rgba(255, 255, 255, 0.2);
              backdrop-filter: blur(5px);
              border: 1px solid rgba(255, 255, 255, 0.3);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }

            .blog-hero-banner .category-filter-btn.active {
              background-color: rgba(255, 255, 255, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.5);
              box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
            }

            /* Blog Grid Layout Styles */
            .blog-grid-container {
              display: flex;
              flex-direction: column;
              gap: 2.5rem;
              max-width: 1200px;
              margin: 0 auto 3rem;
              padding: 0 1.5rem;
            }

            .blog-row {
              display: flex;
              flex-wrap: wrap;
              gap: 2.5rem;
              justify-content: center;
            }

            .blog-card {
              flex: 1;
              min-width: 300px;
              max-width: 580px;
              margin-bottom: 1rem;
              border-radius: 0.75rem;
              overflow: hidden;
              box-shadow: 0 6px 18px rgba(0, 57, 122, 0.12);
              transition: transform 0.3s ease, box-shadow 0.3s ease;
              background-color: #f8f9fa;
            }

            .blog-card:hover {
              transform: translateY(-5px);
              box-shadow: 0 12px 28px rgba(0, 57, 122, 0.18);
            }

            .blog-card-inner {
              height: 100%;
              display: flex;
              flex-direction: column;
              border-radius: 0.75rem;
              overflow: hidden;
              background-color: white;
            }

            .blog-image-container {
              width: 100%;
              height: 280px;
              overflow: hidden;
              position: relative;
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
              padding: 1.75rem;
              display: flex;
              flex-direction: column;
              flex-grow: 1;
              background-color: white;
            }

            .blog-card-title {
              font-size: 1.6rem;
              margin-bottom: 0.75rem;
              color: #0057B7;
              line-height: 1.3;
            }

            .blog-card-byline {
              font-size: 0.95rem;
              color: #666;
              margin-bottom: 1.25rem;
            }

            .blog-card-excerpt {
              margin-bottom: 1.75rem;
              flex-grow: 1;
              line-height: 1.7;
              color: #333;
            }

            .blog-read-more {
              align-self: flex-start;
              padding: 0.6rem 1.2rem;
              background-color: #0057B7;
              color: white;
              text-decoration: none;
              border-radius: 0.3rem;
              font-weight: 500;
              transition: all 0.3s ease;
              box-shadow: 0 2px 5px rgba(0, 87, 183, 0.2);
            }

            .blog-read-more:hover {
              background-color: #003A7A;
              box-shadow: 0 4px 8px rgba(0, 87, 183, 0.3);
              transform: translateY(-2px);
            }

            /* Category badges */
            .blog-category {
              position: absolute;
              top: 1rem;
              right: 1rem;
              padding: 0.5rem 1rem;
              border-radius: 2rem;
              font-weight: 600;
              font-size: 0.85rem;
              color: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              z-index: 2;
            }

            .blog-category.no-image {
              position: relative;
              display: inline-block;
              margin: 1rem 0 0 1rem;
            }

            .category-general {
              background: linear-gradient(135deg, #9C27B0, #673AB7);
            }

            .category-parent {
              background: linear-gradient(135deg, #0057B7, #00A3E0);
            }

            .category-tutor {
              background: linear-gradient(135deg, #4CAF50, #8BC34A);
            }

            /* Full blog post styles */
            .blog-post-hero {
              position: relative;
              width: 100%;
              height: 450px;
              background-position: center;
              background-size: cover;
              margin-bottom: 2rem;
            }

            .blog-post-hero-overlay {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 3rem 2rem 2rem;
              background: linear-gradient(transparent, rgba(0,0,0,0.7));
              color: white;
            }

            .blog-post-hero-overlay h1 {
              font-size: 2.5rem;
              margin-bottom: 0.5rem;
              text-shadow: 0 2px 4px rgba(0,0,0,0.4);
            }

            .blog-post-hero-overlay p {
              font-size: 1.1rem;
              opacity: 0.9;
              margin-bottom: 1rem;
            }

            .blog-post-hero-overlay .blog-category {
              position: relative;
              top: auto;
              right: auto;
              display: inline-block;
            }

            .blog-post-content {
              max-width: 900px;
              margin: 0 auto 3rem;
              padding: 0 1.5rem;
            }

            .blog-back-button {
              display: inline-block;
              margin-bottom: 2rem;
              padding: 0.6rem 1.2rem;
              background-color: #f0f0f0;
              color: #333;
              text-decoration: none;
              border-radius: 0.3rem;
              transition: all 0.3s ease;
              font-weight: 500;
            }

            .blog-back-button:hover {
              background-color: #e0e0e0;
              transform: translateX(-3px);
            }

            .blog-post-text {
              background-color: white;
              padding: 2.5rem;
              border-radius: 0.75rem;
              box-shadow: 0 4px 16px rgba(0, 57, 122, 0.08);
              line-height: 1.8;
              color: #333;
              font-size: 1.05rem;
            }

            .blog-post-text h2,
            .blog-post-text h3 {
              color: #0057B7;
              margin: 2rem 0 1rem;
              line-height: 1.4;
            }

            .blog-post-text h2 {
              font-size: 1.8rem;
            }

            .blog-post-text h3 {
              font-size: 1.5rem;
            }

            .blog-post-text p {
              margin-bottom: 1.25rem;
            }

            .blog-post-text img {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              margin: 1.5rem 0;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .blog-post-text a {
              color: #0057B7;
              text-decoration: none;
              border-bottom: 1px solid rgba(0, 87, 183, 0.3);
              transition: border-color 0.3s ease;
            }

            .blog-post-text a:hover {
              border-color: rgba(0, 87, 183, 0.8);
            }

            .blog-post-text ul,
            .blog-post-text ol {
              margin-bottom: 1.5rem;
              padding-left: 1.5rem;
            }

            .blog-post-text li {
              margin-bottom: 0.75rem;
            }

            .blog-post-text blockquote {
              margin: 2rem 0;
              padding: 1rem 1.5rem;
              border-left: 4px solid #0057B7;
              background-color: rgba(0, 87, 183, 0.05);
              font-style: italic;
              color: #444;
            }

            /* Category filter buttons */
            .category-filter-btn {
              padding: 0.6rem 1.2rem;
              border: none;
              border-radius: 2rem;
              font-weight: 600;
              font-size: 0.9rem;
              color: white;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              opacity: 0.75;
            }

            .category-filter-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              opacity: 0.9;
            }

            .category-filter-btn.active {
              opacity: 1;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            }

            .category-all {
              background: linear-gradient(135deg, #0057B7, #003A7A);
            }

            .category-general {
              background: linear-gradient(135deg, #9C27B0, #673AB7);
            }

            .category-parent {
              background: linear-gradient(135deg, #0057B7, #00A3E0);
            }

            .category-tutor {
              background: linear-gradient(135deg, #4CAF50, #8BC34A);
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
              .blog-hero-banner {
                height: 300px;
              }

              .blog-hero-overlay h1 {
                font-size: 2.2rem;
              }

              .blog-hero-overlay p {
                font-size: 1.2rem;
              }

              .blog-card {
                flex: 0 0 100%;
                max-width: 100%;
              }

              .blog-image-container {
                height: 220px;
              }

              .blog-post-hero {
                height: 350px;
              }

              .blog-post-hero-overlay h1 {
                font-size: 2rem;
              }

              .category-filter-btn {
                padding: 0.5rem 1rem;
                font-size: 0.85rem;
              }
            }

            @media (max-width: 480px) {
              .blog-hero-banner {
                height: 250px;
              }

              .blog-hero-overlay h1 {
                font-size: 1.8rem;
              }

              .blog-image-container {
                height: 200px;
              }

              .blog-post-hero {
                height: 280px;
              }

              .blog-post-text {
                padding: 1.5rem;
              }

              .category-filter-btn {
                padding: 0.4rem 0.8rem;
                font-size: 0.8rem;
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

            <!-- Hidden form for category filtering -->
            <form id="blogFilterForm" style="display: none;">
                <input type="hidden" id="categorySelect" name="category" value="${category || ''}">
            </form>

            <!-- Add padding between sections -->
            <div style="margin: 2rem 0;"></div>

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

            // Set the active filter button based on the current category
            const currentCategory = '${category || ''}';
            const catSelect = document.getElementById('categorySelect');
            if (catSelect) {
              catSelect.value = currentCategory;
            }

            // Add click event to all filter buttons (both in hero and filter section)
            const filterButtons = document.querySelectorAll('.category-filter-btn');
            filterButtons.forEach(btn => {
              // Add click event to each filter button
              btn.addEventListener('click', function() {
                const selectedCat = this.dataset.category;

                // Update the hidden input
                catSelect.value = selectedCat;

                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));

                // Add active class to all buttons with the same category
                document.querySelectorAll('.category-filter-btn[data-category="' + selectedCat + '"]').forEach(
                  matchingBtn => matchingBtn.classList.add('active')
                );

                // Navigate to filtered URL
                let newUrl = '/blog';
                if (selectedCat) {
                  newUrl += '?category=' + encodeURIComponent(selectedCat);
                }
                window.location.href = newUrl;
              });
            });

            // Check if we're viewing a specific post
            const urlPath = window.location.pathname;
            const postId = urlPath.match(/\\/blog\\/([a-f0-9]+)$/);

            if (postId && postId[1]) {
              // We're viewing a specific post
              const targetPostId = postId[1];
              const targetPost = document.getElementById('post-' + targetPostId);

              if (targetPost) {
                // Hide the grid, hero banner, and mission row
                document.querySelector('.blog-grid-container').style.display = 'none';
                const heroBanner = document.querySelector('.blog-hero-banner');
                if (heroBanner) heroBanner.style.display = 'none';
                document.querySelector('.mission-row').style.display = 'none';
                targetPost.style.display = 'block';

                // Update the page title
                const h1Element = targetPost.querySelector('h1');
                const h2Element = targetPost.querySelector('h2');
                const postTitle = (h1Element && h1Element.textContent) || (h2Element && h2Element.textContent) || 'Blog Post';
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
                const heroBanner = document.querySelector('.blog-hero-banner');
                if (heroBanner) heroBanner.style.display = 'none';
                document.querySelector('.mission-row').style.display = 'none';

                const fullPost = document.getElementById('post-' + clickedPostId);
                if (fullPost) {
                  fullPost.style.display = 'block';

                  // Update the page title
                  const h1Element = fullPost.querySelector('h1');
                  const h2Element = fullPost.querySelector('h2');
                  const postTitle = (h1Element && h1Element.textContent) || (h2Element && h2Element.textContent) || 'Blog Post';
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

                // Show the grid, hero banner, and mission row
                document.querySelector('.blog-grid-container').style.display = 'flex';
                const heroBanner = document.querySelector('.blog-hero-banner');
                if (heroBanner) heroBanner.style.display = 'flex';
                document.querySelector('.mission-row').style.display = 'flex';

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
                const heroBanner = document.querySelector('.blog-hero-banner');
                if (heroBanner) heroBanner.style.display = 'none';
                document.querySelector('.mission-row').style.display = 'none';

                const targetPost = document.getElementById('post-' + targetPostId);
                if (targetPost) {
                  targetPost.style.display = 'block';

                  // Update the page title
                  const h1Element = targetPost.querySelector('h1');
                  const h2Element = targetPost.querySelector('h2');
                  const postTitle = (h1Element && h1Element.textContent) || (h2Element && h2Element.textContent) || 'Blog Post';
                  document.title = postTitle + ' - Tutors Alliance Scotland Blog';
                }
              } else {
                // We're back to the main blog page
                document.querySelectorAll('.blog-full-post').forEach(post => {
                  post.style.display = 'none';
                });
                document.querySelector('.blog-grid-container').style.display = 'flex';
                const heroBanner = document.querySelector('.blog-hero-banner');
                if (heroBanner) heroBanner.style.display = 'flex';
                document.querySelector('.mission-row').style.display = 'flex';
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
