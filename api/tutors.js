const connectToDatabase = require('./connectToDatabase');
const mongoose = require('mongoose');

// Import the Tutor model
let Tutor;
try {
    // Try to get the existing model first
    Tutor = mongoose.model('Tutor');
} catch {
    // If it doesn't exist, import it from the models directory
    try {
        Tutor = require('../models/Tutor');
    } catch (error) {
        console.error('Error importing Tutor model:', error);
        // Fallback to a simple model definition if the import fails
        const tutorSchema = new mongoose.Schema({
            name: String,
            subjects: [String],
            costRange: String,
            badges: [String],
            imagePath: String,
            description: String,
            postcodes: [String],
            contact: String
        });
        Tutor = mongoose.model('Tutor', tutorSchema);
    }
}

module.exports = async (req, res) => {
    try {
        // Connect to the database with better error handling
        await connectToDatabase();
        console.log('Database connected successfully');

        // Check if this is a request for the tutor list (for rolling banner)
        if (req.url === '/api/tutorlist' || req.query.format === 'json') {
            const tutors = await Tutor.find({}, 'name subjects -_id').lean();
            return res.status(200).json(tutors);
        }

        const { subject, mode = '', postcode } = req.query;
        const modeLc = mode.toLowerCase().trim();
        let query = {};

        console.log("Received query parameters:", { subject, mode, postcode });

        const subjectSynonyms = {
            mathematics: 'math',
            maths: 'math',   // NEW
            math: 'math',   // self?map for completeness
            english: 'english'
        };

        if (subject) {
            const input = subject.toLowerCase().trim();
            const synonym = subjectSynonyms[input] || input;   // fall back to itself
            query.subjects = { $regex: synonym, $options: 'i' };
        }


        if (modeLc === "online") {
            query.postcodes = { $regex: /^online$/i };
        } else if (modeLc === "in-person" && postcode) {
            // Make postcode search more flexible
            query.postcodes = {
                $regex: new RegExp(postcode, 'i')
            };
        }

        console.log("MongoDB Query:", JSON.stringify(query, null, 2));
        const tutors = await Tutor.find(query)
            .sort({ costRange: 1 })
            .lean(); // Use lean() for better performance

        console.log("Raw tutors result:", JSON.stringify(tutors, null, 2));

        // Generate HTML for tutors or show a message if none found
        let tutorsHtml = '';

        if (tutors.length > 0) {
            tutorsHtml = tutors.map(tutor => `
                <section class="tutor-card">
                    <img src="${tutor.imagePath || '/images/tutor0.jpg'}"   
                    alt="Tutor ${tutor.name}"
                    onerror="this.src='/images/tutor0.jpg'"
                    class="tutor-image" loading="lazy"                 
                    decoding="async"
                    width="300" height="200"    
                    style="object-fit:cover">
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
                    ${tutor.contact ? `
                    <div class="tutor-contact">
                        <a href="${tutor.contact.includes('@') ? 'mailto:' + tutor.contact : tutor.contact}" class="contact-btn" target="${tutor.contact.includes('@') ? '_self' : '_blank'}">
                            ${tutor.contact.includes('@') ? 'Email Tutor' : 'Visit Website'}
                        </a>
                    </div>
                    ` : ''}
                </section>
            `).join('');
        } else {
            tutorsHtml = `
                <div class="no-tutors-message">
                    <h3>No tutors found matching your criteria</h3>
                 </div>
            `;
        }

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
                <style>
                    /* Ensure tutor cards are visible by default */
                    .tutor-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin: 20px 0;
                        opacity: 1 !important;
                    }
                    .tutor-directory-page #imageShield {
                        top: 177px !important;
                        left: 60% !important;
                    }

                    /* Make #imageBanner just below shield’s bottom edge */
                    .tutor-directory-page #imageBanner {
                      top: 507px !important; /* Example: you may need to tweak 25% or 28% or 30% */
                      left: 60% !important;
                    }


                    /* Adjust for smaller screens */
                    @media (max-width: 900px) {
                        .tutor-grid {
                            grid-template-columns: repeat(2, 1fr);
                        }
                    }

                    /* Single column for portrait on mobile */
                    @media (max-width: 600px) and (orientation: portrait) {
                        .tutor-grid {
                            grid-template-columns: 1fr;
                        }

                        /* Hide shield and ribbons on portrait mobile */
                        .left-col {
                            display: none !important;
                        }

                        /* Adjust layout for portrait mode */
                        .right-col {
                            width: 100%;
                            float: none;
                            margin: 0 auto;
                            padding: 0 15px;
                        }

                        .mission-statement {
                            text-align: center;
                            margin-bottom: 1.5rem;
                        }

                        .search-summary {
                            text-align: center;
                        }
                    }

                    /* Position the left column with shield and ribbons */
                    .left-col {
                        float: left;
                        width: 150px;
                        margin-left: 20px; /* Move slightly to the right */
                        position: relative;
                    }

                    .main-shield, .main-ribbons {
                        max-width: 100%;
                        height: auto;
                        display: block;
                        margin: 0 auto;
                    }

                    .tutor-card {
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        padding: 15px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        opacity: 1 !important;
                        transform: none !important;
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                    }

                    .tutor-card:hover {
                        transform: translateY(-5px) !important;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    }

                    .tutor-image {
                        width: 100%;
                        height: 200px; /* Fixed height for consistency */
                        object-fit: cover; /* Maintain aspect ratio while filling the container */
                        object-position: center; /* Center the image */
                        border-radius: 4px;
                        margin-bottom: 10px;
                        border: 1px solid #ddd;
                    }

                    .tutor-card h3 {
                        margin-top: 0;
                        color: #0057B7;
                    }

                    .badge-item {
                        margin-bottom: 5px;
                    }

                    .badge-tick {
                        color: green;
                        font-weight: bold;
                    }

                    .pricing-key {
                        background: #f9f9f9;
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                        opacity: 1 !important;
                    }

                    .purple-pound {
                        color: #C8A2C8;
                        font-weight: bold;
                    }

                    /* Additional styling for search results page */
                    .search-summary {
                        margin: 20px 0;
                        font-size: 1.1em;
                        line-height: 1.5;
                    }

                    .search-again {
                        margin: 20px 0 30px;
                        text-align: left;
                        padding-left: 180px; /* Position to the right of the shield */
                    }

                    /* Adjust for portrait mode */
                    @media (max-width: 600px) and (orientation: portrait) {
                        .search-again {
                            padding-left: 0;
                            text-align: center;
                            margin-bottom: 15px;
                        }

                        .right-col {
                            width: 100%;
                            margin-left: 0;
                        }

                        /* Adjust layout for portrait mode */
                        main {
                            display: flex;
                            flex-direction: column;
                        }

                        .pricing-key {
                            order: 2;
                            margin-top: 10px;
                        }

                        .tutor-results-container {
                            order: 3;
                        }
                    }

                    .btn {
                        display: inline-block;
                        padding: 10px 20px;
                        background-color: #0057B7;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        margin-right: 10px;
                        transition: background-color 0.3s ease;
                    }

                    .btn:hover {
                        background-color: #003d80;
                    }

                    .no-tutors-message {
                        text-align: center;
                        padding: 30px;
                        background: #f9f9f9;
                        border-radius: 8px;
                        margin: 30px 0;
                    }

                    .no-tutors-message h3 {
                        color: #0057B7;
                        margin-top: 0;
                    }

                    /* Contact button styling */
                    .tutor-contact {
                        margin-top: 15px;
                        text-align: center;
                    }

                    .contact-btn {
                        display: inline-block;
                        padding: 8px 15px;
                        background-color: #C8A2C8;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        font-size: 0.9em;
                        transition: background-color 0.3s ease;
                    }

                    .contact-btn:hover {
                        background-color: #b48fb4;
                    }

                    .tutor-results-container {
                        clear: both;
                        margin: 20px 0;
                        padding: 20px;
                        background: #f9f9f9;
                        border-radius: 8px;
                    }

                    .results-heading {
                        color: #0057B7;
                        margin-top: 0;
                        margin-bottom: 20px;
                        text-align: center;
                        font-size: 1.5em;
                    }


                </style>
            </head>
            <body class="tutor-directory-page">
               <!-- Shared banner/header -->
    <header>
        <h1>Tutors Alliance Scotland</h1>
            <div class="header-links">
            <a href="/" class="banner-login-link login-box">Home</a>
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
            <div class="content-flex-wrapper">
                    <div class="left-col">
                        <img src="/images/centralShield.png" alt="Large STA Shield" class="main-shield" id="imageShield">
                        <img src="/images/bannerWithRibbons.png" alt="Banner Ribbon" class="main-ribbons" id="imageBanner">
                    </div>

                    <div class="right-col">
                        <h2 class="mission-statement">Tutor Search Results</h2>

                    <div class="pricing-key">
                        <p>
                            <span class="purple-pound">&pound</span> : &pound15-20 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound</span> : &pound20-25 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound&pound</span> : &pound25-30 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound&pound&pound</span> : &pound30-35 per hour &nbsp;&nbsp;
                            <span class="purple-pound">&pound&pound&pound&pound&pound</span> : &pound35+ per hour
                        </p>
                    </div>
                    <div class="tutor-results-container">
                        <h3 class="results-heading">${tutors.length > 0 ? 'Available Tutors' : 'No Tutors Found'}</h3>
                        <div class="tutor-grid">${tutorsHtml}</div>
                    </div>
                    <script>
                        // Immediately show tutor cards without waiting for animation
                        document.addEventListener('DOMContentLoaded', function() {
                            const tutorCards = document.querySelectorAll('.tutor-card');
                            tutorCards.forEach((card, index) => {
                                setTimeout(() => {
                                    card.classList.add('show');
                                }, index * 300);  // Delay each card by 300ms
                            });

                            const tutorGrid = document.querySelector('.tutor-grid');
                            if (tutorGrid) {
                                tutorGrid.classList.add('show');
                            }

                            const pricingKey = document.querySelector('.pricing-key');
                            if (pricingKey) {
                                pricingKey.classList.add('show');
                            }
                        });
                    </script>
                </div>
                </div>
                </main>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (error) {
        console.error("Error in tutors API:", error);

        // Send a more detailed error message for debugging
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .error { color: red; background: #ffeeee; padding: 10px; border-radius: 5px; }
                    .message { margin-top: 20px; }
                    .stack { margin-top: 20px; white-space: pre-wrap; background: #f5f5f5; padding: 10px; }
                </style>
            </head>
            <body>
                <h1>Something went wrong</h1>
                <div class="error">${error.message}</div>
                <div class="message">We're having trouble connecting to the database. Please try again later.</div>
                <div class="stack">${error.stack}</div>
                <p><a href="/">Return to home page</a></p>
            </body>
            </html>
        `;

        return res.status(500).send(errorHtml);
    }
};
