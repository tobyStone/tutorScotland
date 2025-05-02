export async function uploadImage(file, folder = 'blog') {
    const fd = new FormData();
    fd.append('file', file);          // name MUST be "file"
    fd.append('folder', folder);
    const r = await fetch('/api/upload-image', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('Upload failed');
    const { url } = await r.json();
    return url;
}
