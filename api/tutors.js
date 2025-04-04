const connectToDatabase = require('./connectToDatabase');
const mongoose = require('mongoose');

// Define Tutor Schema
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,
    badges: [String],
    imagePath: String,
    postcodes: [String]
});

let Tutor;
try {
    Tutor = mongoose.model('Tutor');
} catch {
    Tutor = mongoose.model('Tutor', tutorSchema);
}

module.exports = async (req, res) => {
    await connectToDatabase();

    const { subject, mode, postcode } = req.query;

    try {
        let query = {};

        console.log("Received query parameters:", { subject, mode, postcode });

        // A small dictionary for synonyms or partial matches
        const subjectSynonyms = {
            mathematics: 'math',   // so if user picks 'mathematics', we search 'math'
            english: 'english'     // user picks 'english', we search 'english'
            // add more synonyms if you want
        };

        if (subject) {
            // e.g. if user picks 'mathematics', synonyms[subject.toLowerCase()] is 'math'
            const pattern = subjectSynonyms[subject.toLowerCase()] || subject;
            // We'll do a partial match ignoring case
            query.subjects = { $regex: pattern, $options: 'i' };
        }

        if (mode === "online") {
            query.postcodes = { $in: ["Online"] };
        } else if (mode === "in-person" && postcode) {
            query.postcodes = { $in: [postcode] };
        }

        console.log("MongoDB Query:", JSON.stringify(query, null, 2));
        const tutors = await Tutor.find(query, '-description')
            .sort({ costRange: 1 }); // Ascending order: cheapest to most expensive

        console.log("Tutors found:", tutors.length > 0 ? tutors : "No tutors found");

        const tutorsHtml = tutors.map(tutor => `
            <section class="tutor-card">
        <!-- Remove or comment out the anchor tag -->
        <!-- <a href="/tutor/${tutor._id}"> -->
            <img src="${tutor.imagePath}" alt="Tutor ${tutor.name}">
        <!-- </a> -->
                <h3>${tutor.name}</h3>
                    <p>Subjects: ${tutor.subjects.join(', ')}</p>
                    <p>Cost: <span class="purple-pound">${tutor.costRange.replace(/__P__/g, '&pound')} per hour</span></p>
                  <ul>
                    ${tutor.badges.map(badge => `
                        <li class="badge-item">
                            ${badge} <span class="badge-tick">&#10004;</span>
                        </li>
                    `).join('')}
                </ul>
              <p class="available-in custom-style">
                <strong>Available in:</strong> ${tutor.postcodes.join(', ')}
              </p>
          </section>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Tutors Alliance Scotland - Find Your Tutor</title>
                <link rel="icon" href="/images/bannerShield2.png" type="image/png">
                <link rel="stylesheet" href="/style.css">
                <script src="/responsive-helper.js"></script>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
               <!-- Shared banner/header -->
    <header>
        <h1>Tutors Alliance Scotland</h1>
            <div class="header-links">
            <a href="/index.html" class="banner-login-link login-box">Home</a>
            <a href="/login.html?role=admin" class="banner-login-link login-box">Login</a>
            </div>
    </header>

    <!-- Dark-blue nav below banner -->
    <nav class="main-nav">
        <ul>
            <li><a href="/about-us.html">About Us</a></li>
            <li><a href="/tutorMembership.html">Tutor Membership</a></li>
            <li><a href="/parents.html">Enter Parent Zone</a></li>
            <li><a href="/contact.html">Contact Us</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/tutorDirectory.html">Tutor Directory</a></li>
        </ul>
    </nav>


    <!-- Rolling banner container -->
    <div class="rolling-banner">
        <div class="rolling-content" id="tutorBanner">
            <!-- JS will populate tutor names/subjects here -->
        </div>
    </div>
                <main>
                     <div class="left-col">
                        <img src="/images/centralShield.png" alt="Large STA Shield" class="main-shield" id="imageShield">
                        <img src="/images/bannerWithRibbons.png" alt="Banner Ribbon" class="main-ribbons" id="imageBanner">
                    </div>

                    <div class="pricing-key">
                        <p>
                            <span class="purple-pound">&pound</span> : &pound15-20 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound</span> : &pound20-25 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound&pound</span> : &pound25-30 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound&pound&pound</span> : &pound30-35 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound&pound&pound&pound</span> : &pound35+ per hour
                        </p>
                    </div>
                    <div class="tutor-grid">${tutorsHtml}</div>
                    <script>
                        document.querySelector('.thistle-leaf img').addEventListener('animationend', function() {
                            const tutorCards = document.querySelectorAll('.tutor-card');
                            tutorCards.forEach((card, index) => {
                                setTimeout(() => {
                                    card.classList.add('show');
                                }, index * 300);  // Delay each card by 300ms
                            });
                            const tutorgrids = document.querySelectorAll('.tutor-grid');
                            tutorgrids.forEach((grid, index) => {
                                setTimeout(() => {
                                    grid.classList.add('show');
                                }, index * 300);  // Delay each card by 300ms
                            });

                            document.querySelector('.pricing-key').classList.add('show');
                        });
                    </script>
                </main>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (error) {
        console.error("Error fetching tutors:", error);
        return res.status(500).send('<p>Internal Server Error</p>');
    }
};
