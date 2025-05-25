// api/connection.js - Unified connection handler for both tutor and public connections
const nodemailer = require('nodemailer');
const connectToDatabase = require('./connectToDatabase');

// Gmail configuration
const SMTP_USER = process.env.SMTP_USER || 'tobystonewriter@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'your-gmail-app-password';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tobybarrasstone@hotmail.com';

// Debug environment variables (without exposing sensitive data)
console.log('Email Configuration:', {
    smtpUser: SMTP_USER,
    smtpPassLength: SMTP_PASS ? SMTP_PASS.length : 0,
    adminEmail: ADMIN_EMAIL
});

module.exports = async (req, res) => {
    // Always set JSON content type for all responses
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed`, success: false });
    }

    try {
        await connectToDatabase(); // If you need DB, or skip if not needed

        // Determine connection type based on request body fields
        const isTutorConnection = req.body.subjects && req.body.qualification && req.body.safeguarding;
        const isPublicConnection = req.body.phone && req.body.subject && req.body.message;

        if (!isTutorConnection && !isPublicConnection) {
            return res.status(400).json({
                message: 'Invalid request format. Missing required fields.',
                success: false
            });
        }

        // Create a simpler transporter for Gmail
        let transporter = nodemailer.createTransport({
            service: 'gmail',  // Using the built-in Gmail configuration
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });

        console.log('Created transporter for Gmail');

        let mailOptions;

        if (isTutorConnection) {
            // Handle tutor connection
            const { name, email, subjects, qualification, safeguarding } = req.body;

            mailOptions = {
                from: `"Tutor Submission" <${SMTP_USER}>`,
                to: ADMIN_EMAIL,
                subject: `New Tutor Submission from ${name}`,
                text: `
A new tutor has submitted details:

Name: ${name}
Email: ${email}
Subjects: ${subjects.join(', ')}
Qualification: ${qualification}
Safeguarding: ${safeguarding}
                `,
                html: `
                  <h2>New Tutor Submission</h2>
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Subjects:</strong> ${subjects.join(', ')}</p>
                  <p><strong>Qualification:</strong> ${qualification}</p>
                  <p><strong>Safeguarding (PVG?):</strong> ${safeguarding}</p>
                `
            };
        } else {
            // Handle public connection
            const { name, email, phone, subject, message } = req.body;

            mailOptions = {
                from: `"Public Inquiry" <${SMTP_USER}>`,
                to: ADMIN_EMAIL,
                subject: `New Public Inquiry from ${name}`,
                text: `
A new public inquiry has been submitted:

Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}
Message: ${message}
                `,
                html: `
                  <h2>New Public Inquiry</h2>
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Phone:</strong> ${phone}</p>
                  <p><strong>Subject:</strong> ${subject}</p>
                  <p><strong>Message:</strong> ${message}</p>
                `
            };
        }

        // Send the email directly without verification
        try {
            console.log('Attempting to send email with the following options:', {
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject
            });

            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId, info.response);

            return res.status(200).json({
                message: 'Email sent successfully',
                success: true
            });
        } catch (sendError) {
            console.error('Error sending email:', sendError);

            // Log detailed error information
            if (sendError.code) console.error('Error code:', sendError.code);
            if (sendError.command) console.error('Failed command:', sendError.command);
            if (sendError.response) console.error('Server response:', sendError.response);

            const connectionType = isTutorConnection ? 'tutor connection' : 'public inquiry';
            return res.status(500).json({
                message: `Failed to send ${connectionType}: ` + sendError.message,
                success: false
            });
        }
    } catch (err) {
        console.error('General error in connection API:', err);

        // Ensure we're sending a proper JSON response even for unexpected errors
        res.setHeader('Content-Type', 'application/json');
        const connectionType = req.body.subjects ? 'tutor connection' : 'public connection';
        return res.status(500).json({
            message: `Failed to process ${connectionType} request: ` + err.message,
            success: false
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
