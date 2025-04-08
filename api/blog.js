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
                // "General" means posts that have BOTH "primary" and "secondary" in the category array.
                query.category = { $all: ['primary', 'secondary'] };
            } else {
                // Otherwise, filter by the specific category.
                query.category = category;
            }
        }

        // Fetch posts from DB with the optional filter, sorted by newest first
        const posts = await Blog.find(query).sort({ createdAt: -1 });

        // Build HTML for each post
        const postsHtml = posts.map(post => `
      <section class="blog-entry">
        <img src="${post.imagePath}" alt="Blog image" class="blog-image">
        <h2>${post.title}</h2>
        <p>${post.content}</p>
      </section>
    `).join('');

        // Create the full HTML page with the filter form
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <link rel="icon" href="/images/bannerShield2.png" type="image/png">
          <title>Tutors Alliance Scotland Blog</title>
          <link rel="stylesheet" href="/style.css">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            <!-- Filter Form -->
            <section class="blog-filter">
              <form id="blogFilterForm">
                <label for="categorySelect"><strong>Filter by:</strong></label>
                <select id="categorySelect" name="category">
                  <option value="">(None)</option>
                  <option value="general">General</option>
                  <option value="secondary">Secondary</option>
                  <option value="primary">Primary</option>
                </select>
                <button type="submit">Apply</button>
              </form>
            </section>

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
