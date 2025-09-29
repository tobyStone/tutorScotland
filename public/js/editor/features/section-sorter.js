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

        // Define sections that should never be moved (pinned to their positions)
        this.pinnedSections = {
            'index': ['landing'], // Landing section must always be first on index page
            // Add other pages and their pinned sections as needed
        };
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

    /**
     * Get pinned sections for the current page
     * @returns {Array} Array of pinned section IDs
     */
    getPinnedSections() {
        return this.pinnedSections[editorState.currentPage] || [];
    }

    /**
     * Check if a section is pinned (cannot be moved)
     * @param {string} sectionId - Section ID to check
     * @returns {boolean} True if section is pinned
     */
    isPinned(sectionId) {
        return this.getPinnedSections().includes(sectionId);
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
        const allSections = Array.from(document.querySelectorAll('main > [data-ve-section-id]'));
        const pinnedSections = this.getPinnedSections();

        // Add visual indicators for pinned sections
        allSections.forEach(sec => {
            const sectionId = sec.dataset.veSectionId;
            if (pinnedSections.includes(sectionId)) {
                sec.classList.add('ve-pinned-section');
                console.log(`📌 Section "${sectionId}" is pinned and cannot be reordered`);
            }
        });

        // Filter out pinned sections - they cannot be reordered
        this.sections = allSections.filter(sec => {
            const sectionId = sec.dataset.veSectionId;
            return !pinnedSections.includes(sectionId);
        });

        console.log(`🔄 Activating drag-and-drop for ${this.sections.length} reorderable sections`);
        this.sections.forEach(sec => sec.classList.add('ve-reorderable'));
        this.addHandles();
        this.enableDrag();
    }

    deactivate() {
        if (this.sortable) { this.sortable.destroy(); this.sortable = null; }
        document.querySelectorAll('.ve-drag-handle').forEach(h => h.remove());
        this.sections.forEach(sec => sec.classList.remove('ve-reorderable'));

        // Clean up pinned section styling
        document.querySelectorAll('.ve-pinned-section').forEach(sec => {
            sec.classList.remove('ve-pinned-section');
        });

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
