# Gmail and Nodemailer Troubleshooting Guide

This guide provides detailed instructions for troubleshooting Gmail integration with Nodemailer in your Tutors Alliance Scotland application.

## Common Issues and Solutions

### 1. Authentication Errors

**Symptoms:**
- Error messages containing "Invalid login" or "Authentication failed"
- Error code: "EAUTH"

**Solutions:**

#### A. Verify App Password is Correct

1. Make sure you're using an App Password, not your regular Gmail password
2. Regenerate a new App Password:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Select "App passwords" (requires 2-Step Verification to be enabled)
   - Generate a new password specifically for this application
   - Update the `SMTP_PASS` environment variable with the new password

#### B. Check Gmail Account Settings

1. Ensure 2-Step Verification is enabled on your Google account
2. Make sure your Google account doesn't have any security holds or restrictions
3. Check if you received any security alerts from Google about blocked sign-in attempts

#### C. Try Using OAuth2 Instead of Password

For a more secure approach, consider using OAuth2 authentication:

```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'your-email@gmail.com',
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET',
    refreshToken: 'YOUR_REFRESH_TOKEN',
    accessToken: 'YOUR_ACCESS_TOKEN'
  }
});
```

This requires setting up a Google Cloud project and OAuth credentials.

### 2. Connection Issues

**Symptoms:**
- Error messages containing "Connection refused" or "Connection timeout"
- Error code: "ECONNREFUSED" or "ETIMEDOUT"

**Solutions:**

#### A. Check Network Connectivity

1. Ensure your server has internet access
2. Check if any firewalls are blocking outgoing SMTP connections
3. Try using a different port (587 instead of 465 or vice versa)

#### B. Simplify Transporter Configuration

Use the simpler service-based configuration:

```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Uses predefined settings for Gmail
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});
```

### 3. Rate Limiting and Sending Limits

**Symptoms:**
- Emails work initially but then stop working
- Error messages about "sending rate exceeded"

**Solutions:**

#### A. Be Aware of Gmail Limits

- Gmail has a sending limit of 500 emails per day for regular accounts
- There are also rate limits (emails per minute)
- Consider using a dedicated email service like SendGrid or Mailgun for production

#### B. Implement Retry Logic

Add retry logic for transient failures:

```javascript
const MAX_RETRIES = 3;
let retries = 0;

async function sendWithRetry() {
  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    if (retries < MAX_RETRIES && isTransientError(error)) {
      retries++;
      console.log(`Retrying email send (${retries}/${MAX_RETRIES})...`);
      return await sendWithRetry();
    }
    throw error;
  }
}
```

### 4. Content-Related Issues

**Symptoms:**
- Emails are sent but not delivered or go to spam
- Error messages about content being rejected

**Solutions:**

#### A. Check Email Content

1. Avoid spam trigger words in subject and content
2. Keep HTML simple and well-formed
3. Ensure all links are valid

#### B. Set Proper Headers

```javascript
const mailOptions = {
  from: {
    name: 'Tutors Alliance Scotland',
    address: 'your-email@gmail.com'
  },
  to: recipient,
  subject: subject,
  text: textContent,
  html: htmlContent,
  headers: {
    'X-Priority': '1',
    'X-MSMail-Priority': 'High',
    'Importance': 'high'
  }
};
```

## Vercel-Specific Troubleshooting

### 1. Environment Variables

**Issue:** Environment variables not being properly loaded in Vercel

**Solutions:**

1. Verify environment variables are set in the Vercel dashboard
2. Redeploy the application after changing environment variables
3. Add debug logging to verify environment variables are loaded:

```javascript
console.log('Email Configuration:', {
  smtpUser: process.env.SMTP_USER,
  smtpPassLength: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
  adminEmail: process.env.ADMIN_EMAIL
});
```

### 2. Serverless Function Timeouts

**Issue:** Email sending times out in serverless environment

**Solutions:**

1. Ensure your function doesn't exceed Vercel's execution time limits
2. Consider using a background task service for email sending
3. Simplify the email sending process to reduce execution time

### 3. Response Handling

**Issue:** API returns HTML error pages instead of JSON

**Solutions:**

1. Always set the Content-Type header:
```javascript
res.setHeader('Content-Type', 'application/json');
```

2. Ensure all error paths return proper JSON:
```javascript
return res.status(500).json({
  message: 'Error message',
  success: false
});
```

3. On the client side, check response content type:
```javascript
const contentType = response.headers.get('content-type');
if (contentType && contentType.includes('application/json')) {
  data = await response.json();
} else {
  const text = await response.text();
  console.error('Non-JSON response:', text);
  throw new Error('Server returned an invalid response format');
}
```

## Alternative Email Services

If Gmail continues to cause issues, consider these alternatives:

1. **SendGrid**
   - Free tier available (100 emails/day)
   - Better deliverability and monitoring
   - Simple integration with Nodemailer

2. **Mailgun**
   - Free tier available (5,000 emails/month for 3 months)
   - Good deliverability and analytics
   - API and SMTP options

3. **Amazon SES**
   - Very low cost ($0.10 per 1,000 emails)
   - High deliverability
   - Requires AWS account setup

## Testing Email Functionality

1. Use a test email address that you can access
2. Start with minimal email content to isolate issues
3. Check spam folders for delivered emails
4. Use detailed logging to track the email sending process
5. Consider a tool like [Mailtrap](https://mailtrap.io/) for testing without sending real emails

## Need More Help?

If you continue to experience issues:

1. Check the Nodemailer documentation: [nodemailer.com](https://nodemailer.com/)
2. Review Gmail's SMTP settings: [support.google.com](https://support.google.com/mail/answer/7126229)
3. Consider posting on Stack Overflow with the `nodemailer` and `gmail` tags
4. Contact the development team for further assistance
