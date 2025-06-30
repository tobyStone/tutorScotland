import { apiService } from './api-service.js';
import { editorState } from './editor-state.js';

const BUTTON_CSS = 'button aurora';

export class OverrideEngine {
    constructor() {
        this.overrides = new Map();
    }

    async load() {
        try {
            const data = await apiService.loadOverrides(editorState.currentPage);
            data.forEach(ov => this.overrides.set(ov.targetSelector, ov));
        } catch (e) {
            console.error('[VE] failed to load overrides', e);
        }
    }

    applyAll() {
        for (const [selector, ov] of this.overrides.entries()) {
            try {
                document.querySelectorAll(selector).forEach(el => this.applyOverride(el, ov));
            } catch {}
        }
    }

    applyOverride(element, override) {
        if (!element) return;
        switch(override.contentType){
            case 'text': element.textContent = override.text; break;
            case 'html': element.innerHTML = override.text; break;
            case 'image': {
                const img = element.tagName==='IMG'? element : element.querySelector('img');
                if (img) { img.src = override.image; if(override.text) img.alt = override.text; }
                break; }
            case 'link': {
                const a = element.tagName==='A'? element : element.querySelector('a');
                if (a) {
                    a.href = override.image;
                    a.textContent = override.text;
                    a.classList.toggle(BUTTON_CSS.split(/\s+/)[0], !!override.isButton);
                }
                break; }
        }
    }

    getElementType(el){
        const t = el.tagName.toLowerCase();
        if (t==='img') return 'image';
        if (t==='a') return 'link';
        if(['h1','h2','h3','h4','h5','h6'].includes(t)) return 'text';
        if (t==='p' || t==='div' || t==='span') return el.innerHTML.includes('<')? 'html':'text';
        return 'text';
    }

    getStableSelector(el, type){
        const attr = type==='link'? 'veButtonId':'veBlockId';
        const dataAttr = type==='link'? 'data-ve-button-id':'data-ve-block-id';
        if (!el.dataset[attr]) el.dataset[attr] = crypto.randomUUID();
        const section = el.closest('[data-ve-section-id]');
        const idSel = `[${dataAttr}="${el.dataset[attr]}"]`;
        return section ? `[data-ve-section-id="${section.dataset.veSectionId}"] ${idSel}` : idSel;
    }

    findOverrideForElement(el){
        for(const ov of this.overrides.values()){
            try{ if(document.querySelector(ov.targetSelector)===el) return ov; }catch{}
        }
        return null;
    }

    async save(formData){
        if (!editorState.validate()) return {success:false};
        const { element, type, original } = editorState.activeEditor;
        let existing = this.findOverrideForElement(element);
        const selector = this.getStableSelector(element, type);
        const payload = { _id: existing?._id, targetPage: editorState.currentPage, targetSelector: selector, contentType:type, ...formData, originalContent: original };
        try {
            const saved = await apiService.saveOverride(payload);
            if (existing && existing.targetSelector !== selector) this.overrides.delete(existing.targetSelector);
            this.overrides.set(selector, saved);
            this.applyOverride(element, saved);
            return {success:true};
        } catch(e){
            console.error('save error',e); return {success:false};
        }
    }

    async restore(){
        if (!editorState.validate()) return;
        const { element, selector, type, original } = editorState.activeEditor;
        const ov = this.overrides.get(selector);
        if (ov && ov._id){
            try{
                await apiService.deleteOverride(ov._id);
                this.overrides.delete(selector);
                return {success:true, reload:true};
            }catch(e){
                console.error('restore fail',e); return {success:false};
            }
        } else {
            this.restoreElementContent(element,type,original);
            return {success:true, reload:false};
        }
    }

    restoreElementContent(el,type,original){
        if(!original) return;
        switch(type){
            case 'text': el.textContent = original; break;
            case 'html': el.innerHTML = original; break;
            case 'image': if(el.tagName==='IMG'){ el.src = original.src; el.alt = original.alt; } break;
            case 'link': if(el.tagName==='A'){ el.href = original.href; el.textContent = original.text; } break;
        }
    }

    getOriginalContent(el,type){
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.edit-overlay').forEach(n=>n.remove());
        switch(type){
            case 'text': return clone.textContent.trim();
            case 'html': return clone.innerHTML.trim();
            case 'image': return { src: el.src, alt: el.alt };
            case 'link': return { href: el.dataset.originalHref || el.href, text: clone.textContent.trim() };
        }
    }
}

export const overrideEngine = new OverrideEngine();
