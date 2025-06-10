// /public/js/upload-helper.js (client side)
export async function uploadImage(file, folder = 'content-images') {
    console.log('uploadImage called with:', { fileName: file.name, size: file.size, folder });

    /* hard stop at 4.5MB - Vercel limit */
    const MAX = 4.5 * 1024 * 1024;          // 4.5MB
    if (file.size > MAX)
        throw new Error('Image is larger than 4.5MB - please resize it first');

    // OPTIONAL: auto-shrink big JPEG/PNG before upload
    // comment this block out if you don't want automatic re-scale
    if (file.size > 1.5 * 1024 * 1024) {     // larger than 1.5MB? shrink it
        console.log('Resizing large image...');
        file = await resizeImage(file, 1280);  // 1280px long side
        console.log('Image resized to:', file.size);
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);

    console.log('Uploading to /api/upload-image...');
    const r = await fetch('/api/upload-image', { method: 'POST', body: fd });

    if (!r.ok) {
        const errorText = await r.text();
        console.error('Upload failed:', r.status, errorText);
        throw new Error(`Upload failed: ${errorText}`);
    }

    const result = await r.json();
    console.log('Upload successful:', result.url);
    return result.url;
}

/* utility: shrink to JPEG 0.82 quality */
async function resizeImage(file, maxSide = 1280) {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));

    const canvas = new OffscreenCanvas(img.width * scale, img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: blob.type });
}
