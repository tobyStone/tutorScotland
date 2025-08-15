# Google Cloud Permissions Fix

## Problem
Your Google Cloud videos are not showing thumbnails in the video browser because the service account lacks the `storage.objects.list` permission.

**Current Error:**
```
Could not list files with prefix video-content/: vercel-uploader@vigilant-shift-426312-s0.iam.gserviceaccount.com does not have storage.objects.list access to the Google Cloud Storage bucket. Permission 'storage.objects.list' denied on resource (or it may not exist).
```

## Root Cause
Your service account was created with only `Storage Object Creator` role, which allows uploading files but not listing them. To display existing videos in the browser, you need read permissions as well.

## Solution: Add Storage Object Viewer Role

### Step 1: Go to Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `vigilant-shift-426312-s0`

### Step 2: Navigate to IAM
1. Go to "IAM & Admin" > "IAM"
2. Find your service account: `vercel-uploader@vigilant-shift-426312-s0.iam.gserviceaccount.com`

### Step 3: Add the Required Role
1. Click the pencil icon (Edit) next to your service account
2. Click "ADD ANOTHER ROLE"
3. Search for and select: **"Storage Object Viewer"**
4. Click "SAVE"

### Alternative: Use Storage Admin (More Permissions)
If you want full control over your bucket, you can replace both roles with:
- **"Storage Admin"** (gives full control over storage objects)

## What This Fixes
- ✅ Video browser will show Google Cloud videos with thumbnails
- ✅ Existing uploaded videos will be visible in the admin interface
- ✅ You can still upload new videos (existing functionality preserved)

## Security Note
- `Storage Object Viewer` only adds read permissions
- This follows the principle of least privilege
- Your service account will have: Create + Read permissions (no delete/modify)

## Test After Fix
1. Go to your admin panel
2. Click "Browse Available Videos"
3. You should now see your Google Cloud videos listed under "🌩️ Large Videos (Google Cloud)"

## Current Workaround
Until you fix the permissions, the video browser will show a helpful message explaining the issue, and you can still:
- Upload new videos (both small to Vercel Blob and large to Google Cloud)
- Use videos by entering their URLs manually
- All existing videos on your website will continue to work normally
