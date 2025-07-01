// /public/js/upload-helper.js (client side)
export async function uploadImage(file, folder = 'content-images') {
    console.log('uploadImage called with:', { fileName: file.name, size: file.size, folder });

    /* hard stop at 4MB - matches server limit */
    const MAX = 4 * 1024 * 1024;          // 4MB
    if (file.size > MAX)
        throw new Error('Image is larger than 4MB - please resize it first');

    /* MIME type validation - matches server allow-list */
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Please use JPG, PNG, WebP or GIF');
    }

    // ✅ FIXED: Improved client-side resizing with better error handling
    // Only resize if file is very large to avoid canvas rendering artifacts
    if (file.size > 2.5 * 1024 * 1024) {     // larger than 2.5MB? shrink it
        console.log('Resizing large image...');
        try {
            const resizedFile = await resizeImage(file, 1280);  // 1280px long side
            // ✅ VALIDATION: Check if resized file is reasonable
            if (resizedFile && resizedFile.size > 0 && resizedFile.size < file.size) {
                file = resizedFile;
                console.log('Image resized successfully to size:', file.size);
            } else {
                console.warn('Resizing produced invalid result, using original file');
            }
        } catch (error) {
            console.warn('Client-side resizing failed, using original file:', error.message);
            // Continue with original file if resizing fails
        }
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);

    console.log('Uploading to /api/upload-image...');
    const r = await fetch('/api/upload-image', { method: 'POST', body: fd });

    if (!r.ok) {
        const errorText = await r.text();
        console.error('Upload failed:', r.status, errorText);
        throw new Error(`Upload failed: ${r.status} ${errorText}`);
    }

    const result = await r.json();
    console.log('Upload successful:', result.url);
    return result.url;
}

/* ✅ IMPROVED: More robust image resizing with better error handling */
async function resizeImage(file, maxSide = 1280) {
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
