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

        if (subject) {
            query.subjects = { $regex: new RegExp(`^${subject}$`, 'i') };
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
                <a href="/tutor/${tutor._id}">
                    <img src="${tutor.imagePath}" alt="Tutor ${tutor.name}">
                </a>
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
                <p><strong>Available in:</strong> ${tutor.postcodes.join(', ')}</p>
            </section>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Tutor Scotland - Find Your Tutor</title>
                <link rel="icon" href="/images/favicon2.png" type="image/png">
                <link rel="stylesheet" href="/style.css">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body>
                <header>
                    <h1>Tutor Scotland</h1>
                    <nav>
                        <a href="about-us.html">About Us</a>
                        <a href="login.html">Login</a>
                    </nav>
                </header>
                <main>
                        <div class="thistle-container">
                            <div class="thistle-center">
                                <img class="thistle-center" src="/images/thistle-center.png" alt="Scottish Thistle">
                            </div>
                            <div class="thistle-leaf">
                                <img class="thistle-leaf" src="/images/thistle-leaf.png" alt="Thistle Leaf">
                            </div>
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
