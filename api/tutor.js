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

    const { slug } = req.query; // Extract tutor ID from the query parameters

    if (!slug) {
        return res.status(400).send('<p>Error: Tutor ID is missing.</p>');
    }

    try {
        const tutor = await Tutor.findById(slug).exec();

        if (!tutor) {
            return res.status(404).send('<p>Tutor not found.</p>');
        }

        // Generate HTML dynamically for the selected tutor
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${tutor.name} - Tutor Profile</title>
            <link rel="stylesheet" href="/style.css">
            <style>
                .tutor-profile {
                    text-align: center;
                    padding: 20px;
                }
                .tutor-profile img {
                    max-width: 200px;
                    border-radius: 4px;
                }
                .tutor-profile h1 {
                    margin-top: 10px;
                }
                .tutor-profile p {
                    font-size: 1.1em;
                }
                .tutor-profile ul {
                    list-style: none;
                    padding: 0;
                }
                .tutor-profile li::before {
                    content: "? ";
                    color: green;
                    margin-right: 5px;
                }
            </style>
        </head>
        <body>
            <header>
                <h1>Tutor Scotland</h1>
                <nav>
                    <a href="/about">About Us</a>
                    <a href="/login">Login</a>
                </nav>
            </header>
            <main>
                <div class="tutor-profile">
                    <img src="${tutor.imagePath}" alt="Tutor ${tutor.name}">
                    <h1>${tutor.name}</h1>
                    <p><strong>Subjects:</strong> ${tutor.subjects.join(', ')}</p>
                    <p><strong>Cost:</strong> ${tutor.costRange}</p>
                    <ul>
                        ${tutor.badges.map(badge => `<li>${badge}</li>`).join('')}
                    </ul>
                    <p><strong>Available in:</strong> ${tutor.postcodes.join(', ')}</p>
                    <a href="/tutors">Back to Tutors</a>
                </div>
            </main>
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (error) {
        console.error("Error fetching tutor details:", error);
        return res.status(500).send('<p>Internal Server Error</p>');
    }
};
