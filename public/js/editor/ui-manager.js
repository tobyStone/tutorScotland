import { editorState } from './editor-state.js';
import { ImageBrowser } from './features/image-browser.js';

const BUTTON_CSS = 'button aurora';

export class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.editableElements = [];
        this.dom = {};
        this.imageBrowser = new ImageBrowser({ onSelect: item => this.handleImageSelect(item) });
        editorState.on('editModeChange', m => this.onEditModeChange(m));
        editorState.on('activeEditorChange', ed => this.onActiveEditorChange(ed));
    }

    initialize() {
        this.loadStyles();
        this.createToggle();
        this.createModal();
    }

    loadStyles() {
        if (!document.getElementById('ve-style')) {
            const link = document.createElement('link');
            link.id = 've-style';
            link.rel = 'stylesheet';
            link.href = '/editor.css';
            document.head.appendChild(link);
        }
    }

    createToggle() {
        const btn = document.createElement('button');
        btn.id = 'edit-mode-toggle';
        btn.className = BUTTON_CSS;
        btn.textContent = 'Edit Mode';
        btn.addEventListener('click', () => this.callbacks.onToggle());
        document.body.appendChild(btn);
    }

    createModal() {
        const tpl = document.getElementById('ve-editor-modal-template');
        if (!tpl) { console.error('[VE] modal template missing'); return; }
        const frag = tpl.content.cloneNode(true);
        document.body.appendChild(frag);
        this.dom.modal = document.getElementById('editor-modal');
        this.dom.imageBrowser = this.dom.modal.querySelector('#image-browser');
        this.dom.modal.querySelector('#close-modal').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
        this.dom.modal.querySelector('#save-btn').addEventListener('click', () => this.callbacks.onSave(this.getFormData()));
        this.dom.modal.querySelector('#preview-btn').addEventListener('click', () => this.callbacks.onPreview(this.getFormData()));
        this.dom.modal.querySelector('#restore-btn').addEventListener('click', () => this.callbacks.onRestore());
        this.dom.modal.querySelector('#upload-btn').addEventListener('click', () => this.callbacks.onUpload());
        this.dom.modal.querySelector('#browse-btn').addEventListener('click', () => this.imageBrowser.open(this.dom.imageBrowser));
    }

    onEditModeChange(val) {
        document.body.classList.toggle('ve-edit-active', val);
        const btn = document.getElementById('edit-mode-toggle');
        if (btn) btn.textContent = val ? 'Exit Edit' : 'Edit Mode';

        if (val) {
            // When entering edit mode, scan for elements and add overlays.
            this.addOverlays(this.scanEditableElements());
            this.disableLinks();
        } else {
            // When exiting, remove all UI.
            this.removeOverlays();
            this.enableLinks();
        }
    }

    onActiveEditorChange(ed) {
        if (ed) this.openModal(ed); else this.closeModal();
    }

    // ✅ FIX #2 & #3: This is the critical fix for making buttons and images editable.
    scanEditableElements() {
        const elements = new Set();
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p:not(.no-edit)',
            '.editable',
            'img:not(.no-edit)',
            `a.${BUTTON_CSS.split(' ')[0]}`
        ];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.closest('.ve-no-edit, #editor-modal, #edit-mode-toggle')) return;
                elements.add(el);
            });
        });
        return Array.from(elements);
    }

    addOverlays(elements) {
        elements.forEach(el => {
            const type = this.callbacks.getType(el);
            if (el.querySelector(':scope > .edit-overlay')) return;
            const overlay = document.createElement('div');
            overlay.className = 'edit-overlay';
            overlay.innerHTML = `<div class="edit-controls"><button class="edit-btn">✏️ Edit</button></div>`;
            overlay.querySelector('.edit-btn').addEventListener('click', e => {
                e.stopPropagation();
                this.callbacks.onEdit(el);
            });
            if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative';
            }
            el.appendChild(overlay);
        });
    }

    removeOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(o => o.remove());
    }

    disableLinks() {
        document.querySelectorAll('a').forEach(a => {
            if (a.closest('.ve-no-edit,#editor-modal,#edit-mode-toggle,.main-nav')) return;
            a.dataset.originalHref = a.href;
            a.href = 'javascript:void(0)';
        });
    }

    enableLinks() {
        document.querySelectorAll('a[data-original-href]').forEach(a => {
            a.href = a.dataset.originalHref;
            a.removeAttribute('data-original-href');
        });
    }

    openModal(ed) {
        const { element, type, canRestore } = ed;
        this.dom.modal.querySelector('#modal-title').textContent = `Edit ${type}`;
        this.dom.modal.querySelector('#content-type').value = type;
        ['text','html','image','link'].forEach(id => {
            const g = this.dom.modal.querySelector(`#${id}-group`);
            if (g) g.style.display = id===type? 'block':'none';
        });
        this.fillForm(element, type);
        this.dom.modal.querySelector('#restore-btn').disabled = !canRestore;
        this.dom.modal.style.display = 'block';
    }

    fillForm(el,type) {
        const modal = this.dom.modal;
        switch(type){
            case 'text': modal.querySelector('#content-text').value = el.textContent.trim(); break;
            case 'html': modal.querySelector('#content-html').value = el.innerHTML.trim(); break;
            case 'image':
                modal.querySelector('#content-image').value = el.src;
                modal.querySelector('#image-alt').value = el.alt;
                break;
            case 'link':
                modal.querySelector('#link-url').value = el.dataset.originalHref || el.href;
                modal.querySelector('#link-text').value = el.textContent.trim();
                modal.querySelector('#link-is-button').checked = el.classList.contains(BUTTON_CSS.split(/\s+/)[0]);
                break;
        }
    }

    getFormData() {
        const type = this.dom.modal.querySelector('#content-type').value;
        switch(type){
            case 'text': return { text: this.dom.modal.querySelector('#content-text').value };
            case 'html': return { text: this.dom.modal.querySelector('#content-html').value };
            case 'image': return { image: this.dom.modal.querySelector('#content-image').value, text: this.dom.modal.querySelector('#image-alt').value };
            case 'link': return { image: this.dom.modal.querySelector('#link-url').value, text: this.dom.modal.querySelector('#link-text').value, isButton: this.dom.modal.querySelector('#link-is-button').checked };
            default: return {};
        }
    }

    closeModal() { if(this.dom.modal) this.dom.modal.style.display='none'; }

    handleImageSelect(item) {
        const modal = this.dom.modal;
        modal.querySelector('#content-image').value = item.url;
        const img = modal.querySelector('#image-preview img');
        img.src = item.thumb || item.url;
        modal.querySelector('#image-preview').style.display = 'block';
        if(!modal.querySelector('#image-alt').value) modal.querySelector('#image-alt').value = item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    }

    showNotification(msg,type='info') {
        const n=document.createElement('div');
        n.className=`ve-notification ve-${type}`;
        n.textContent=msg;
        document.body.appendChild(n);
        setTimeout(()=>n.remove(),3000);
    }
}
