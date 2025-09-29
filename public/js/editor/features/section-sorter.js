/**
 * @fileoverview Section sorting functionality for visual editor
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Section reordering system:
 * - Drag-and-drop section reordering
 * - Visual feedback during sorting
 * - Persistent order storage
 * - Integration with visual editor
 *
 * @requires ../api-service.js for API communication
 * @requires ../editor-state.js for state management
 * @performance Implements efficient drag-and-drop with visual feedback
 */

import { apiService } from '../api-service.js';
import { editorState } from '../editor-state.js';

/**
 * Section sorting and reordering class
 * @class SectionSorter
 * @description Provides drag-and-drop functionality for reordering sections
 */
export class SectionSorter {
    constructor() {
        this.sortable = null;
        this.sectionOrder = [];
        this.sections = [];
    }

    async init() {
        try {
            const data = await apiService.getSectionOrder(editorState.currentPage);
            this.sectionOrder = data.order || [];
            this.applyOrder();
        } catch (e) {
            console.error('Failed to load section order', e);
        }
    }

    applyOrder() {
        if (!this.sectionOrder.length) return;
        const parent = document.querySelector('main');
        if (!parent) return;
        const lookup = new Map(Array.from(parent.querySelectorAll('main > [data-ve-section-id]')).map(sec => [sec.dataset.veSectionId, sec]));
        this.sectionOrder.forEach(id => {
            if (lookup.has(id)) parent.appendChild(lookup.get(id));
        });
    }

    activate() {
        this.sections = Array.from(document.querySelectorAll('main > [data-ve-section-id]'));
        this.sections.forEach(sec => sec.classList.add('ve-reorderable'));
        this.addHandles();
        this.enableDrag();
    }

    deactivate() {
        if (this.sortable) { this.sortable.destroy(); this.sortable = null; }
        document.querySelectorAll('.ve-drag-handle').forEach(h => h.remove());
        this.sections.forEach(sec => sec.classList.remove('ve-reorderable'));
        this.sections = [];
    }

    addHandles() {
        this.sections.forEach(section => {
            if (section.querySelector('.ve-drag-handle')) return;
            const handle = document.createElement('div');
            handle.className = 've-drag-handle';
            handle.textContent = '⇅';
            if (getComputedStyle(section).position === 'static') section.style.position = 'relative';
            section.prepend(handle);
        });
    }

    async enableDrag() {
        if (!window.Sortable) {
            const mod = await import('https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/+esm');
            window.Sortable = mod.Sortable || mod.default;
        }
        const container = document.querySelector('main');
        this.sortable = window.Sortable.create(container, {
            handle: '.ve-drag-handle',
            draggable: '.ve-reorderable',
            onEnd: () => this.persistOrder()
        });
    }

    async persistOrder() {
        const order = Array.from(document.querySelectorAll('main > .ve-reorderable')).map(el => el.dataset.veSectionId);
        console.log('🔄 Persisting section order:', {
            page: editorState.currentPage,
            order: order,
            orderLength: order.length
        });

        try {
            console.log('🔄 Calling apiService.setSectionOrder...');
            await apiService.setSectionOrder(editorState.currentPage, order);
            this.sectionOrder = order;
            console.log('✅ Section order saved successfully');
        } catch (e) {
            console.error('❌ Failed to save section order:', e);
            console.error('❌ Error details:', {
                message: e.message,
                stack: e.stack
            });
        }
    }
}

export const sectionSorter = new SectionSorter();
