// api/tutorConnection.js
const nodemailer = require('nodemailer');
const { verifyToken } = require('./auth');
const connectToDatabase = require('./connectToDatabase');

// In a real app, you'd set these in environment variables
// e.g. process.env.SMTP_HOST, process.env.SMTP_USER, process.env.SMTP_PASS
// or use a 3rd-party service like SendGrid, Mailgun, etc.
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || 'your-smtp-user';
const SMTP_PASS = process.env.SMTP_PASS || 'your-smtp-pass';

// The admin email address to receive these messages
const ADMIN_EMAIL = 'tobybarrasstone@hotmail.com';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    verifyToken(req, res, async () => {
        // e.g. only tutors or admins can send
        if (!req.user || (req.user.role !== 'tutor' && req.user.role !== 'admin')) {
            return res.status(403).json({ message: 'Access denied: tutors only' });
        }

        try {
            await connectToDatabase(); // if you need DB, or skip if not needed

            const { name, email, subjects, qualification, safeguarding } = req.body;

            // 1. Create a nodemailer transporter
            let transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: SMTP_PORT,
                secure: false, // or true if using 465
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS
                }
            });

            // 2. Compose the email content
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
                // optional HTML body:
                html: `
          <h2>New Tutor Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subjects:</strong> ${subjects.join(', ')}</p>
          <p><strong>Qualification:</strong> ${qualification}</p>
          <p><strong>Safeguarding (PVG?):</strong> ${safeguarding}</p>
        `
            };

            // 3. Send the email
            await transporter.sendMail(mailOptions);

            return res.status(200).json({ message: 'Email sent successfully' });
        } catch (err) {
            console.error('Error sending email:', err);
            return res.status(500).json({ message: 'Failed to send email' });
        }
    });
};
