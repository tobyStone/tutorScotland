// api/blog.js
const connectToDatabase = require('./connectToDatabase');
const Blog = require('../models/Blog');

module.exports = async (req, res) => {
    try {
        await connectToDatabase();

        // 1. Fetch all blog posts from DB
        const posts = await Blog.find({}).sort({ createdAt: -1 }); // newest first

        // 2. Build HTML for each post
        const postsHtml = posts.map(post => `
      <section class="blog-entry">
        <img src="${post.imagePath}" alt="Blog image" class="blog-image">
        <h2>${post.title}</h2>
        <p>${post.content}</p>
      </section>
    `).join('');

        // 3. Return a full HTML page
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <link rel="icon" href="/images/bannerShield2.png" type="image/png">
          <title>Tutors Alliance Scotland Blog</title>
          <link rel="stylesheet" href="/style.css">
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
            ${postsHtml}
          </main>
       <script>
         // Same logic as in index.html to fetch tutors for the rolling banner
         fetch('/api/tutorList')
           .then(res => res.json())
           .then(tutors => {
             const text = tutors.map(t => \`\${t.name} (\${t.subjects.join(', ')})\`).join(' | ');
             document.getElementById('tutorBanner').innerText = text;
           })
           .catch(err => console.error('Error fetching tutors:', err));
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
