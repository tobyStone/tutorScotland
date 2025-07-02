import { editorState } from './editor-state.js';
import { ImageBrowser } from './features/image-browser.js';

const BUTTON_CSS = 'button aurora';

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function ensureBlockIds(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  ['p', 'img', 'a', 'h1','h2','h3','h4','h5','h6'].forEach(tag => {
    tmp.querySelectorAll(tag).forEach(el => {
      if (!el.hasAttribute('data-ve-block-id')) {
        el.setAttribute('data-ve-block-id', uuidv4());
      }
    });
  });
  return tmp.innerHTML;
}

export class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.editableElements = [];
        this.dom = {};
        this.imageBrowser = new ImageBrowser({ onSelect: item => this.handleImageSelect(item) });
        editorState.on('editModeChange', m => this.onEditModeChange(m));
        editorState.on('activeEditorChange', ed => this.onActiveEditorChange(ed));
    }

    init() {
        console.log('[VE] UIManager initializing...');
        // Initialize image browser if it has an init method
        if (this.imageBrowser && typeof this.imageBrowser.init === 'function') {
            this.imageBrowser.init();
        }
        this.initialize(); // ✅ FIX: Call initialize to create toggle button and modal
        this.refreshEditableElements();
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
        console.log(`[VE] onEditModeChange called with val: ${val}`);
        document.body.classList.toggle('ve-edit-active', val);
        const btn = document.getElementById('edit-mode-toggle');
        if (btn) btn.textContent = val ? 'Exit Edit' : 'Edit Mode';

        if (val) {
            // When entering edit mode, scan for elements and add overlays.
            const elements = this.scanEditableElements();
            console.log(`[VE] Found ${elements.length} editable elements:`, elements);
            this.addOverlays(elements);
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

    // This function MUST find all editable types.
    scanEditableElements() {
        const elements = new Set();
        const selectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p:not(.no-edit)',
            '.editable',
            'img:not(.no-edit)',
            `a.${BUTTON_CSS.replace(/\s/g, '.')}`
        ];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.closest('.ve-no-edit, #editor-modal, #edit-mode-toggle, .main-nav')) return;
                elements.add(el);
            });
        });
        return Array.from(elements);
    }

    // ✅ NEW: Refresh editable elements after dynamic content changes
    refreshEditableElements() {
        if (!editorState.isEditMode) return;

        console.log('[VE] Refreshing editable elements after dynamic content change...');

        // Remove existing overlays
        this.removeOverlays();

        // Rescan and add overlays to new elements
        const elements = this.scanEditableElements();
        this.addOverlays(elements);

        console.log(`[VE] Refreshed ${elements.length} editable elements.`);
    }

    addOverlays(elements) {
        console.log(`[VE] addOverlays called with ${elements.length} elements`);
        elements.forEach((el, index) => {
            const type = this.callbacks.getType(el);
            console.log(`[VE] Element ${index}: type=${type}, tagName=${el.tagName}, element:`, el);
            const target = this.getOverlayMount(el, type);
            if (target.querySelector(':scope > .edit-overlay')) {
                console.log(`[VE] Element ${index}: already has overlay, skipping`);
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'edit-overlay';
            overlay.innerHTML = `<div class="edit-controls"><button class="edit-btn">✏️ Edit</button></div>`;
            overlay.querySelector('.edit-btn').addEventListener('click', e => {
                e.stopPropagation();
                this.callbacks.onEdit(el);
            });

            if (getComputedStyle(target).position === 'static') {
                target.style.position = 'relative';
            }
            target.appendChild(overlay);
            console.log(`[VE] Element ${index}: overlay added to target:`, target);
        });
    }

    getOverlayMount(element, type) {
        if (type === 'image') {
            if (!element.parentElement?.classList.contains('ve-img-wrap')) {
                const wrap = document.createElement('span');
                wrap.className = 've-img-wrap';
                element.parentNode.insertBefore(wrap, element);
                wrap.appendChild(element);
            }
            return element.parentElement;
        }
        return element;
    }

    removeOverlays() {
        document.querySelectorAll('.edit-overlay').forEach(o => o.remove());
        document.querySelectorAll('.ve-img-wrap').forEach(w => {
            if (w.parentNode) w.replaceWith(...w.childNodes);
        });
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

    fillForm(el, type) {
        const modal = this.dom.modal;
        const content = this.callbacks.getOriginalContent(el, type);

        switch (type) {
            case 'text':
                modal.querySelector('#content-text').value = content;
                break;
            case 'html':
                modal.querySelector('#content-html').value = content;
                break;
            case 'image':
                modal.querySelector('#content-image').value = content.src;
                modal.querySelector('#image-alt').value = content.alt;
                break;
            case 'link':
                modal.querySelector('#link-url').value = content.href;
                modal.querySelector('#link-text').value = content.text;
                modal.querySelector('#link-is-button').checked = el.classList.contains(BUTTON_CSS.split(/\s+/)[0]);
                break;
        }
    }

    getFormData() {
        const type = this.dom.modal.querySelector('#content-type').value;
        switch(type){
            case 'text':
                return { text: this.dom.modal.querySelector('#content-text').value };
            case 'html':
                return { text: ensureBlockIds(this.dom.modal.querySelector('#content-html').value) };
            case 'image':
                return { image: this.dom.modal.querySelector('#content-image').value, text: this.dom.modal.querySelector('#image-alt').value };
            case 'link':
                return { image: this.dom.modal.querySelector('#link-url').value, text: this.dom.modal.querySelector('#link-text').value, isButton: this.dom.modal.querySelector('#link-is-button').checked };
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
