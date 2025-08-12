# CORS Configuration Fix for Google Cloud Storage

## 🚨 **Current Issue**
Large video uploads (>4.5MB) are failing with CORS policy errors:
```
Access to XMLHttpRequest at 'https://storage.googleapis.com/maths_incoding/...' 
from origin 'https://tutor-scotland.vercel.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ **Solution: Configure CORS on Google Cloud Storage Bucket**

### **Method 1: Google Cloud Console (Recommended)**

1. **Navigate to Storage**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **Storage** → **Buckets**

2. **Select Your Bucket**:
   - Find and click on bucket: `maths_incoding`

3. **Configure CORS**:
   - Go to the **"Permissions"** tab
   - Click **"Edit CORS configuration"**
   - Replace existing configuration with:

```json
[
  {
    "origin": [
      "https://tutor-scotland.vercel.app",
      "http://localhost:3000"
    ],
    "method": [
      "GET",
      "HEAD", 
      "PUT",
      "POST",
      "DELETE"
    ],
    "responseHeader": [
      "Content-Type",
      "x-goog-content-length-range"
    ],
    "maxAgeSeconds": 3600
  }
]
```

4. **Save Configuration**

### **Method 2: Google Cloud CLI (Alternative)**

If you have `gcloud` CLI installed:

```bash
# Create CORS configuration file
cat > cors.json << EOF
[
  {
    "origin": [
      "https://tutor-scotland.vercel.app",
      "http://localhost:3000"
    ],
    "method": [
      "GET",
      "HEAD", 
      "PUT",
      "POST",
      "DELETE"
    ],
    "responseHeader": [
      "Content-Type",
      "x-goog-content-length-range"
    ],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS configuration
gsutil cors set cors.json gs://maths_incoding
```

## 🔧 **Fallback Solution Implemented**

If CORS configuration is not possible immediately, we've implemented a fallback:

1. **Primary**: Direct browser → Google Cloud upload (requires CORS)
2. **Fallback**: Browser → Vercel server → Google Cloud upload (no CORS needed)

The system will automatically try the fallback if direct upload fails due to CORS.

## 🛡️ **Security Notes**

The CORS configuration:
- ✅ **Restricts Origins**: Only allows your production domain and localhost
- ✅ **Minimal Methods**: Only allows necessary HTTP methods
- ✅ **Required Headers**: Only allows headers needed for signed URL uploads
- ✅ **Time Limited**: 1-hour cache for preflight requests

## 🧪 **Testing After CORS Fix**

1. **Upload Small Video** (<4.5MB): Should use Vercel Blob (no change)
2. **Upload Large Video** (>4.5MB): Should use Google Cloud direct upload
3. **Check Console**: Should see "✅ Large video uploaded successfully to Google Cloud Storage"
4. **Verify URL**: Video should be accessible at `https://storage.googleapis.com/maths_incoding/...`

## 📋 **Expected Results**

After CORS configuration:
- ✅ **Direct Upload**: Large videos upload directly from browser to Google Cloud
- ✅ **Better Performance**: No server bottleneck for large files
- ✅ **Progress Tracking**: Real-time upload progress
- ✅ **Video Browser**: Google Cloud videos appear in admin interface

## 🔄 **If CORS Configuration Fails**

The fallback system will:
1. Detect CORS failure
2. Automatically retry via server-side upload
3. Upload large video through Vercel server to Google Cloud
4. Return Google Cloud URL for storage

This ensures large video uploads work regardless of CORS configuration status.

## 🎯 **Priority**

**High Priority**: Configure CORS for optimal performance
**Backup**: Fallback system ensures functionality even without CORS

The system is now robust and will handle large video uploads either way!
