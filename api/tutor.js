const connectToDatabase = require('./connectToDatabase');
const mongoose = require('mongoose');

// Define Tutor Schema
const tutorSchema = new mongoose.Schema({
    name: String,
    subjects: [String],
    costRange: String,
    badges: [String],
    imagePath: String,
    postcodes: [String],
    description: String
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


    // Define cost range descriptions
    const costDescriptions = {
        '__P__': '&pound15 - &pound20/hour',
        '__P____P__': '&pound20 - &pound25/hour',
        '__P____P____P__': '&pound25 - &pound30/hour',
        '__P____P____P____P__': '&pound35+/hour'
    };

    // Generate HTML dynamically for the selected tutor
    const costText = costDescriptions[tutor.costRange] || 'Not specified';


        // Generate HTML dynamically for the selected tutor
        const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${tutor.name} - Tutor Profile</title>
        <link rel="stylesheet" href="/style.css">
        <link rel="icon" href="/images/favicon2.png" type="image/png">
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
        <header>
            <h1>Tutor Scotland</h1>
            <nav>
                <a href="/about">About Us</a>
                <a href="login.html">Login</a>
            </nav>
        </header>
        <main>
            <div class="tutor-profile">
                <h1>${tutor.name}</h1>
                <p><strong>Subjects:</strong> ${tutor.subjects.join(', ')}</p>
            </div>
            <!-- Left-Side Thistle -->
            <div class="thistle-container">
                <div class="thistle-center">
                    <img src="/images/thistle-center.png" alt="Thistle Center">
                </div>
                <div class="thistle-leaf">
                    <img src="/images/thistle-leaf.png" alt="Thistle Leaf">
                </div>
            </div>

            <!-- Right-Side Flipped Thistle -->
            <div class="thistle-container-right">
                <div class="thistle-center-flipped">
                    <img src="/images/thistle-center-flipped.png" alt="Thistle Center Flipped">
                </div>
                <div class="thistle-leaf-flipped">
                    <img src="/images/thistle-leaf-flipped.png" alt="Thistle Leaf Flipped">
                </div>
            </div>

            <!-- Centered Tutor Profile -->
            <div class="tutor-profile">
                <img src="${tutor.imagePath}" alt="Tutor ${tutor.name}">
                <p><strong>Cost:</strong> ${costText}</p>
                <ul>
                    ${tutor.badges.map(badge => `<li>${badge}</li>`).join('')}
                </ul>
                <p><strong>Available in:</strong> ${tutor.postcodes.join(', ')}</p>
                <p><strong>Description:</strong> ${tutor.description || 'No description available.'}</p>
                <a href="/tutors">Back to Tutors</a>
            </div>
        </main>

        <script>
            document.addEventListener("DOMContentLoaded", function () {
                document.querySelector(".thistle-center").style.opacity = "1";
                document.querySelector(".thistle-leaf").style.opacity = "1";
                document.querySelector(".thistle-center-flipped").style.opacity = "1";
                document.querySelector(".thistle-leaf-flipped").style.opacity = "1";
            });

              // Retrieve search parameters from sessionStorage
                const searchParams = JSON.parse(sessionStorage.getItem('searchParams'));
                if (searchParams) {
                    const { subject, mode, postcode } = searchParams;
                    let queryParams = new URLSearchParams();
                    if (subject) queryParams.append('subject', subject);
                    if (mode) queryParams.append('mode', mode);
                    if (postcode) queryParams.append('postcode', postcode);

                    // Set the "Back to Tutors" link with query parameters
                    document.getElementById('backToTutors').href = '/tutors?' + queryParams.toString();

        </script>
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
