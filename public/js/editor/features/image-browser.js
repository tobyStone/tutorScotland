import { apiService } from '../api-service.js';

const PLACEHOLDER_IMAGE_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='100%25' height='100%25' fill='%23e0e0e0'/%3E%3C/svg%3E";

function safeImg(img, originalUrl) {
    if (!img) return null;

    // Cascading fallback: thumbnail → original → placeholder
    img.onerror = function () {
        if (this.src !== originalUrl && originalUrl) {
            // First fallback: try original image
            this.src = originalUrl;
        } else {
            // Final fallback: placeholder
            this.src = PLACEHOLDER_IMAGE_URI;
        }
    };
    return img;
}

export class ImageBrowser {
    constructor({ onSelect }) {
        this.onSelect = onSelect;
        this.page = 1;
        this.totalPages = 1;
        this.search = '';
        this.sort = 'newest';
        this.container = null;
    }

    init() {
        console.log('[VE] ImageBrowser initializing...');
        // Initialize any required state or load initial data if needed
        // For now, this is just a placeholder for future initialization needs
    }

    open(container) {
        this.container = container;
        container.style.display = 'block';
        if (!container.dataset.ready) {
            const tpl = document.getElementById('ve-image-browser-template');
            if (tpl) container.appendChild(tpl.content.cloneNode(true));
            container.dataset.ready = '1';
            this.attachEvents();
        }
        this.loadImages();
    }

    close() {
        if (this.container) this.container.style.display = 'none';
    }

    attachEvents() {
        this.container.querySelector('#close-browser').addEventListener('click', () => this.close());
        this.container.querySelector('#image-search').addEventListener('input', e => {
            this.search = e.target.value;
            this.page = 1;
            this.loadImages();
        });
        this.container.querySelector('#image-sort').addEventListener('change', e => {
            this.sort = e.target.value || 'newest';
            this.page = 1;
            this.loadImages();
        });
        this.container.querySelector('#prev-page').addEventListener('click', () => {
            if (this.page > 1) { this.page--; this.loadImages(); }
        });
        this.container.querySelector('#next-page').addEventListener('click', () => {
            if (this.page < this.totalPages) { this.page++; this.loadImages(); }
        });
    }

    async loadImages() {
        const grid = this.container.querySelector('#image-grid');
        grid.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const data = await apiService.loadImages({ page: this.page, search: this.search, sort: this.sort });
            this.totalPages = data.totalPages;
            grid.innerHTML = '';
            data.images.forEach(item => {
                const div = document.createElement('div');
                div.className = 'image-item';

                // If no thumbnail exists, thumb already points to original
                const img = safeImg(document.createElement('img'), item.url);
                img.src = item.thumb;
                img.alt = item.name;

                // Add visual indicator for images without thumbnails
                if (!item.hasThumb) {
                    div.classList.add('no-thumbnail');
                    div.title = 'Original image (no thumbnail available)';
                }

                div.appendChild(img);
                div.addEventListener('click', () => {
                    if (this.onSelect) this.onSelect(item);
                    this.close();
                });
                grid.appendChild(div);
            });
            this.updatePagination();
        } catch (err) {
            console.error('Error loading images', err);
            grid.innerHTML = '<div class="error-message">Failed to load images</div>';
        }
    }

    updatePagination() {
        this.container.querySelector('#prev-page').disabled = this.page <= 1;
        this.container.querySelector('#next-page').disabled = this.page >= this.totalPages;
        this.container.querySelector('#page-info').textContent = `Page ${this.page}`;
    }
}
