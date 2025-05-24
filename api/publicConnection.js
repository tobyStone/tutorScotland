// api/publicConnection.js
const nodemailer = require('nodemailer');
const connectToDatabase = require('./connectToDatabase');

// Gmail configuration - using OAuth2 is more reliable than password
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

        const { name, email, phone, subject, message } = req.body;

        // Create a simpler transporter for Gmail
        let transporter = nodemailer.createTransport({
            service: 'gmail',  // Using the built-in Gmail configuration
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });

        console.log('Created transporter for Gmail');

        const mailOptions = {
            from: `"Public Inquiry" <${SMTP_USER}>`,
            to: ADMIN_EMAIL,
            subject: `New Public Inquiry from ${name}`,
            text: `
A new public inquiry has been submitted:

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}
Message: ${message}
            `,
            html: `
              <h2>New Public Inquiry</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Message:</strong></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            `
        };

        // Send the email directly without verification
        try {
            console.log('Attempting to send email with the following options:', {
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject
            });

            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId, info.response);

            // Store submission in database if needed
            // const submission = new PublicSubmission({ name, email, phone, subject, message });
            // await submission.save();

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

            return res.status(500).json({
                message: 'Failed to send email: ' + sendError.message,
                success: false
            });
        }
    } catch (err) {
        console.error('General error in publicConnection API:', err);

        // Ensure we're sending a proper JSON response even for unexpected errors
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
            message: 'Failed to process public connection request: ' + err.message,
            success: false
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
