# Gmail Setup Guide for Tutors Alliance Scotland

This guide explains how to set up Gmail to send emails from the Tutors Alliance Scotland website, specifically for the tutor connection form.

## Prerequisites

1. A Gmail account that you want to use for sending emails
2. Access to the Vercel deployment environment or the local development environment

## Step 1: Configure Gmail to Allow Third-Party Apps

You have two options for allowing the application to send emails through your Gmail account:

### Option A: Use App Passwords (Recommended)

This is the more secure option as it doesn't require lowering the security settings of your entire Gmail account.

1. Enable 2-Step Verification for your Google account:
   - Go to your [Google Account](https://myaccount.google.com/)
   - Select "Security" from the left menu
   - Under "Signing in to Google," select "2-Step Verification" and follow the steps

2. Create an App Password:
   - After enabling 2-Step Verification, go back to the Security page
   - Under "Signing in to Google," select "App passwords"
   - Select "Mail" as the app and "Other" as the device (name it "Tutors Alliance Scotland")
   - Click "Generate"
   - Google will display a 16-character password. **Copy this password**

### Option B: Allow Less Secure Apps (Not Recommended for Production)

This option is simpler but less secure. It's suitable for testing but not recommended for production.

1. Go to your [Google Account](https://myaccount.google.com/)
2. Select "Security" from the left menu
3. Scroll down to "Less secure app access" and turn it on

**Note:** Google may disable this option in the future, and it's generally not recommended for security reasons.

## Step 2: Update Environment Variables

You need to update the environment variables in your deployment environment:

### For Local Development

Update the `.env.local` file with your Gmail credentials:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=email-to-receive-notifications@example.com
```

Replace:
- `your-gmail-address@gmail.com` with your Gmail address
- `your-app-password` with the App Password generated in Step 1
- `email-to-receive-notifications@example.com` with the email where you want to receive tutor submissions

### For Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add the following environment variables:
   - `SMTP_HOST`: smtp.gmail.com
   - `SMTP_PORT`: 465
   - `SMTP_USER`: your-gmail-address@gmail.com
   - `SMTP_PASS`: your-app-password
   - `ADMIN_EMAIL`: email-to-receive-notifications@example.com

4. Click "Save" to apply the changes
5. Redeploy your application for the changes to take effect

## Step 3: Testing the Email Functionality

1. Navigate to the Tutor Connection page on your website
2. Fill out the form with test data
3. Submit the form
4. Check the email address specified in `ADMIN_EMAIL` to verify that you received the submission
5. Check the Vercel logs for any error messages if emails are not being received

## Troubleshooting

### Emails Not Being Sent

1. **Check Vercel Logs**: Look for error messages related to SMTP or email sending
2. **Verify Environment Variables**: Make sure all environment variables are correctly set
3. **Check Gmail Settings**: Ensure that the App Password is correct or that "Less Secure Apps" is enabled
4. **Gmail Sending Limits**: Be aware that Gmail has sending limits (500 emails per day for regular accounts)

### SMTP Connection Errors

If you see errors like "Connection refused" or "Authentication failed":

1. Double-check your SMTP credentials
2. Try using port 587 instead of 465 by changing the `SMTP_PORT` environment variable
3. If using port 587, make sure to set `secure: false` in the transporter configuration

### Gmail Security Alerts

You might receive security alerts from Google about suspicious sign-in attempts:

1. If you receive such alerts, confirm that it was you
2. Consider using the App Password method instead of "Less Secure Apps"

## Additional Notes

- The email will appear to be sent from the Gmail address specified in `SMTP_USER`
- For production use, consider using a dedicated email service like SendGrid, Mailgun, or Amazon SES
- If you expect high volume, Gmail might not be suitable due to sending limits

## Support

If you encounter any issues with the email functionality, please contact the development team for assistance.
