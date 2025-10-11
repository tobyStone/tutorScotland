/**
 * @fileoverview Tutors directory API for public tutor search and display
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Public-facing API for tutor directory functionality:
 * - Advanced tutor search with multiple filters
 * - Region-based filtering with synonym support
 * - Subject and cost range filtering
 * - Tutor list generation for rolling banner
 * - Comprehensive HTML generation for tutor directory page
 *
 * @security Public API with no authentication required
 * @performance Implements efficient database queries and caching strategies
 */

const connectToDatabase = require('./connectToDatabase');
const mongoose = require('mongoose');
const { applyAPISecurityHeaders, applyHTMLSecurityHeaders } = require('../utils/security-headers');
const { handleAPIError, handleValidationError } = require('../utils/error-handler');
const { sanitizeString } = require('../utils/input-validation');

function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toKey(str = '') {
  return String(str).toLowerCase().trim().replace(/\s+/g, ' ').replace(/\band\b/g, '&');
}

/**
 * Builds a safe and descriptive contact link object from a contact string.
 * @param {string} contact - The contact string from the database.
 * @returns {object|null} An object with link details or null if contact is empty.
 */
function buildContactLink(contact = '') {
  const raw = (contact || '').trim();
  if (!raw) {
    return null; // Return null if contact is empty after trimming
  }

  // A robust-enough regex for email validation
  const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailRE.test(raw.replace(/^mailto:/i, ''));

  if (isEmail) {
    const emailAddress = raw.replace(/^mailto:/i, '');
    const subject = encodeURIComponent("Tutoring Enquiry via Tutors Alliance Scotland");
    const body = encodeURIComponent("Hi,\n\nI found your profile on the Tutors Alliance Scotland website and I am interested in tutoring services.\n\n");

    return {
      type: 'email',
      href: `mailto:${emailAddress}?subject=${subject}&body=${body}`,
      text: 'Email Tutor',
      address: emailAddress // We need this for the "Copy" button
    };
  }

  // Treat anything else as a web address – add protocol if missing
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return {
    type: 'website',
    href: url,
    target: '_blank',
    text: 'Visit Website'
  };
}

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
            regions: [String],
            contact: String
        });
        Tutor = mongoose.model('Tutor', tutorSchema);
    }
}

/**
 * Validate and sanitize input parameters for tutors API
 * @param {Object} query - Request query parameters
 * @returns {Object} Validation result with sanitized parameters or error
 */
function validateTutorParams(query) {
    const { subject, mode, region, format } = query;
    const errors = [];

    // Validate subject parameter
    if (subject !== undefined) {
        if (typeof subject !== 'string' || subject.length > 100) {
            errors.push('Subject parameter must be a string with maximum 100 characters');
        } else if (subject.length > 0 && !/^[a-zA-Z\s\-&]+$/.test(subject)) {
            errors.push('Subject parameter contains invalid characters');
        }
    }

    // Validate mode parameter
    if (mode !== undefined) {
        if (typeof mode !== 'string' || !['online', 'in-person', ''].includes(mode.toLowerCase())) {
            errors.push('Mode parameter must be "online", "in-person", or empty');
        }
    }

    // Validate region parameter
    if (region !== undefined) {
        if (typeof region !== 'string' || region.length > 100) {
            errors.push('Region parameter must be a string with maximum 100 characters');
        } else if (!/^[a-zA-Z\s\-&,()]+$/.test(region)) {
            errors.push('Region parameter contains invalid characters');
        }
    }

    // Validate format parameter
    if (format !== undefined) {
        if (typeof format !== 'string' || !['json'].includes(format.toLowerCase())) {
            errors.push('Format parameter must be "json" or empty');
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        sanitized: {
            subject: subject ? subject.trim() : undefined,
            mode: mode ? mode.trim() : '',
            region: region ? region.trim() : undefined,
            format: format ? format.trim() : undefined
        }
    };
}

/**
 * Main API handler for tutors directory operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} JSON response or HTML content
 *
 * @description Handles multiple tutor-related operations:
 * - GET /api/tutors: Returns complete tutor directory HTML page
 * - GET /api/tutorList: Returns JSON list of tutors for rolling banner
 * - Supports advanced filtering by region, subject, cost range
 * - Implements region synonym mapping for consistent searches
 *
 * @example
 * // GET /api/tutors
 * // GET /api/tutorList
 * // GET /api/tutors?region=Edinburgh&subject=Mathematics
 *
 * @security Public API with input validation and sanitization
 * @performance Implements efficient database queries and HTML generation
 * @throws {Error} 400 - Invalid input parameters
 * @throws {Error} 500 - Database connection or server errors
 */
module.exports = async (req, res) => {
    try {
        // Validate input parameters
        const validation = validateTutorParams(req.query);
        if (!validation.valid) {
            console.log('Input validation failed:', validation.errors);
            return handleValidationError(res, validation.errors);
        }

        // Connect to the database with better error handling
        await connectToDatabase();
        console.log('Database connected successfully');

        // Use sanitized parameters
        const { subject, mode = '', region, format } = validation.sanitized;

        // Check if this is a request for the tutor list (for rolling banner or admin page)
        if (req.url === '/api/tutorlist') {
            // Apply API security headers
            applyAPISecurityHeaders(res);
            // For the rolling banner, we don't need the _id field
            const tutors = await Tutor.find({}, 'name subjects -_id').lean();
            return res.status(200).json(tutors);
        }

        // For the admin page, we need the _id field for deletion functionality
        if (format === 'json') {
            // Apply API security headers
            applyAPISecurityHeaders(res);

            // Build query with same filtering logic as HTML generation
            let query = {};

            const subjectSynonyms = {
                // Mathematics variations
                mathematics: 'mathematics',
                maths: 'mathematics',
                math: 'mathematics',

                // English variations
                english: 'english',

                // Sciences variations
                sciences: 'sciences',
                science: 'sciences',
                biology: 'sciences',
                chemistry: 'sciences',
                physics: 'sciences',

                // Technologies variations
                technologies: 'technologies',
                technology: 'technologies',
                computing: 'technologies',
                'computer science': 'technologies',
                ict: 'technologies',

                // Social studies variations
                'social studies': 'social studies',
                history: 'social studies',
                geography: 'social studies',
                modern: 'social studies',

                // Languages variations
                languages: 'languages',
                language: 'languages',
                french: 'languages',
                spanish: 'languages',
                german: 'languages',
                gaelic: 'languages',

                // Health and wellbeing variations
                'health and wellbeing': 'health and wellbeing',
                'health & wellbeing': 'health and wellbeing',
                pe: 'health and wellbeing',
                'physical education': 'health and wellbeing',

                // Expressive arts variations
                'expressive arts': 'expressive arts',
                art: 'expressive arts',
                music: 'expressive arts',
                drama: 'expressive arts',

                // Religious and moral education variations
                'religious and moral education': 'religious and moral education',
                'religious & moral education': 'religious and moral education',
                rme: 'religious and moral education'
            };

            if (subject) {
                const input = subject.toLowerCase().trim();
                const synonym = subjectSynonyms[input] || input;   // fall back to itself for custom subjects
                query.subjects = { $regex: synonym, $options: 'i' };
                console.log(`🔍 JSON Subject search: input="${input}", synonym="${synonym}", regex="${synonym}"`);
            }

            const modeLc = mode.toLowerCase().trim();
            if (modeLc === "online") {
                query.regions = { $regex: /^online$/i };
            } else if (modeLc === "in-person") {
                query.regions = { $not: { $regex: /^online$/i } };
            } else if (region) {
                const regionSynonyms = {
                    'edinburgh': 'Edinburgh & Lothians',
                    'glasgow': 'Glasgow & West',
                    'aberdeen': 'Aberdeen & Aberdeenshire',
                    'dundee': 'Dundee & Angus',
                    'stirling': 'Stirling & Falkirk',
                    'perth': 'Perth & Kinross',
                    'inverness': 'Highlands & Islands',
                    'dumfries': 'Dumfries & Galloway',
                    'borders': 'Scottish Borders'
                };
                const regionInput = region.toLowerCase().trim();
                const regionSynonym = regionSynonyms[regionInput] || region;
                query.regions = { $regex: regionSynonym, $options: 'i' };
            }

            console.log("JSON MongoDB Query:", JSON.stringify(query, null, 2));

            const tutors = await Tutor.find(query).lean();
            return res.status(200).json(tutors);
        }

        const modeLc = mode.toLowerCase().trim();
        let query = {};

        console.log("Received and validated query parameters:", { subject, mode, region, format });
        console.log("Raw query parameters from request:", req.query);

        const subjectSynonyms = {
            // Mathematics variations
            mathematics: 'mathematics',
            maths: 'mathematics',
            math: 'mathematics',

            // English variations
            english: 'english',

            // Sciences variations
            sciences: 'sciences',
            science: 'sciences',
            biology: 'sciences',
            chemistry: 'sciences',
            physics: 'sciences',

            // Social Studies variations
            'social studies': 'social studies',
            history: 'social studies',
            geography: 'social studies',
            modern: 'social studies',

            // Languages variations
            languages: 'languages',
            'modern languages': 'languages',
            french: 'languages',
            spanish: 'languages',
            german: 'languages',
            gaelic: 'languages',

            // Technologies variations
            technologies: 'technologies',
            technology: 'technologies',
            computing: 'technologies',
            ict: 'technologies',

            // Expressive Arts variations
            'expressive arts': 'expressive arts',
            art: 'expressive arts',
            music: 'expressive arts',
            drama: 'expressive arts',

            // Health and Wellbeing variations
            'health and wellbeing': 'health and wellbeing',
            'health & wellbeing': 'health and wellbeing',
            pe: 'health and wellbeing',
            'physical education': 'health and wellbeing',

            // Religious and Moral Education variations
            'religious and moral education': 'religious and moral education',
            'religious & moral education': 'religious and moral education',
            rme: 'religious and moral education'
        };

        if (subject) {
            const input = subject.toLowerCase().trim();
            const synonym = subjectSynonyms[input] || input;   // fall back to itself for custom subjects
            query.subjects = { $regex: synonym, $options: 'i' };
            console.log(`🔍 Subject search: input="${input}", synonym="${synonym}", regex="${synonym}"`);
        }

        if (modeLc === "online") {
            query.regions = { $regex: /^online$/i };
        } else if (modeLc === "in-person") {
            const regionInputRaw = (region || '').trim();
            if (regionInputRaw) {
                // Accept either '&' or 'and', any case
                const normalized = toKey(regionInputRaw).replace(/\band\b/g, '&');
                query.regions = { $regex: new RegExp(`^${escapeRegExp(normalized)}$`, 'i') };
            }
        }

        console.log("MongoDB Query:", JSON.stringify(query, null, 2));

        // Debug: Show all tutors in database for comparison
        const allTutors = await Tutor.find({}, 'name subjects').lean();
        console.log("🔍 All tutors in database:", JSON.stringify(allTutors, null, 2));

        const tutors = await Tutor.find(query)
            .sort({ costRange: 1 })
            .lean(); // Use lean() for better performance

        console.log("Raw tutors result:", JSON.stringify(tutors, null, 2));
        console.log(`🔍 Found ${tutors.length} tutors matching query`);

        // Generate HTML for tutors or show a message if none found
        let tutorsHtml = '';

        if (tutors.length > 0) {
            tutorsHtml = tutors.map(tutor => {
                // ✅ SECURITY FIX: Sanitize all tutor data to prevent XSS
                const safeName = sanitizeString(tutor.name || '', { maxLength: 100 });
                const safeSubjects = (tutor.subjects || []).map(subject =>
                    sanitizeString(subject, { maxLength: 50 })
                ).join(', ');
                const safeBadges = (tutor.badges || []).map(badge =>
                    sanitizeString(badge, { maxLength: 100 })
                );
                const safeRegions = (tutor.regions || []).map(region =>
                    sanitizeString(region, { maxLength: 100 })
                ).join(', ');
                const safeImagePath = sanitizeString(tutor.imagePath || '', { maxLength: 500 });
                const safeCostRange = sanitizeString(tutor.costRange || '', { maxLength: 50 });

                // ✅ SECURITY FIX: Sanitize tutor type to prevent XSS
                const safeTutorType = sanitizeString(tutor.tutorType || '', { maxLength: 50 });

                return `
                <section class="tutor-card">
                    <div class="tutor-image-container" style="position: relative;">
                        <img src="${safeImagePath || '/images/tutor0.jpg'}"
                        alt="Tutor ${safeName}"
                        onerror="this.src='/images/tutor0.jpg'"
                        class="tutor-image" loading="lazy"
                        decoding="async"
                        width="300" height="200"
                        style="object-fit:cover; object-position: center center; display: block;">
                        ${safeTutorType ? `<span class="tutor-type-tag">${safeTutorType}</span>` : ''}
                    </div>
                    <h3>${safeName}</h3>
                    <p>Subjects: ${safeSubjects}</p>
                    <p>Cost: <span class="purple-pound">${safeCostRange.replace(/__P__/g, '&pound')} per hour</span></p>
                    <ul>
                        ${safeBadges.map(badge => `
                            <li class="badge-item">
                                ${badge} <span class="badge-tick">&#10004;</span>
                            </li>
                        `).join('')}
                    </ul>
                    <p class="available-in custom-style">
                        <strong>Available in:</strong> ${safeRegions}
                    </p>
                    ${(() => {
                        if (!tutor.contact) return ''; // Exit if no contact info

                        const link = buildContactLink(tutor.contact);
                        if (!link) return ''; // Exit if contact was empty string

                        // If it's a website, show one button
                        if (link.type === 'website') {
                          return `
                            <div class="tutor-contact">
                              <a href="${link.href}"
                                 class="contact-btn"
                                 target="${link.target}"
                                 rel="noopener noreferrer">
                                 ${link.text}
                              </a>
                            </div>`;
                        }

                        // If it's an email, show BOTH buttons
                        if (link.type === 'email') {
                          return `
                            <div class="tutor-contact is-email">
                              <a href="${link.href}" class="contact-btn email-btn" title="Open in your default email app">
                                ${link.text}
                              </a>
                              <button onclick="copyToClipboard(this, '${link.address}')" class="contact-btn copy-btn" title="Copy email address">
                                Copy Email
                              </button>
                            </div>`;
                        }

                        return ''; // Fallback for any other case
                    })()}
                </section>
                `;
            }).join('');
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
                <link rel="stylesheet" href="/styles2.css">
                <link rel="stylesheet" href="/css/footer-module.css">
                <link rel="stylesheet" href="/css/button-module.css">
                <link rel="stylesheet" href="/css/typography-module.css">
                <link rel="stylesheet" href="/css/animation-module.css">
                <link rel="stylesheet" href="/header-banner.css">
                <link rel="stylesheet" href="/css/nav.css">
                <script src="/js/nav-loader.js" defer></script>
                <script src="/js/dynamic-nav.js" defer></script>
                <!-- Google Analytics -->
                <script src="/js/google-analytics.js" defer></script>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <script>
                    function copyToClipboard(buttonElement, textToCopy) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            const originalText = buttonElement.textContent;
                            buttonElement.textContent = 'Copied!';
                            buttonElement.disabled = true;
                            setTimeout(() => {
                                buttonElement.textContent = originalText;
                                buttonElement.disabled = false;
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy: ', err);
                            alert('Failed to copy. Please copy manually.');
                        });
                    }
                </script>
                <style>
                    /* Ensure tutor cards are visible by default */
                    .tutor-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin: 20px 0;
                        opacity: 0; /* Initially hidden */
                        transition: opacity 0.5s ease;
                    }
                    .tutor-directory-page #imageShield {
                        opacity: 0;
                        position: absolute;
                        top: 10% !important;
                        left: calc(60% - 77px) !important; /* Shift left by 77px */
                        animation: growLeft 2s forwards ease-in-out;
                        animation-delay: 1s;
                        z-index: 49 !important; /* Behind banner */
                    }

                    /* Make #imageBanner appear at bottom tip of shield with proper animation */
                    .tutor-directory-page #imageBanner {
                        opacity: 0;
                        position: absolute;
                        top: calc(18% + 207px + 77px) !important; /* Position 77px lower + additional 77px down */
                        left: calc(60% - 77px) !important; /* Shift left by 77px */
                        animation: growLeft 2s forwards ease-in-out;
                        animation-delay: 1.5s; /* ribbons appear after shield */
                        z-index: 50 !important; /* On top of shield */
                    }

                    /* Add the growLeft animation keyframes */
                    @keyframes growLeft {
                        0% {
                            opacity: 0;
                            transform: translateX(-37%) scale(0.5);
                        }
                        100% {
                            opacity: 1;
                            transform: translateX(-37%) scale(0.9);
                        }
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
                        opacity: 0; /* Initially hidden */
                        transform: translateY(20px);
                        transition: opacity 0.8s ease, transform 0.8s ease, box-shadow 0.3s ease;
                    }

                    .tutor-card.show {
                        opacity: 1;
                        transform: translateY(0);
                    }

                    /* Remove flag background from tutor cards */
                    .tutor-card::before {
                        display: none !important;
                    }

                    .tutor-card:hover {
                        transform: translateY(-5px) !important;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    }

                    .tutor-image {
                        width: 100%;
                        height: 200px; /* Fixed height for consistency */
                        object-fit: cover; /* Maintain aspect ratio while filling the container */
                        object-position: center center; /* Center the image both horizontally and vertically */
                        border-radius: 4px;
                        margin-bottom: 10px;
                        border: 1px solid #ddd;
                        display: block; /* Ensure proper block-level display */
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

                    /* Tutor type tags - similar to blog category tags */
                    .tutor-type-tag {
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        padding: 0.5rem 1rem;
                        border-radius: 2rem;
                        font-weight: 600;
                        font-size: 0.85rem;
                        color: white;
                        background: linear-gradient(135deg, #800080 0%, #C8A2C8 100%);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        z-index: 2;
                        text-transform: capitalize;
                    }

                    .pricing-key {
                        background: #f9f9f9;
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                        opacity: 0; /* Initially hidden */
                        font-size: 0.9rem;
                        color: #800080;
                        text-align: center;
                        transition: opacity 0.5s ease;
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
                        border: none; /* For accessibility in high-contrast modes */
                        cursor: pointer;
                        font-family: inherit;
                    }

                    .contact-btn:hover {
                        background-color: #b48fb4;
                    }

                    /* WCAG-compliant focus ring */
                    .contact-btn:focus-visible {
                        outline: 2px solid #0057B7;
                        outline-offset: 2px;
                    }

                    .tutor-contact.is-email {
                        display: flex;
                        gap: 8px;
                        justify-content: center;
                    }

                    .copy-btn {
                         background-color: #A9A9A9;
                    }
                    .copy-btn:hover {
                        background-color: #8c8c8c;
                    }
                    .copy-btn:disabled {
                        background-color: #4CAF50;
                        cursor: default;
                        color: white;
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

    <!-- Navigation will be loaded here by nav-loader.js -->


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
                        // Staggered animation for tutor cards - like cards being placed on a table
                        document.addEventListener('DOMContentLoaded', function() {
                            const tutorCards = document.querySelectorAll('.tutor-card');
                            const tutorGrid = document.querySelector('.tutor-grid');
                            const pricingKey = document.querySelector('.pricing-key');

                            // Show the grid container first
                            if (tutorGrid) {
                                tutorGrid.style.opacity = '1';
                            }

                            // Show pricing key
                            if (pricingKey) {
                                pricingKey.style.opacity = '1';
                            }

                            // Animate tutor cards one by one with increasing delays
                            tutorCards.forEach((card, index) => {
                                setTimeout(() => {
                                    card.classList.add('show');
                                }, (index + 1) * 200);  // Start from 200ms, then 400ms, 600ms, etc.
                            });

                            // Debug image loading issues (reduced logging)
                            const tutorImages = document.querySelectorAll('.tutor-image');
                            tutorImages.forEach((img, index) => {
                                img.addEventListener('error', function() {
                                    console.log(\`Image \${index} failed to load: \${this.src}, using fallback\`);
                                    this.src = '/images/tutor0.jpg';
                                });
                            });
                        });
                    </script>
                </div>
                </div>
                </main>

                <!-- STATIC BOTTOM FOOTER -->
                <footer class="static-footer">
                    <div class="static-footer-container">
                        <div class="static-footer-left">
                            <h4>Extra Information</h4>
                            <ul>
                                <li><a href="/tutoring-standards.html">The TAS Way: Governance and Guidance</a></li>
                                <li><a href="/parents.html#faq">FAQ's</a></li>
                                <li><a href="/privacy-policy.html">Privacy Policy</a></li>

                                <li><a href="/terms-and-conditions.html">Terms and Conditions</a></li>
                            </ul>
                            <div class="static-footer-copyright">
                                <p>ALL RIGHTS RESERVED © Tutors Alliance Scotland 2025</p>
                            </div>
                            <div class="static-footer-credits">
                                <p>Website by <a href="#" target="_blank">Toby Stone</a></p>
                            </div>
                        </div>
                        <div class="static-footer-right">
                            <div class="website-url">
                                <p>www.tutorsalliancescotland.co.uk</p>
                            </div>
                        </div>
                    </div>
                </footer>

            </body>
            </html>
        `;

        // Apply HTML security headers
        applyHTMLSecurityHeaders(res);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (error) {
        console.error("Error in tutors API:", error);

        // Use enhanced error handling
        return handleAPIError(res, error, 500);

        // Fallback HTML error for direct browser access (unreachable due to return above)
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
                <!-- Google Analytics -->
                <script src="/js/google-analytics.js" defer></script>
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




