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
          <title>STA Blog</title>
          <link rel="stylesheet" href="/style.css">
      </head>
      <body>
          <header>
              <h1>Scottish Tutors Association - Blog</h1>
              <nav>
                  <a href="index.html">Home</a>
                  <a href="about-us.html">About Us</a>
                  <a href="login.html?role=blogwriter">Blog Writer Login</a>
                  <a href="/">Home</a>
              </nav>
          </header>

          <main>
            ${postsHtml}
          </main>
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
