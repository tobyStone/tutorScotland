/**
 * @fileoverview API service for visual editor communication
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Centralized API communication service for the visual editor:
 * - Admin authentication status checking
 * - Content override management
 * - Image upload and management
 * - Error handling and response processing
 *
 * @security Handles admin authentication and secure API communication
 * @performance Implements efficient HTTP requests with proper caching
 */

const API_ROOT = '/api/content-manager';

/**
 * API service class for visual editor operations
 * @class ApiService
 * @description Provides methods for communicating with backend APIs
 */
class ApiService {
    async checkAdminStatus() {
        const resp = await fetch('/api/login?check=admin', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (!resp.ok) throw new Error('Admin check failed');
        return resp.json();
    }

    async loadOverrides(pageKey) {
        const r = await fetch(`${API_ROOT}?operation=overrides&page=${pageKey}`);
        if (!r.ok) throw new Error('Failed to load overrides');
        return r.json();
    }

    async saveOverride(payload) {
        const url = payload._id ? `${API_ROOT}?operation=override&id=${payload._id}` : `${API_ROOT}?operation=override`;
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error('Failed to save override');
        return r.json();
    }

    async deleteOverride(id) {
        const r = await fetch(`${API_ROOT}?id=${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('Failed to delete override');
        return true;
    }

    async loadImages({ page, search, sort }) {
        const params = new URLSearchParams({ operation: 'list-images', page, search, sort });
        const r = await fetch(`${API_ROOT}?${params.toString()}`);
        if (!r.ok) throw new Error('Failed to load images');
        return r.json();
    }

    async uploadImage(formData, onProgress) {
        // ✅ IMPROVED: Add client-side preprocessing to prevent corrupted uploads
        const file = formData.get('file');
        if (!file) {
            throw new Error('No file provided');
        }

        // Validate file before upload
        const MAX_SIZE = 4 * 1024 * 1024; // 4MB
        if (file.size > MAX_SIZE) {
            throw new Error('Image is larger than 4MB - please resize it first');
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please use JPG, PNG, WebP or GIF');
        }

        // ✅ TEMPORARY: Disable client-side resizing to isolate server issues
        let processedFile = file;
        console.log('Using original file without client-side resizing for debugging');

        // TODO: Re-enable after server issues are resolved
        /*
        if (file.size > 2.5 * 1024 * 1024) { // larger than 2.5MB? shrink it
            console.log('Resizing large image to prevent upload artifacts...');
            try {
                processedFile = await this.resizeImageSafely(file, 1280);
                console.log('Image resized successfully to size:', processedFile.size);
            } catch (error) {
                console.warn('Client-side resizing failed, using original file:', error.message);
                // Continue with original file if resizing fails
            }
        }
        */

        // Create new FormData with processed file
        const processedFormData = new FormData();
        processedFormData.append('file', processedFile);
        processedFormData.append('folder', formData.get('folder') || 'content-images');

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload-image', true);
            xhr.upload.onprogress = e => {
                if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        reject(new Error('Invalid server response'));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(processedFormData);
        });
    }

    // ✅ NEW: Safe image resizing method to prevent horizontal line artifacts
    async resizeImageSafely(file, maxSide = 1280) {
        // Validate input
        if (!file || file.size === 0) {
            throw new Error('Invalid file for resizing');
        }

        const img = await createImageBitmap(file);

        // Validate image dimensions
        if (!img.width || !img.height || img.width < 1 || img.height < 1) {
            throw new Error('Invalid image dimensions');
        }

        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));

        // If no scaling needed, return original
        if (scale >= 0.95) {
            return file;
        }

        const newWidth = Math.round(img.width * scale);
        const newHeight = Math.round(img.height * scale);

        // Validate calculated dimensions
        if (newWidth < 1 || newHeight < 1) {
            throw new Error('Calculated dimensions too small');
        }

        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext('2d');

        // ✅ IMPROVED: Better canvas rendering settings to prevent artifacts
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas to prevent artifacts
        ctx.clearRect(0, 0, newWidth, newHeight);

        // Draw image with precise dimensions
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // ✅ IMPROVED: Higher quality JPEG to reduce compression artifacts
        const blob = await canvas.convertToBlob({
            type: 'image/jpeg',
            quality: 0.92  // Higher quality to prevent horizontal line artifacts
        });

        // Validate output
        if (!blob || blob.size === 0) {
            throw new Error('Canvas conversion failed');
        }

        return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: blob.type });
    }

    async getSectionOrder(pageKey) {
        const r = await fetch(`${API_ROOT}?operation=get-order&page=${pageKey}`);
        if (!r.ok) throw new Error('Failed to load section order');
        return r.json();
    }

    async setSectionOrder(pageKey, order) {
        const r = await fetch(`${API_ROOT}?operation=set-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPage: pageKey, order })
        });
        if (!r.ok) throw new Error('Failed to set order');
        return r.json();
    }
}

export const apiService = new ApiService();
