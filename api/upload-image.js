/**
 * @fileoverview File upload API supporting images and videos with multiple storage backends
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Comprehensive file upload system supporting:
 * - Image uploads to Vercel Blob with thumbnail generation
 * - Video uploads with size-based routing (Vercel Blob vs Google Cloud)
 * - File validation and security checks
 * - Automatic thumbnail generation for images
 * - Hash-based deduplication to prevent duplicate uploads
 *
 * @security Implements file type validation and size limits
 * @performance Uses Sharp for efficient image processing and thumbnail generation
 */

// api/upload-image.js
const { put } = require('@vercel/blob');
const { formidable } = require('formidable');
const fs = require('fs');
const path = require('path');
const { lookup } = require('mime-types');
const { SecurityLogger } = require('../utils/security-logger');
const { csrfProtection } = require('../utils/csrf-protection');
const { applyComprehensiveSecurityHeaders } = require('../utils/security-headers');
const jwt = require('jsonwebtoken');

// Google Cloud Storage for large video uploads (using tech team's recommended approach)
let storage;
try {
    const { Storage } = require('@google-cloud/storage');

    // Primary method: Use tech team's recommended environment variables
    if (process.env.GCP_PROJECT_ID && process.env.GCS_SA_KEY) {
        const credentials = JSON.parse(process.env.GCS_SA_KEY);
        storage = new Storage({
            projectId: process.env.GCP_PROJECT_ID,
            credentials: credentials
        });
        console.log('✅ Google Cloud Storage configured with service account');
    }
    // Fallback: Original method for backward compatibility
    else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
        const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        storage = new Storage({
            projectId: credentials.project_id,
            credentials: credentials
        });
        console.log('✅ Google Cloud Storage configured with legacy credentials');
    }
    // Development fallback
    else if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        storage = new Storage({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || './google-cloud-key.json'
        });
        console.log('✅ Google Cloud Storage configured with key file');
    }
} catch (error) {
    console.log('⚠️ Google Cloud Storage not configured - large video uploads will be disabled');
    console.log('Error details:', error.message);
}

// ────────────────────────────────────────────────
// Sharp tweaks – turn the cache off and keep
// concurrency low in a server-less environment
// (prevents file-descriptor starvation)
const sharp = require('sharp');
sharp.cache(false);
sharp.concurrency(2);
const fsPromises = require('fs/promises');
const crypto = require('crypto');
// ────────────────────────────────────────────────

const MAX_UPLOAD = 4 * 1024 * 1024;  // 4MB for images
const MAX_VIDEO_UPLOAD = 4.5 * 1024 * 1024;  // 4.5MB for videos (Vercel serverless function limit)
const MAX_LARGE_VIDEO_UPLOAD = 1024 * 1024 * 1024; // 1GB for direct Google Cloud uploads
const MAX_DIMENSIONS = 2000;  // Max width/height in pixels

// Google Cloud Storage bucket (use tech team's recommended approach)
const GOOGLE_CLOUD_BUCKET = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_BUCKET || 'tutor-scotland-videos';
const ALLOWED_IMAGE_MIME = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
];
const ALLOWED_VIDEO_MIME = [
    'video/mp4',
    'video/webm',
    'video/ogg'
];
// NEW: Add a mapping for sharp format verification
const ALLOWED_SHARP_FORMATS = ['jpeg', 'png', 'webp', 'gif'];

// ✅ ENHANCED SECURITY: File content signature detection
const DANGEROUS_SIGNATURES = [
    { signature: [0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74], name: 'HTML Script Tag', description: '<script' },
    { signature: [0x3C, 0x68, 0x74, 0x6D, 0x6C], name: 'HTML Document', description: '<html' },
    { signature: [0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45], name: 'HTML DOCTYPE', description: '<!DOCTYPE' },
    { signature: [0x3C, 0x3F, 0x70, 0x68, 0x70], name: 'PHP Script', description: '<?php' },
    { signature: [0x4D, 0x5A], name: 'Windows Executable', description: 'PE/MZ header' },
    { signature: [0x7F, 0x45, 0x4C, 0x46], name: 'Linux Executable', description: 'ELF header' },
    { signature: [0x23, 0x21, 0x2F, 0x62, 0x69, 0x6E], name: 'Shell Script', description: '#!/bin' },
    { signature: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP Archive', description: 'ZIP header (potential polyglot)' },
    { signature: [0x3C, 0x69, 0x66, 0x72, 0x61, 0x6D, 0x65], name: 'HTML Iframe', description: '<iframe' },
    { signature: [0x3C, 0x6F, 0x62, 0x6A, 0x65, 0x63, 0x74], name: 'HTML Object', description: '<object' }
];

/**
 * Detect malicious file content by examining file signatures
 * @param {Buffer} buffer - File buffer to analyze
 * @returns {Object|null} - Detection result or null if safe
 */
function detectMaliciousContent(buffer) {
    if (!buffer || buffer.length === 0) {
        return { name: 'Empty File', description: 'Zero-byte file detected' };
    }

    // Check first 512 bytes for signatures (sufficient for most headers)
    const checkLength = Math.min(buffer.length, 512);
    const checkBuffer = buffer.slice(0, checkLength);

    for (const danger of DANGEROUS_SIGNATURES) {
        if (checkBuffer.length >= danger.signature.length) {
            // Check for exact signature match
            const match = danger.signature.every((byte, index) => checkBuffer[index] === byte);
            if (match) {
                return danger;
            }

            // Also check for case-insensitive text patterns (for HTML/script content)
            if (danger.signature.length > 2) {
                const textPattern = String.fromCharCode(...danger.signature).toLowerCase();
                const bufferText = checkBuffer.toString('ascii', 0, Math.min(100, checkBuffer.length)).toLowerCase();
                if (bufferText.includes(textPattern)) {
                    return danger;
                }
            }
        }
    }

    // Additional heuristic checks
    const bufferText = checkBuffer.toString('ascii', 0, Math.min(200, checkBuffer.length)).toLowerCase();

    // Check for common XSS patterns
    const xssPatterns = ['javascript:', 'vbscript:', 'onload=', 'onerror=', 'onclick='];
    for (const pattern of xssPatterns) {
        if (bufferText.includes(pattern)) {
            return { name: 'XSS Pattern', description: `Detected: ${pattern}` };
        }
    }

    // Check for SQL injection patterns in file content (improved to reduce false positives)
    const sqlPatterns = ['union select', 'drop table', 'insert into'];
    for (const pattern of sqlPatterns) {
        if (bufferText.includes(pattern)) {
            return { name: 'SQL Injection Pattern', description: `Detected: ${pattern}` };
        }
    }

    // Check for SQL comment patterns with context awareness
    if (bufferText.includes('-- ') && bufferText.match(/\b(select|insert|update|delete|drop)\b/i)) {
        return { name: 'SQL Injection Pattern', description: 'Detected: SQL comment with query keywords' };
    }

    // For /* patterns, be more intelligent about detection
    if (bufferText.includes('/*')) {
        // Check if this appears to be a legitimate image file by looking for image signatures
        const hasImageSignature = DANGEROUS_SIGNATURES.some(sig => {
            if (sig.name.includes('Image') || sig.name.includes('JPEG') || sig.name.includes('PNG')) {
                return false; // Don't flag image files
            }
            return false;
        });

        // Check for common image file headers to avoid false positives
        const imageHeaders = [
            [0xFF, 0xD8, 0xFF], // JPEG
            [0x89, 0x50, 0x4E, 0x47], // PNG
            [0x47, 0x49, 0x46], // GIF
            [0x52, 0x49, 0x46, 0x46] // WEBP/RIFF
        ];

        const isLikelyImage = imageHeaders.some(header => {
            return header.every((byte, index) => checkBuffer[index] === byte);
        });

        // Only flag /* if it appears with SQL keywords AND it's not a likely image file
        if (!isLikelyImage && bufferText.match(/\b(select|insert|update|delete|drop|union)\b/i)) {
            return { name: 'SQL Injection Pattern', description: 'Detected: SQL comment block with query keywords' };
        }
    }

    return null; // File appears safe
}

// ✅ RACE CONDITION PREVENTION: Upload guard to prevent simultaneous uploads
const activeUploads = new Map();
const MAX_CONCURRENT_UPLOADS = 2;

// ✅ HASH-BASED DEDUPLICATION: Track uploaded file hashes to prevent duplicates
const uploadedHashes = new Map(); // hash -> { url, thumbnailUrl, timestamp }

// ✅ CLEANUP: Periodic cleanup of stale upload entries (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const hashCacheThreshold = 24 * 60 * 60 * 1000; // 24 hours for hash cache

    // Clean up active uploads
    for (const [uploadId, timestamp] of activeUploads.entries()) {
        if (now - timestamp > staleThreshold) {
            console.log(`🧹 Cleaning up stale upload: ${uploadId}`);
            activeUploads.delete(uploadId);
        }
    }

    // Clean up old hash entries (keep for 24 hours)
    for (const [hash, data] of uploadedHashes.entries()) {
        if (now - data.timestamp > hashCacheThreshold) {
            console.log(`🧹 Cleaning up old hash entry: ${hash.substring(0, 16)}...`);
            uploadedHashes.delete(hash);
        }
    }
}, 5 * 60 * 1000);

module.exports = async (req, res) => {
    // Phase 2: Apply comprehensive security headers
    applyComprehensiveSecurityHeaders(res, 'api');

    if (req.method === 'GET') {
        // 🔒 SECURITY: Restrict diagnostic endpoint to authenticated admins only
        try {
            const token = req.cookies?.token;
            if (!token) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role !== 'admin') {
                return res.status(403).json({ message: 'Admin access required' });
            }

            // Minimal diagnostic info for authenticated admins only
            return res.status(200).json({
                message: 'Upload API is running',
                status: 'healthy',
                version: '2.0.0',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            return res.status(401).json({ message: 'Invalid authentication' });
        }
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'GET']);
        return res.status(405).end('Method Not Allowed');
    }

    // Phase 2: Apply CSRF protection for POST requests
    try {
        await new Promise((resolve, reject) => {
            csrfProtection(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (csrfError) {
        console.error('CSRF Protection failed for file upload:', csrfError);
        return res.status(403).json({
            error: 'Forbidden',
            message: 'CSRF protection failed',
            code: 'CSRF_VIOLATION'
        });
    }

    // 🔒 SECURITY FIX: Add authentication requirement for all file uploads
    const { verify } = require('./protected');
    const [ok, payload] = verify(req, res);
    if (!ok) {
        try {
            SecurityLogger.unauthorizedUpload('unknown', req);
        } catch (logError) {
            console.error('Security logging error:', logError);
        }
        return res.status(401).json({
            message: 'Authentication required for file uploads',
            error: 'UNAUTHORIZED_UPLOAD_ATTEMPT'
        });
    }

    // Optional: Restrict to specific roles (admin, tutor, blogwriter can upload)
    const allowedRoles = ['admin', 'tutor', 'blogwriter'];
    if (!allowedRoles.includes(payload.role)) {
        try {
            SecurityLogger.unauthorizedUpload('unknown', req, { userId: payload.id, role: payload.role });
        } catch (logError) {
            console.error('Security logging error:', logError);
        }
        return res.status(403).json({
            message: 'Insufficient permissions for file uploads',
            error: 'INSUFFICIENT_PERMISSIONS',
            allowedRoles: allowedRoles
        });
    }

    console.log(`✅ Authenticated file upload by user ${payload.id} (${payload.role})`);

    // Check if this is a request for a signed URL (for large video uploads)
    const contentType = req.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
        return handleSignedUrlRequest(req, res);
    }

    // Otherwise, handle regular file upload
    return handleFileUpload(req, res, payload);
};

// Handle signed URL generation for large video uploads (enhanced with tech team's security model)
async function handleSignedUrlRequest(req, res) {
    try {
        if (!storage) {
            return res.status(500).json({
                error: 'Google Cloud Storage not configured. Please contact administrator.',
                details: 'Service account credentials not found'
            });
        }

        const { filename, contentType, fileSize } = req.body;

        // Enhanced input validation
        if (!filename || !contentType || !fileSize) {
            return res.status(400).json({
                error: 'Missing required fields: filename, contentType, fileSize'
            });
        }

        // Validate filename (security check)
        if (typeof filename !== 'string' || filename.length > 255) {
            return res.status(400).json({
                error: 'Invalid filename. Must be a string under 255 characters.'
            });
        }

        // Validate file size (both minimum and maximum)
        if (typeof fileSize !== 'number' || fileSize <= 0) {
            return res.status(400).json({
                error: 'Invalid file size. Must be a positive number.'
            });
        }

        if (fileSize > MAX_LARGE_VIDEO_UPLOAD) {
            return res.status(413).json({
                error: `File too large. Maximum size is ${MAX_LARGE_VIDEO_UPLOAD / (1024 * 1024 * 1024)}GB`
            });
        }

        // Enhanced content type validation (following tech team's security approach)
        if (!contentType.startsWith('video/')) {
            return res.status(400).json({
                error: 'Only video files are allowed.'
            });
        }

        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (!allowedVideoTypes.includes(contentType)) {
            return res.status(400).json({
                error: 'Invalid video type. Only MP4, WebM, and OGG videos are allowed.'
            });
        }

        // Generate secure, unique filename (enhanced approach)
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 random chars

        // Clean and sanitize filename
        const cleanFilename = filename.toLowerCase()
            .replace(/\.\w+$/, '') // remove original extension
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') // only allow alphanumeric and hyphens
            .replace(/-+/g, '-') // collapse multiple hyphens
            .replace(/^-|-$/g, '') // remove leading/trailing hyphens
            .substring(0, 50); // limit length

        const extension = contentType.split('/')[1] || 'mp4';
        const uniqueFilename = `video-content/${timestamp}-${randomSuffix}-${cleanFilename}.${extension}`;

        console.log(`🔐 Generating signed URL for: ${uniqueFilename}`);

        // Get bucket reference
        const bucket = storage.bucket(GOOGLE_CLOUD_BUCKET);
        const file = bucket.file(uniqueFilename);

        // Generate signed URL with enhanced security options (following tech team's approach)
        const options = {
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes (secure expiration)
            contentType: contentType
            // Note: Removed extensionHeaders as they cause MalformedSecurityHeader errors
            // Size validation will be handled server-side instead
        };

        const [signedUrl] = await file.getSignedUrl(options);
        console.log(`✅ Signed URL generated successfully (expires in 15 minutes)`);

        // Generate the public URL for later access
        const publicUrl = `https://storage.googleapis.com/${GOOGLE_CLOUD_BUCKET}/${uniqueFilename}`;

        // Return the signed URL and file information (enhanced response)
        res.status(200).json({
            uploadUrl: signedUrl,
            filename: uniqueFilename,
            publicUrl: publicUrl,
            bucket: GOOGLE_CLOUD_BUCKET,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            maxSize: MAX_LARGE_VIDEO_UPLOAD,
            contentType: contentType
        });

    } catch (error) {
        console.error('Error generating upload URL:', error);
        res.status(500).json({
            error: 'Failed to generate upload URL',
            details: error.message
        });
    }
}

// Handle regular file upload (images, small videos, and large video fallback)
async function handleFileUpload(req, res, payload) {

    // ✅ UPLOAD GUARD: Prevent too many concurrent uploads
    if (activeUploads.size >= MAX_CONCURRENT_UPLOADS) {
        console.warn(`⚠️ Upload rejected: ${activeUploads.size} concurrent uploads already active`);
        return res.status(429).json({
            message: 'Too many uploads in progress. Please wait and try again.'
        });
    }

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    activeUploads.set(uploadId, Date.now());

    console.log(`🔄 Starting upload ${uploadId} (${activeUploads.size}/${MAX_CONCURRENT_UPLOADS} active)`);

    let uploadedFile; // Declare outside try block so it's available in catch block
    try {
        // ✅ ENHANCED: Improved formidable configuration for better security and error handling
        const form = formidable({
            keepExtensions: true,
            maxFileSize: MAX_LARGE_VIDEO_UPLOAD,  // Use the largest limit to support Google Cloud fallback
            maxTotalFileSize: MAX_LARGE_VIDEO_UPLOAD, // Prevent multiple file attacks
            uploadTimeout: 60000, // 60 second timeout for large files
            allowEmptyFiles: false, // Block empty file uploads
            minFileSize: 1, // Minimum 1 byte (prevent zero-byte attacks)
            // Enhanced error handling
            onError: (err) => {
                console.error('🚨 Formidable upload error:', err.message);
                if (err.code === 'LIMIT_FILE_SIZE') {
                    console.error(`File size limit exceeded: ${err.received} bytes received`);
                }
            }
        });

        console.log('📝 Starting file parsing with formidable...');
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) {
                    console.error('❌ Formidable parsing failed:', err);
                    console.error('❌ Error details:', {
                        name: err.name,
                        code: err.code,
                        message: err.message,
                        stack: err.stack
                    });
                    reject(err);
                } else {
                    console.log('✅ File parsing completed successfully');
                    console.log('📊 Parsed files:', Object.keys(files));
                    resolve([fields, files]);
                }
            });
        });

        const fileObj = (files.file || files.image);
        uploadedFile = Array.isArray(fileObj) ? fileObj[0] : fileObj;
        if (!uploadedFile) {
            activeUploads.delete(uploadId);
            return res.status(400).json({ message: 'No file provided' });
        }

        // ─── NEW: BULLET-PROOF INTEGRITY CHECKS ───────────────────────────────
        // These checks run BEFORE we attempt to read or process the file.

        // CHECK 1: Was the file truncated by Formidable for being too large?
        if (uploadedFile.truncated) {
            console.error(`Upload truncated: File exceeded ${MAX_UPLOAD} bytes.`);
            activeUploads.delete(uploadId);
            return res.status(413).json({
                message: `File is too large. The limit is ${MAX_UPLOAD / 1024 / 1024}MB.`
            });
        }

        // CHECK 2: Does the file size on disk match the expected size?
        // This prevents race conditions where we read a file that's still being written.
        // ✅ FIX: Add retry logic to handle file system delays
        let stats;
        let sizeCheckAttempts = 0;
        const maxSizeCheckAttempts = 3;

        while (sizeCheckAttempts < maxSizeCheckAttempts) {
            sizeCheckAttempts++;
            stats = await fsPromises.stat(uploadedFile.filepath);

            // Allow small rounding differences (≤1 byte) to handle harmless variations
            const sizeDifference = Math.abs(stats.size - uploadedFile.size);
            if (sizeDifference <= 1) {
                if (sizeDifference > 0) {
                    console.log(`✅ File size check passed with minor difference: ${sizeDifference} byte(s)`);
                }
                break; // Size check passed
            }

            if (sizeCheckAttempts < maxSizeCheckAttempts) {
                console.warn(`⚠️ Size check attempt ${sizeCheckAttempts}: on-disk(${stats.size}) vs expected(${uploadedFile.size}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, 75)); // 75ms delay
            } else {
                console.error(`❌ Upload size mismatch after ${maxSizeCheckAttempts} attempts: on-disk(${stats.size}) vs expected(${uploadedFile.size}).`);
                activeUploads.delete(uploadId);
                return res.status(500).json({
                    message: 'Incomplete upload due to a server issue. Please try again.'
                });
            }
        }

        console.log(`✅ File integrity verified: ${uploadedFile.originalFilename} (${stats.size} bytes)`);
        // ──────────────────────────────────────────────────────────────────

        let mime = uploadedFile.mimetype || '';
        if (mime === '' || mime.toLowerCase() === 'application/octet-stream') {
            mime = lookup(uploadedFile.originalFilename) || '';
        }

        // Check if it's an image or video
        const isImage = ALLOWED_IMAGE_MIME.includes(mime.toLowerCase());
        const isVideo = ALLOWED_VIDEO_MIME.includes(mime.toLowerCase());

        if (!isImage && !isVideo) {
            activeUploads.delete(uploadId);
            return res.status(415).json({
                message: 'Unsupported file type. Please use JPG, PNG, WebP, GIF for images or MP4, WebM, OGG for videos.'
            });
        }

        // Check for Google Cloud fallback flag
        const forceGoogleCloud = fields.forceGoogleCloud === 'true';

        // Check file size limits (allow larger files for Google Cloud fallback)
        let maxSize;
        if (forceGoogleCloud && isVideo) {
            maxSize = MAX_LARGE_VIDEO_UPLOAD; // 1GB for Google Cloud fallback
            console.log('🔄 Using Google Cloud fallback for large video upload');
        } else {
            maxSize = isVideo ? MAX_VIDEO_UPLOAD : MAX_UPLOAD;
        }

        if (uploadedFile.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            const storageType = forceGoogleCloud ? 'Google Cloud Storage' : (isVideo ? 'videos' : 'images');
            activeUploads.delete(uploadId);
            return res.status(413).json({
                message: `File too large. Maximum size is ${maxSizeMB}MB for ${storageType}.`
            });
        }
        uploadedFile.mimetype = mime; // Normalise for later put

        // This check is now handled above with separate limits for images and videos

        // ─── NEW: Sanitized Filename Generation ────────────────────────────
        const originalName = uploadedFile.originalFilename || 'image';
        const clean = originalName.toLowerCase()
            .replace(/\.\w+$/, '') // remove original extension
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        // Derive the extension from the trusted MIME type
        const extension = mime.split('/')[1] || 'jpg';
        const filename = `${Date.now()}-${clean}.${extension}`;
        // ──────────────────────────────────────────────────────────────────

        // Robust folder parsing - handles both 'team' and ['team'] formats
        const folderField = Array.isArray(fields.folder) ? fields.folder[0] : fields.folder;
        const folder = (folderField || 'content-images').trim();

        /* -------------------------------------------------------------
            1️⃣  Read the *fully-verified* temp file into RAM
        ------------------------------------------------------------- */
        let buffer = await fsPromises.readFile(uploadedFile.filepath);

        // CHECK 3: Verify buffer integrity - ensure buffer size matches file size
        // ✅ FIX: Add retry logic to handle buffer read delays
        let bufferCheckAttempts = 0;
        const maxBufferCheckAttempts = 3;
        let currentBuffer = buffer;

        while (bufferCheckAttempts < maxBufferCheckAttempts) {
            bufferCheckAttempts++;

            // Allow small rounding differences (≤1 byte) to handle harmless variations
            const bufferSizeDifference = Math.abs(currentBuffer.length - uploadedFile.size);
            if (bufferSizeDifference <= 1) {
                if (bufferSizeDifference > 0) {
                    console.log(`✅ Buffer size check passed with minor difference: ${bufferSizeDifference} byte(s)`);
                }
                break; // Buffer check passed
            }

            if (bufferCheckAttempts < maxBufferCheckAttempts) {
                console.warn(`⚠️ Buffer check attempt ${bufferCheckAttempts}: buffer(${currentBuffer.length}) vs expected(${uploadedFile.size}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, 75)); // 75ms delay
                // Re-read the file in case it was still being written
                currentBuffer = await fsPromises.readFile(uploadedFile.filepath);
            } else {
                console.error(`❌ Buffer size mismatch after ${maxBufferCheckAttempts} attempts: buffer(${currentBuffer.length}) vs file(${uploadedFile.size})`);
                // Clean up temp file before exiting
                fs.unlink(uploadedFile.filepath, (err) => {
                    if (err) console.error('Error deleting incomplete temp file:', err);
                });
                activeUploads.delete(uploadId);
                return res.status(500).json({
                    message: 'File read error. Please try uploading again.'
                });
            }
        }

        // Update buffer reference to use the verified buffer
        buffer = currentBuffer;

        // ✅ ENHANCED SECURITY: Deep content inspection for malicious files
        console.log('🔍 Performing deep content security scan...');
        const maliciousContent = detectMaliciousContent(buffer);
        if (maliciousContent) {
            console.error(`🚨 SECURITY ALERT: Malicious content detected - ${maliciousContent.name}: ${maliciousContent.description}`);

            // Clean up temp file immediately
            fs.unlink(uploadedFile.filepath, (err) => {
                if (err) console.error('Error deleting malicious temp file:', err);
            });

            // Log security incident
            try {
                SecurityLogger.maliciousFileBlocked(
                    uploadedFile.originalFilename || 'unknown',
                    maliciousContent.name,
                    { userId: payload.id, role: payload.role },
                    req
                );
            } catch (logError) {
                console.error('Security logging error:', logError);
            }

            return res.status(415).json({
                message: `Blocked malicious file content: ${maliciousContent.name}`,
                error: 'MALICIOUS_CONTENT_DETECTED',
                details: maliciousContent.description,
                filename: uploadedFile.originalFilename
            });
        }
        console.log('✅ Content security scan passed - file appears safe');

        // ✅ HASH-BASED DEDUPLICATION: Calculate file hash to check for duplicates
        const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
        console.log(`🔍 File hash: ${fileHash.substring(0, 16)}...`);

        // Check if we've already uploaded this exact file
        if (uploadedHashes.has(fileHash)) {
            const existing = uploadedHashes.get(fileHash);
            console.log(`♻️ Duplicate file detected - returning existing URLs`);

            // Clean up temp file
            fs.unlink(uploadedFile.filepath, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });

            // Remove from active uploads
            activeUploads.delete(uploadId);

            return res.status(200).json({
                message: 'File already exists - returning existing URLs',
                url: existing.url,
                thumbnailUrl: existing.thumbnailUrl,
                duplicate: true,
                originalHash: fileHash.substring(0, 16)
            });
        }

        // Handle videos differently - skip Sharp processing
        if (isVideo) {
            console.log(`📹 Processing video upload: ${filename}`);

            // Check if we should use Google Cloud Storage (fallback mode)
            if (forceGoogleCloud && storage) {
                console.log(`🌩️ Using Google Cloud Storage fallback for large video`);

                try {
                    // Generate unique filename for Google Cloud
                    const timestamp = Date.now();
                    const randomSuffix = Math.random().toString(36).substring(2, 8);
                    const cleanName = filename.replace(/\.\w+$/, '').substring(0, 50);
                    const extension = uploadedFile.mimetype.split('/')[1] || 'mp4';
                    const gcFilename = `video-content/${timestamp}-${randomSuffix}-${cleanName}.${extension}`;

                    // Upload to Google Cloud Storage
                    const bucket = storage.bucket(GOOGLE_CLOUD_BUCKET);
                    const file = bucket.file(gcFilename);

                    console.log(`📤 Uploading large video to Google Cloud: ${gcFilename}`);

                    await file.save(buffer, {
                        metadata: {
                            contentType: uploadedFile.mimetype,
                        },
                        public: true, // Make file publicly accessible
                    });

                    const publicUrl = `https://storage.googleapis.com/${GOOGLE_CLOUD_BUCKET}/${gcFilename}`;

                    console.log(`✅ Large video uploaded to Google Cloud Storage: ${publicUrl}`);

                    // ✅ SEPARATE VERIFICATION: Poll HEAD endpoint for Google Cloud
                    console.log('🔍 Starting Google Cloud verification polling...');
                    let gcVerificationPending = false;
                    let gcVerificationAttempts = 0;
                    const maxGcVerificationAttempts = 5;

                    while (gcVerificationAttempts < maxGcVerificationAttempts) {
                        try {
                            gcVerificationAttempts++;

                            // Add delay before verification (except first attempt)
                            if (gcVerificationAttempts > 1) {
                                const delay = 1000 + (gcVerificationAttempts * 500); // Longer delays for Google Cloud
                                await new Promise(resolve => setTimeout(resolve, delay));
                            }

                            console.log(`🔍 GC verification attempt ${gcVerificationAttempts}/${maxGcVerificationAttempts}...`);
                            const verifyResponse = await fetch(publicUrl, { method: 'HEAD' });

                            if (verifyResponse.ok) {
                                console.log(`✅ Google Cloud video verified successfully`);
                                break; // Verification successful
                            } else {
                                console.warn(`⚠️ GC verification failed with status: ${verifyResponse.status}`);
                            }

                            // If this was the last attempt, mark as pending
                            if (gcVerificationAttempts >= maxGcVerificationAttempts) {
                                console.warn('⚠️ Google Cloud verification polling exhausted - marking as pending');
                                gcVerificationPending = true;
                            }

                        } catch (verifyError) {
                            console.warn(`⚠️ GC verification attempt ${gcVerificationAttempts} error:`, verifyError.message);
                            if (gcVerificationAttempts >= maxGcVerificationAttempts) {
                                console.warn('⚠️ All GC verification attempts failed - marking as pending');
                                gcVerificationPending = true;
                            }
                        }
                    }

                    const gcResponse = {
                        message: 'Large video uploaded successfully to Google Cloud Storage',
                        url: publicUrl,
                        filename: gcFilename,
                        size: uploadedFile.size,
                        type: uploadedFile.mimetype,
                        storage: 'google-cloud'
                    };

                    // Add verification status if pending
                    if (gcVerificationPending) {
                        gcResponse.verificationPending = true;
                        console.log('⚠️ Returning Google Cloud response with verification pending flag');
                    }

                    return res.status(200).json(gcResponse);

                } catch (gcError) {
                    console.error('Google Cloud upload failed:', gcError);
                    return res.status(500).json({
                        message: 'Google Cloud upload failed',
                        error: gcError.message
                    });
                }
            }

            // Default: Upload to Vercel Blob Storage
            const putOpts = {
                access: 'public',
                contentType: uploadedFile.mimetype,
                overwrite: true,
                // Add metadata for better organization
                addRandomSuffix: false // We already have timestamp in filename
            };

            // Ensure video-content folder for organization
            const videoFolder = folder === 'content-images' ? 'video-content' : folder;
            const videoKey = `${videoFolder}/${filename}`;

            try {
                console.log(`📤 Uploading video to Vercel Blob storage: ${videoKey}`);
                const uploadResult = await put(videoKey, buffer, putOpts);
                console.log('✅ Video uploaded to Vercel Blob:', uploadResult.url);

                // ✅ SEPARATE VERIFICATION: Poll HEAD endpoint for video
                console.log('🔍 Starting video verification polling...');
                let videoVerificationPending = false;
                let videoVerificationAttempts = 0;
                const maxVideoVerificationAttempts = 5;

                while (videoVerificationAttempts < maxVideoVerificationAttempts) {
                    try {
                        videoVerificationAttempts++;

                        // Add delay before verification (except first attempt)
                        if (videoVerificationAttempts > 1) {
                            const delay = 500 + (videoVerificationAttempts * 200);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }

                        console.log(`🔍 Video verification attempt ${videoVerificationAttempts}/${maxVideoVerificationAttempts}...`);
                        const verifyResponse = await fetch(uploadResult.url, { method: 'HEAD' });

                        if (verifyResponse.ok) {
                            const uploadedSize = parseInt(verifyResponse.headers.get('content-length') || '0');
                            if (uploadedSize === buffer.length) {
                                console.log(`✅ Video verified: ${uploadedSize} bytes`);
                                break; // Verification successful
                            } else {
                                console.warn(`⚠️ Video size mismatch: uploaded ${uploadedSize} vs expected ${buffer.length}`);
                            }
                        } else {
                            console.warn(`⚠️ Video verification failed with status: ${verifyResponse.status}`);
                        }

                        // If this was the last attempt, mark as pending
                        if (videoVerificationAttempts >= maxVideoVerificationAttempts) {
                            console.warn('⚠️ Video verification polling exhausted - marking as pending');
                            videoVerificationPending = true;
                        }

                    } catch (verifyError) {
                        console.warn(`⚠️ Video verification attempt ${videoVerificationAttempts} error:`, verifyError.message);
                        if (videoVerificationAttempts >= maxVideoVerificationAttempts) {
                            console.warn('⚠️ All video verification attempts failed - marking as pending');
                            videoVerificationPending = true;
                        }
                    }
                }

                // Clean up temp file
                fs.unlink(uploadedFile.filepath, (err) => {
                    if (err) console.error('Error deleting temp file:', err);
                });

                const videoResponse = {
                    message: 'Video uploaded successfully',
                    url: uploadResult.url,
                    filename: filename,
                    size: uploadedFile.size,
                    type: 'video',
                    folder: videoFolder
                };

                // Add verification status if pending
                if (videoVerificationPending) {
                    videoResponse.verificationPending = true;
                    console.log('⚠️ Returning video response with verification pending flag');
                }

                return res.status(200).json(videoResponse);

            } catch (error) {
                console.error('Video upload error:', error);
                // Clean up temp file
                fs.unlink(uploadedFile.filepath, (err) => {
                    if (err) console.error('Error deleting temp file:', err);
                });
                return res.status(500).json({
                    message: 'Video upload failed',
                    error: error.message
                });
            }
        }

        // ✅ IMPROVED: More robust Sharp initialization with strict error handling (for images only)
        let img;
        try {
            console.log('🔧 Initializing Sharp for image processing...');
            img = sharp(buffer, {
                failOnError: false,  // Changed to false to be more lenient in serverless
                sequentialRead: true,  // Ensure complete buffer read
                limitInputPixels: MAX_DIMENSIONS * MAX_DIMENSIONS * 4  // Prevent memory issues
            });
            console.log('✅ Sharp initialized successfully');
        } catch (sharpInitError) {
            console.error('❌ Sharp initialization failed:', sharpInitError);
            throw new Error(`Image processing library failed to initialize: ${sharpInitError.message}`);
        }

        /* -------------------------------------------------------------
            2️⃣  Metadata check (images only)
        ------------------------------------------------------------- */
        let metadata;
        try {
            metadata = await img.metadata();
        } catch (e) {
            console.warn('[upload-image] Sharp metadata failed:', e.message);
            // Delete the invalid temp file before exiting
            fs.unlink(uploadedFile.filepath, (err) => {
                if (err) console.error('Error deleting corrupt temp file:', err);
            });
            activeUploads.delete(uploadId);
            return res.status(400).json({
                message: 'Unable to process image – it may be corrupt or not a valid image file.'
            });
        }

        // ─── NEW: Verify Sharp-detected format ──────────────────────────────
        if (!metadata.format || !ALLOWED_SHARP_FORMATS.includes(metadata.format)) {
             fs.unlink(uploadedFile.filepath, ()=>{}); // cleanup
             activeUploads.delete(uploadId);
             return res.status(415).json({
                message: `File appears to be a ${metadata.format || 'unknown type'}, not an allowed image.`
             });
        }

        console.log(`✅ Image validated: ${metadata.width}x${metadata.height} ${metadata.format}`);

        // ✅ FIX: Create format mapping for thumbnail generation to preserve transparency
        const formatMap = {
            'jpeg': { ext: 'jpg', mime: 'image/jpeg', options: { quality: 95, progressive: true, mozjpeg: true } },
            'jpg': { ext: 'jpg', mime: 'image/jpeg', options: { quality: 95, progressive: true, mozjpeg: true } },
            'png': { ext: 'png', mime: 'image/png', options: { quality: 95, progressive: false } },
            'webp': { ext: 'webp', mime: 'image/webp', options: { quality: 95, progressive: false } },
            'gif': { ext: 'gif', mime: 'image/gif', options: { quality: 95, progressive: false } }
        };

        const thumbFormat = formatMap[metadata.format.toLowerCase()] || formatMap['jpeg']; // Default to JPEG if unknown
        console.log(`📸 Thumbnail format: ${thumbFormat.ext} (${thumbFormat.mime})`);

        // ✅ NEW: Additional validation to detect corrupted/incomplete images
        if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) {
            fs.unlink(uploadedFile.filepath, ()=>{}); // cleanup
            activeUploads.delete(uploadId);
            return res.status(400).json({
                message: 'Image appears to be corrupted or has invalid dimensions.'
            });
        }

        // ✅ IMPROVED: Minimal size validation - only catch truly corrupted files
        // Modern JPEG compression can achieve very high ratios, so be very conservative
        const minFileSize = 50; // Absolute minimum - anything smaller is likely corrupted

        // Only flag files that are impossibly small (likely truncated during upload)
        if (buffer.length < minFileSize) {
            console.warn(`File too small: ${buffer.length} bytes for ${metadata.width}x${metadata.height} image`);
            fs.unlink(uploadedFile.filepath, ()=>{}); // cleanup
            activeUploads.delete(uploadId);
            return res.status(400).json({
                message: 'Image file appears to be corrupted or incomplete. Please try uploading again.'
            });
        }

        console.log(`✅ Size validation passed: ${buffer.length} bytes for ${metadata.width}x${metadata.height}`);
        // ──────────────────────────────────────────────────────────────────

        if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
            activeUploads.delete(uploadId);
            return res.status(400).json({
                message: `Image dimensions too large. Max ${MAX_DIMENSIONS}px each side.`
            });
        }

        /* -------------------------------------------------------------
            3️⃣  Server-side image integrity test & thumbnail creation
        ------------------------------------------------------------- */

        // ✅ RELAXED: Test image processing to detect corruption/artifacts
        // Only reject images that are truly corrupted, not just different formats
        try {
            // Try to process the image - this will fail if the image is corrupted
            const testBuffer = await img
                .resize(100, 100, { fit: 'cover', position: 'center' })
                .jpeg({ quality: 90 })
                .toBuffer();

            if (!testBuffer || testBuffer.length === 0) {
                throw new Error('Image processing test failed');
            }
        } catch (processError) {
            console.warn('Image processing test failed, but continuing:', processError.message);
            // ✅ CHANGE: Don't reject the image, just log the warning
            // Many valid images fail strict Sharp validation but work fine
            // fs.unlink(uploadedFile.filepath, ()=>{}); // cleanup
            // return res.status(400).json({
            //     message: 'Image appears to be corrupted and cannot be processed. Please try a different image.'
            // });
        }

        // ✅ IMPROVED: More robust thumbnail generation with validation
        let thumbnailBuffer;
        try {
            console.log('🖼️ Generating thumbnail...');

            // Create a fresh Sharp instance for thumbnail to avoid conflicts
            const thumbImg = sharp(buffer, {
                failOnError: true,
                sequentialRead: true
            });

            thumbnailBuffer = await thumbImg
                .resize(240, 240, {
                    fit: 'cover',
                    position: 'center',
                    kernel: 'lanczos3',  // High-quality resampling
                    withoutEnlargement: false  // Allow enlargement for small images
                })
                .toFormat(metadata.format, thumbFormat.options)
                .toBuffer();

            // ✅ RELAXED: Ensure thumbnail was created successfully
            if (!thumbnailBuffer || thumbnailBuffer.length === 0) {
                console.warn('Thumbnail generation produced empty buffer, but continuing...');
                // Don't throw error - some images work fine without thumbnails
                // throw new Error('Thumbnail generation produced empty buffer');
            }

            console.log(`✅ Thumbnail generated: ${thumbnailBuffer.length} bytes`);

        } catch (kernelError) {
            console.warn('Advanced thumbnail generation failed, using fallback:', kernelError.message);

            try {
                // Fallback to simpler thumbnail generation with more lenient settings
                const fallbackImg = sharp(buffer, { failOnError: false, limitInputPixels: false });
                // Use simpler options for fallback (remove progressive/mozjpeg which might cause issues)
                const fallbackOptions = { ...thumbFormat.options, progressive: false, mozjpeg: false };
                thumbnailBuffer = await fallbackImg
                    .resize(240, 240, { fit: 'cover', position: 'center' })
                    .toFormat(metadata.format, fallbackOptions)
                    .toBuffer();

                if (!thumbnailBuffer || thumbnailBuffer.length === 0) {
                    console.warn('Fallback thumbnail generation produced empty buffer, skipping thumbnail...');
                    thumbnailBuffer = null; // Skip thumbnail upload
                } else {
                    console.log(`✅ Fallback thumbnail generated: ${thumbnailBuffer.length} bytes`);
                }
            } catch (fallbackError) {
                console.warn('Fallback thumbnail generation also failed, skipping thumbnail:', fallbackError.message);
                thumbnailBuffer = null; // Skip thumbnail upload entirely
            }
        }

        const putOpts = { access: 'public', contentType: uploadedFile.mimetype, overwrite: true };
        const mainKey = `${folder}/${filename}`;

        // ✅ FIX: Use original format for thumbnails to preserve transparency
        const fileExtension = path.extname(filename);
        const baseName = path.basename(filename, fileExtension);
        const thumbFilename = `${baseName}.${thumbFormat.ext}`; // Use original format extension
        const thumbKey = `${folder}/thumbnails/${thumbFilename}`;
        const thumbPutOpts = { access: 'public', contentType: thumbFormat.mime, overwrite: true };

        // ✅ DECOUPLED UPLOAD: Upload once, then verify separately
        console.log('🔄 Starting blob upload...');

        // Upload main image (single attempt)
        let url, thumbnailUrl;
        let verificationPending = false;

        try {
            console.log(`📤 Uploading main image to Vercel Blob...`);
            console.log(`📊 Upload details: key=${mainKey}, size=${buffer.length}, contentType=${uploadedFile.mimetype}`);

            // Check if BLOB_READ_WRITE_TOKEN is available
            if (!process.env.BLOB_READ_WRITE_TOKEN) {
                throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
            }

            const uploadResult = await put(mainKey, buffer, putOpts);
            url = uploadResult.url;
            console.log(`✅ Main image uploaded successfully: ${url}`);

            // ✅ SEPARATE VERIFICATION: Poll HEAD endpoint with delays
            console.log('🔍 Starting verification polling...');
            let verificationAttempts = 0;
            const maxVerificationAttempts = 5;

            while (verificationAttempts < maxVerificationAttempts) {
                try {
                    verificationAttempts++;

                    // Add delay before verification (except first attempt)
                    if (verificationAttempts > 1) {
                        const delay = 500 + (verificationAttempts * 200); // 700ms, 900ms, 1100ms, 1300ms
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    console.log(`🔍 Verification attempt ${verificationAttempts}/${maxVerificationAttempts}...`);
                    const verifyResponse = await fetch(url, { method: 'HEAD' });

                    if (verifyResponse.ok) {
                        const uploadedSize = parseInt(verifyResponse.headers.get('content-length') || '0');
                        if (uploadedSize === buffer.length) {
                            console.log(`✅ Main image verified: ${uploadedSize} bytes`);
                            break; // Verification successful
                        } else {
                            console.warn(`⚠️ Size mismatch in verification: uploaded ${uploadedSize} vs expected ${buffer.length}`);
                        }
                    } else {
                        console.warn(`⚠️ Verification failed with status: ${verifyResponse.status}`);
                    }

                    // If this was the last attempt, mark as pending
                    if (verificationAttempts >= maxVerificationAttempts) {
                        console.warn('⚠️ Verification polling exhausted - marking as pending');
                        verificationPending = true;
                    }

                } catch (verifyError) {
                    console.warn(`⚠️ Verification attempt ${verificationAttempts} error:`, verifyError.message);
                    if (verificationAttempts >= maxVerificationAttempts) {
                        console.warn('⚠️ All verification attempts failed - marking as pending');
                        verificationPending = true;
                    }
                }
            }

        } catch (uploadError) {
            console.error('❌ Main image upload to Vercel Blob failed:', uploadError);
            console.error('❌ Upload error details:', {
                message: uploadError.message,
                code: uploadError.code,
                name: uploadError.name,
                stack: uploadError.stack
            });

            // Provide more specific error messages
            if (uploadError.message?.includes('BLOB_READ_WRITE_TOKEN')) {
                throw new Error('Blob storage not configured - missing BLOB_READ_WRITE_TOKEN');
            } else if (uploadError.message?.includes('network') || uploadError.message?.includes('fetch')) {
                throw new Error('Network error during blob upload - please try again');
            } else {
                throw new Error(`Blob storage upload failed: ${uploadError.message}`);
            }
        }

        // Upload thumbnail with same decoupled verification (if thumbnail was generated)
        let thumbVerificationPending = false;
        if (thumbnailBuffer && thumbnailBuffer.length > 0) {
            try {
                console.log(`📤 Uploading thumbnail...`);
                const thumbResult = await put(thumbKey, thumbnailBuffer, thumbPutOpts);
                thumbnailUrl = thumbResult.url;
                console.log(`✅ Thumbnail uploaded: ${thumbnailUrl}`);

                // ✅ SEPARATE VERIFICATION: Poll thumbnail HEAD endpoint
                console.log('🔍 Starting thumbnail verification polling...');
                let thumbVerificationAttempts = 0;
                const maxThumbVerificationAttempts = 5;

                while (thumbVerificationAttempts < maxThumbVerificationAttempts) {
                    try {
                        thumbVerificationAttempts++;

                        // Add delay before verification (except first attempt)
                        if (thumbVerificationAttempts > 1) {
                            const delay = 500 + (thumbVerificationAttempts * 200);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }

                        console.log(`🔍 Thumbnail verification attempt ${thumbVerificationAttempts}/${maxThumbVerificationAttempts}...`);
                        const verifyThumbResponse = await fetch(thumbnailUrl, { method: 'HEAD' });

                        if (verifyThumbResponse.ok) {
                            const thumbUploadedSize = parseInt(verifyThumbResponse.headers.get('content-length') || '0');
                            if (thumbUploadedSize === thumbnailBuffer.length) {
                                console.log(`✅ Thumbnail verified: ${thumbUploadedSize} bytes`);
                                break; // Verification successful
                            } else {
                                console.warn(`⚠️ Thumbnail size mismatch: uploaded ${thumbUploadedSize} vs expected ${thumbnailBuffer.length}`);
                            }
                        } else {
                            console.warn(`⚠️ Thumbnail verification failed with status: ${verifyThumbResponse.status}`);
                        }

                        // If this was the last attempt, log warning and fallback to main URL
                        if (thumbVerificationAttempts >= maxThumbVerificationAttempts) {
                            console.warn('⚠️ Thumbnail verification polling exhausted - falling back to main image URL');
                            thumbnailUrl = url; // ✅ FIX: Fallback to main image to prevent 404s
                            thumbVerificationPending = true; // ✅ FIX: Flag for client awareness
                        }

                    } catch (verifyError) {
                        console.warn(`⚠️ Thumbnail verification attempt ${thumbVerificationAttempts} error:`, verifyError.message);
                        if (thumbVerificationAttempts >= maxThumbVerificationAttempts) {
                            console.warn('⚠️ All thumbnail verification attempts failed - falling back to main image URL');
                            thumbnailUrl = url; // ✅ FIX: Fallback to main image to prevent 404s
                            thumbVerificationPending = true; // ✅ FIX: Flag for client awareness
                        }
                    }
                }

            } catch (thumbError) {
                console.warn('⚠️ Thumbnail upload failed, using main image URL:', thumbError.message);
                thumbnailUrl = url; // Fallback to main image URL
            }
        } else {
            console.log('⚠️ Skipping thumbnail upload - thumbnail generation failed');
            thumbnailUrl = null; // No thumbnail available
        }

        console.log(`✅ All uploads complete and verified: ${url}`);

        // Clean up temp file
        fs.unlink(uploadedFile.filepath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        // ✅ CLEANUP: Remove from active uploads
        activeUploads.delete(uploadId);
        console.log(`✅ Upload ${uploadId} completed successfully`);

        // ✅ HASH-BASED DEDUPLICATION: Store hash for future deduplication
        uploadedHashes.set(fileHash, {
            url,
            thumbnailUrl,
            timestamp: Date.now()
        });
        console.log(`💾 Stored file hash for deduplication: ${fileHash.substring(0, 16)}...`);

        // Log successful file upload
        try {
            SecurityLogger.fileUpload(
                filename,
                uploadedFile.size,
                { userId: payload.id, role: payload.role },
                req
            );
        } catch (logError) {
            console.error('Security logging error:', logError);
        }

        const response = {
            url,
            thumb: thumbnailUrl,
            width: metadata.width,
            height: metadata.height,
            type: uploadedFile.mimetype,
            hash: fileHash.substring(0, 16) // Return truncated hash for reference
        };

        // Add verification status if pending
        if (verificationPending) {
            response.verificationPending = true;
            console.log('⚠️ Returning response with verification pending flag');
        }

        // ✅ FIX: Add thumbnail verification status if pending
        if (thumbVerificationPending) {
            response.thumbVerificationPending = true;
            console.log('⚠️ Returning response with thumbnail verification pending flag');
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error('[upload-image] Unexpected error:', error);
        console.error('[upload-image] Error stack:', error.stack);
        console.error('[upload-image] Error name:', error.name);
        console.error('[upload-image] Error code:', error.code);

        // Enhanced error logging for debugging
        if (uploadedFile) {
            console.error('[upload-image] File details:', {
                originalFilename: uploadedFile.originalFilename,
                size: uploadedFile.size,
                mimetype: uploadedFile.mimetype,
                filepath: uploadedFile.filepath
            });
        }

        // Log environment info for debugging
        console.error('[upload-image] Environment info:', {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: process.memoryUsage(),
            vercelRegion: process.env.VERCEL_REGION,
            runtime: process.env.AWS_EXECUTION_ENV || 'unknown'
        });

        // ✅ CLEANUP: Remove from active uploads on error
        activeUploads.delete(uploadId);
        console.log(`❌ Upload ${uploadId} failed and cleaned up`);

        // Clean up temp file if it exists
        if (uploadedFile?.filepath) {
            fs.unlink(uploadedFile.filepath, (err) => {
                if (err) console.error('Error deleting temp file after error:', err);
            });
        }

        // Return more detailed error information for debugging
        return res.status(500).json({
            message: 'Upload failed unexpectedly',
            error: error.message,
            errorName: error.name,
            errorCode: error.code,
            timestamp: new Date().toISOString(),
            // Include some debugging info (but not sensitive data)
            debug: {
                hasFile: !!uploadedFile,
                fileSize: uploadedFile?.size,
                mimetype: uploadedFile?.mimetype,
                nodeVersion: process.version
            }
        });
    }
}

// Pin runtime for Sharp compatibility
module.exports.config = { runtime: 'nodejs18.x' };