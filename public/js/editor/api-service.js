const API_ROOT = '/api/content-manager';

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

    uploadImage(formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload-image', true);
            xhr.upload.onprogress = e => {
                if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
            };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
                ? resolve(JSON.parse(xhr.responseText))
                : reject(new Error('Upload failed'));
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
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
