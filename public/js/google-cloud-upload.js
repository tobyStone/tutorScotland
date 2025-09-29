/**
 * @fileoverview Google Cloud Storage direct upload client for large videos
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Client-side Google Cloud Storage integration:
 * - Direct upload for large video files (>4.5MB)
 * - Progress tracking and error handling
 * - Signed URL generation and validation
 * - Integration with video sections system
 *
 * @security Uses signed URLs for secure direct uploads
 * @performance Implements efficient large file upload with progress tracking
 */

// /public/js/google-cloud-upload.js

/**
 * Upload large video files directly to Google Cloud Storage
 * @param {File} file - The video file to upload
 * @param {Function} onProgress - Progress callback (percent)
 * @param {Function} onComplete - Completion callback (url)
 * @param {Function} onError - Error callback (error)
 */
export async function uploadLargeVideo(file, onProgress, onComplete, onError) {
    try {
        console.log('Starting large video upload:', { 
            name: file.name, 
            size: file.size, 
            type: file.type 
        });

        // Step 1: Get signed upload URL from our consolidated API
        // Normalize content type to ensure consistency
        const normalizedContentType = file.type || 'video/mp4';

        const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // ✅ SECURITY FIX: Include cookies for JWT authentication
            body: JSON.stringify({
                filename: file.name,
                contentType: normalizedContentType,
                fileSize: file.size
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get upload URL');
        }

        const { uploadUrl, publicUrl, filename, contentType } = await response.json();

        // Step 2: Upload directly to Google Cloud Storage (with CORS fallback)
        console.log('📤 Starting direct upload to Google Cloud Storage...');

        try {
            // Use the content type returned from the server to ensure consistency
            const uploadResponse = await uploadWithProgress(uploadUrl, file, onProgress, contentType || normalizedContentType);

            // uploadResponse is an XMLHttpRequest object, not a Fetch Response
            if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
                const errorText = uploadResponse.responseText || 'Unknown error';
                throw new Error(`Upload failed with status: ${uploadResponse.status}. ${errorText}`);
            }

            // Success! Direct upload to Google Cloud worked
            console.log('🎉 Direct upload to Google Cloud Storage successful!');
            onComplete(publicUrl, filename);
        } catch (error) {
            // If direct upload fails due to CORS, try server-side upload
            if (error.message.includes('CORS') || error.message.includes('network error')) {
                console.log('🔄 Direct upload failed due to CORS, automatically switching to server-side upload...');
                console.log('📡 This will upload through your Vercel server to Google Cloud Storage');
                return await uploadViaServer(file, onProgress, onComplete, onError);
            }
            throw error;
        }

        console.log('✅ Large video uploaded successfully to Google Cloud Storage');
        console.log('📍 Public URL:', publicUrl);

        // Verify the upload was successful by checking if the file exists
        try {
            const verifyResponse = await fetch(publicUrl, { method: 'HEAD' });
            if (!verifyResponse.ok) {
                console.warn('⚠️ Upload completed but file verification failed');
            } else {
                console.log('✅ Upload verified successfully');
            }
        } catch (verifyError) {
            console.warn('⚠️ Could not verify upload:', verifyError.message);
        }

        // Call completion callback with the public URL
        if (onComplete) {
            onComplete(publicUrl, filename);
        }

        return {
            url: publicUrl,
            filename: filename
        };

    } catch (error) {
        console.error('❌ Large video upload failed:', error);
        if (onError) {
            onError(error);
        }
        throw error;
    }
}

/**
 * Fallback: Upload large video via server (when CORS blocks direct upload)
 * @param {File} file - Video file to upload
 * @param {Function} onProgress - Progress callback (percent)
 * @param {Function} onComplete - Completion callback (url, filename)
 * @param {Function} onError - Error callback (error)
 */
async function uploadViaServer(file, onProgress, onComplete, onError) {
    try {
        console.log('🔄 Attempting server-side upload for large video...');

        // Create form data for server upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'video-content');
        formData.append('forceGoogleCloud', 'true'); // Flag to force Google Cloud upload

        // Upload with progress tracking
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                onProgress(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                console.log('✅ Server-side upload successful:', response.url);
                if (onComplete) {
                    onComplete(response.url, file.name);
                }
            } else {
                const error = new Error(`Server upload failed: ${xhr.status}`);
                if (onError) onError(error);
            }
        });

        xhr.addEventListener('error', () => {
            const error = new Error('Server upload failed due to network error');
            if (onError) onError(error);
        });

        xhr.open('POST', '/api/upload-image');
        xhr.withCredentials = true; // ✅ SECURITY FIX: Include cookies for JWT authentication
        xhr.send(formData);

    } catch (error) {
        console.error('Server-side upload error:', error);
        if (onError) onError(error);
    }
}

/**
 * Upload file with progress tracking
 * @param {string} uploadUrl - Signed upload URL
 * @param {File} file - File to upload
 * @param {Function} onProgress - Progress callback
 * @param {string} contentType - Content type to use (optional)
 */
function uploadWithProgress(uploadUrl, file, onProgress, contentType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(Math.round(percentComplete));
            }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                console.log(`✅ Upload successful with status: ${xhr.status}`);
                resolve(xhr);
            } else {
                console.error(`❌ Upload failed with status: ${xhr.status}`);
                console.error(`Response text: ${xhr.responseText}`);
                console.error(`Response headers: ${xhr.getAllResponseHeaders()}`);
                reject(new Error(`Upload failed with status: ${xhr.status}. Response: ${xhr.responseText}`));
            }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed due to network error'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload was aborted'));
        });

        // Configure and send request
        xhr.open('PUT', uploadUrl);

        // Google Cloud Storage signed URLs are strict about headers
        // Only set Content-Type if it's included in the signed headers
        const url = new URL(uploadUrl);
        const signedHeaders = url.searchParams.get('X-Goog-SignedHeaders');

        if (signedHeaders && signedHeaders.includes('content-type')) {
            // Use the provided content type or fall back to file type
            const typeToUse = contentType || file.type;
            xhr.setRequestHeader('Content-Type', typeToUse);
            console.log(`📋 Setting Content-Type header: ${typeToUse}`);
        }

        console.log(`🚀 Sending ${file.size} bytes to Google Cloud Storage...`);
        console.log(`📋 Upload URL: ${uploadUrl.substring(0, 100)}...`);
        xhr.send(file);
    });
}

/**
 * Check if a file should use direct Google Cloud upload
 * @param {File} file - File to check
 * @returns {boolean} - True if file should use direct upload
 */
export function shouldUseDirectUpload(file) {
    const VERCEL_LIMIT = 4.5 * 1024 * 1024; // 4.5MB
    const MAX_DIRECT_UPLOAD = 1024 * 1024 * 1024; // 1GB
    
    // Check if it's a video file
    const isVideo = file.type.startsWith('video/');
    
    // Use direct upload for videos larger than Vercel limit but smaller than max
    return isVideo && file.size > VERCEL_LIMIT && file.size <= MAX_DIRECT_UPLOAD;
}

/**
 * Get human-readable file size
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate video file for upload
 * @param {File} file - File to validate
 * @returns {Object} - Validation result with isValid and error properties
 */
export function validateVideoFile(file) {
    const MAX_SIZE = 1024 * 1024 * 1024; // 1GB
    const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
    
    if (!file) {
        return { isValid: false, error: 'No file provided' };
    }
    
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { 
            isValid: false, 
            error: 'Invalid file type. Only MP4, WebM, and OGG videos are allowed.' 
        };
    }
    
    if (file.size > MAX_SIZE) {
        return { 
            isValid: false, 
            error: `File too large. Maximum size is ${formatFileSize(MAX_SIZE)}.` 
        };
    }
    
    if (file.size === 0) {
        return { isValid: false, error: 'File is empty' };
    }
    
    return { isValid: true };
}
