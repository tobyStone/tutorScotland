// api/tutorConnection.js
const nodemailer = require('nodemailer');
const connectToDatabase = require('./connectToDatabase');

// Gmail SMTP configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 465; // Use 465 for SSL or 587 for TLS
const SMTP_USER = process.env.SMTP_USER || 'your-gmail-address@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'your-gmail-app-password';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tobybarrasstone@hotmail.com';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        await connectToDatabase(); // If you need DB, or skip if not needed

        const { name, email, subjects, qualification, safeguarding } = req.body;

        // Create a transporter for Gmail
        let transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465, // true for 465, false for other ports
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            },
            tls: {
                // Do not fail on invalid certificates
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
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

        // Verify SMTP connection configuration
        try {
            await transporter.verify();
            console.log('SMTP connection verified successfully');
        } catch (verifyError) {
            console.error('SMTP connection verification failed:', verifyError);
            return res.status(500).json({
                message: 'Email server connection failed',
                error: verifyError.message,
                details: 'Please check your SMTP configuration'
            });
        }

        // Send the email
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);

            // Store submission in database if needed
            // const submission = new TutorSubmission({ name, email, subjects, qualification, safeguarding });
            // await submission.save();

            return res.status(200).json({
                message: 'Email sent successfully',
                messageId: info.messageId
            });
        } catch (sendError) {
            console.error('Error sending email:', sendError);
            return res.status(500).json({
                message: 'Failed to send email',
                error: sendError.message
            });
        }
    } catch (err) {
        console.error('General error in tutorConnection API:', err);
        return res.status(500).json({
            message: 'Failed to process tutor connection request',
            error: err.message
        });
    }
};

// Tell Vercel we need the Node runtime
module.exports.config = { runtime: 'nodejs18.x' };
