# Google Cloud Storage Setup Guide

This guide will help you set up Google Cloud Storage for large video uploads (>4.5MB) that bypass Vercel's serverless function limits.

## Overview

The video upload system uses a **consolidated API approach** with two paths:
- **Small videos (<4.5MB)**: Upload via `/api/upload-image` (multipart form) → Vercel Blob Storage
- **Large videos (4.5MB - 1GB)**: Get signed URL from `/api/upload-image` (JSON request) → Direct upload to Google Cloud Storage

This keeps you within Vercel's 12 API route limit while supporting both upload methods.

## Step 1: Create Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID (you'll need this later)

## Step 2: Enable Cloud Storage API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Cloud Storage API"
3. Click on it and press "Enable"

## Step 3: Create a Storage Bucket

1. Go to "Cloud Storage" > "Buckets"
2. Click "Create Bucket"
3. Choose a unique bucket name (e.g., `tutor-scotland-videos`)
4. Select a region close to your users
5. Choose "Standard" storage class
6. Set access control to "Uniform"
7. Click "Create"

## Step 4: Set Bucket Permissions

1. Go to your bucket and click on the "Permissions" tab
2. Click "Grant Access"
3. Add the following permissions:
   - **New principals**: `allUsers`
   - **Role**: `Storage Object Viewer` (for public read access)
4. Click "Save"

## Step 5: Create Service Account (Tech Team's Recommended Security Model)

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a name (e.g., `vercel-uploader`) and description
4. Click "Create and Continue"
5. **Important**: Add the role: `Storage Object Creator` (not Admin - following principle of least privilege)
   - This gives just enough permission to upload files, but not read or delete them
6. Click "Continue" and then "Done"

## Step 6: Generate Service Account Key

1. Click on your newly created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Download the key file

## Step 7: Configure Environment Variables

### For Local Development (Tech Team's Recommended Method)

Add these variables to your `.env.local` file:

```env
# Primary method (recommended):
GCP_PROJECT_ID=your-project-id
GCS_SA_KEY={"type":"service_account","project_id":"your-project-id",...}
GCS_BUCKET_NAME=tutor-scotland-videos

# Alternative for development:
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=./google-cloud-key.json
GCS_BUCKET_NAME=tutor-scotland-videos
```

### For Vercel Deployment (Tech Team's Recommended Method)

1. Go to your Vercel project dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add the following environment variables:
   - `GCP_PROJECT_ID`: Your Google Cloud project ID (e.g., `vigilant-shift-426312-s0`)
   - `GCS_SA_KEY`: The entire contents of your JSON key file (as a single line)
   - `GCS_BUCKET_NAME`: Your bucket name (e.g., `tutor-scotland-videos`)

**Important**: When adding `GOOGLE_CLOUD_CREDENTIALS` to Vercel, copy the entire JSON content and paste it as the value. It should look like:
```
{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

## Step 8: Install Dependencies

Add the Google Cloud Storage dependency to your project:

```bash
npm install @google-cloud/storage
```

## Step 9: Test the Setup

1. Try uploading a small video (<4.5MB) - it should use Vercel Blob Storage
2. Try uploading a large video (>4.5MB) - it should use Google Cloud Storage
3. Check that both videos are accessible via their URLs

## Security Considerations

1. **Bucket Access**: The bucket is configured for public read access so videos can be viewed on your website
2. **Service Account**: The service account only has access to your specific bucket
3. **Upload URLs**: Signed upload URLs expire after 15 minutes for security
4. **File Size Limits**: Large uploads are limited to 1GB maximum

## Troubleshooting

### "Google Cloud Storage not configured" Error
- Check that your environment variables are set correctly
- Verify the service account JSON is valid
- Ensure the Cloud Storage API is enabled

### Upload Fails with 403 Error
- Check bucket permissions
- Verify service account has `Storage Object Admin` role
- Ensure the bucket exists and is accessible

### Files Not Publicly Accessible
- Check bucket permissions include `allUsers` with `Storage Object Viewer` role
- Verify bucket access control is set to "Uniform"

## Cost Considerations

Google Cloud Storage pricing (as of 2024):
- **Storage**: ~$0.020 per GB per month for Standard storage
- **Operations**: ~$0.05 per 10,000 operations
- **Network**: Free egress to most locations up to 1GB per month

For a tutoring website, costs should be minimal unless you're storing hundreds of GB of videos.

## Next Steps

Once configured, the system will automatically:
1. Detect video file size during upload
2. Route small videos through Vercel (faster for small files)
3. Route large videos through Google Cloud (bypasses Vercel limits)
4. Store video URLs in MongoDB for use in dynamic sections
5. Display videos consistently regardless of storage location
