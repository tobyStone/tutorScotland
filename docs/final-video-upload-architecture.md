# Final Video Upload Architecture - Combined Best Practices

This document outlines the optimal video upload solution that combines your tech team's security best practices with the existing system integration requirements.

## 🏗️ **Architecture Overview**

### **Dual Upload System**
```
Small Videos (≤4.5MB):
Browser → Vercel Serverless Function → Vercel Blob Storage

Large Videos (>4.5MB):
Browser → Vercel Function (get signed URL) → Direct to Google Cloud Storage
```

### **Security Model (Tech Team's Approach)**
- **Service Account**: `Storage Object Creator` role (minimal permissions)
- **Signed URLs**: 15-minute expiration, content-type validation
- **File Validation**: Size limits, type checking, filename sanitization
- **Direct Upload**: No server bottleneck, secure credential handling

## 🔧 **Implementation Details**

### **Environment Variables (Tech Team's Recommended)**
```env
# Primary method (production):
GCP_PROJECT_ID=your-project-id
GCS_SA_KEY={"type":"service_account",...}
GCS_BUCKET_NAME=tutor-scotland-videos

# Fallback methods (development):
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=./google-cloud-key.json
```

### **API Consolidation (Vercel Constraint)**
- **Single Endpoint**: `/api/upload-image` handles both upload types
- **Smart Detection**: Content-Type header determines request type
  - `multipart/form-data` → File upload (small videos/images)
  - `application/json` → Signed URL generation (large videos)

### **Enhanced Security Features**
1. **Input Validation**: Filename length, content type, file size
2. **Sanitization**: Clean filenames, remove dangerous characters
3. **Unique Naming**: Timestamp + random suffix + sanitized name
4. **Size Enforcement**: Both client-side and GCS-level limits
5. **Expiration**: 15-minute signed URL validity

### **Video Browser Integration**
- **Three Sources**: Static files, Vercel Blob, Google Cloud Storage
- **Unified Display**: Consistent interface regardless of storage location
- **Automatic Detection**: System determines upload path based on file size

## 🔄 **Upload Flow**

### **Small Video Upload (≤4.5MB)**
1. User selects video file
2. Client validates file size/type
3. Upload via multipart form to `/api/upload-image`
4. Server processes and uploads to Vercel Blob
5. Returns Vercel Blob URL
6. URL stored in Section model

### **Large Video Upload (>4.5MB)**
1. User selects video file
2. Client validates file size/type
3. Request signed URL from `/api/upload-image` (JSON)
4. Server validates request and generates signed URL
5. Client uploads directly to Google Cloud Storage
6. Returns Google Cloud public URL
7. URL stored in Section model

## 🛡️ **Security Benefits**

### **Tech Team's Security Model**
- **Principle of Least Privilege**: Service account has only upload permissions
- **Credential Protection**: Secrets never leave server environment
- **Time-Limited Access**: Signed URLs expire in 15 minutes
- **Content Validation**: Server-side file type and size validation

### **Additional Protections**
- **Filename Sanitization**: Prevents path traversal attacks
- **Size Limits**: Enforced at multiple levels (client, server, GCS)
- **Content-Type Validation**: Only video files allowed for large uploads
- **Unique Naming**: Prevents filename collisions and overwrites

## 📊 **Performance Benefits**

### **Direct Upload Advantages**
- **No Server Bottleneck**: Large files bypass Vercel function
- **Faster Uploads**: Direct browser-to-GCS transfer
- **Reduced Costs**: Less Vercel function execution time
- **Better UX**: Progress tracking for large uploads

### **Smart Routing**
- **Optimal Path Selection**: Automatic based on file size
- **Fallback Support**: Graceful degradation if GCS not configured
- **Unified Interface**: Same upload experience regardless of destination

## 🔧 **Configuration Steps**

### **1. Google Cloud Setup**
1. Create service account with `Storage Object Creator` role
2. Download JSON key file
3. Create storage bucket with public read access

### **2. Environment Variables**
```bash
# Vercel Dashboard → Settings → Environment Variables
GCP_PROJECT_ID=your-project-id
GCS_SA_KEY={"type":"service_account",...}
GCS_BUCKET_NAME=tutor-scotland-videos
```

### **3. Testing**
1. Small video (≤4.5MB): Should upload to Vercel Blob
2. Large video (>4.5MB): Should upload to Google Cloud
3. Video browser: Should show videos from all sources

## 🎯 **Key Advantages of Combined Approach**

### **From Tech Team's Plan**
✅ **Security**: Minimal service account permissions
✅ **Architecture**: Direct browser-to-GCS upload
✅ **Validation**: Comprehensive input validation
✅ **Performance**: No server bottleneck for large files

### **From Integration Plan**
✅ **API Efficiency**: Single endpoint, stays within 12 route limit
✅ **Dual Paths**: Automatic routing based on file size
✅ **Video Browser**: Lists all video sources consistently
✅ **Admin Integration**: Works with existing interface

### **Combined Benefits**
✅ **Best Security**: Tech team's proven security model
✅ **Best Integration**: Seamless with existing admin system
✅ **Best Performance**: Optimal upload path for each file size
✅ **Best UX**: Unified experience regardless of storage location

## 🚀 **Ready for Production**

This architecture provides:
- **Enterprise-grade security** following Google Cloud best practices
- **Optimal performance** with direct uploads for large files
- **Seamless integration** with existing admin interface
- **Cost efficiency** by staying within Vercel limits
- **Future-proof design** that can scale with your needs

Your 37.1MB video will now upload directly to Google Cloud Storage using a secure, time-limited signed URL, while smaller videos continue to use the efficient Vercel Blob path.
