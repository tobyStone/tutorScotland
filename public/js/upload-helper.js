// /public/js/upload-helper.js (client side)
export async function uploadImage(file, folder = 'misc') {
    /* hard stop at 4.5?MB – Vercel limit */
    const MAX = 4.5 * 1024 * 1024;          // 4.5 MB
    if (file.size > MAX)
        throw new Error('Image is larger than 4.5?MB – please resize it first');

    // OPTIONAL: auto?shrink big JPEG/PNG before upload
    // comment this block out if you don’t want automatic re?scale
    if (file.size > 1.5 * 1024 * 1024) {     // larger than 1.5 MB? shrink it
        file = await resizeImage(file, 1280);  // 1280 px long side
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);

    const r = await fetch('/api/upload-image', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(await r.text());
    const { url } = await r.json();
    return url;
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
