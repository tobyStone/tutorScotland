/**
 * @fileoverview Editor state management for visual editor
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Editor state management system:
 * - Tracks edit mode status and active editor
 * - Manages current page context
 * - Provides event system for state changes
 * - Handles editor lifecycle management
 *
 * @exports EditorState - Main state management class
 * @performance Implements efficient state tracking and event handling
 */

/**
 * Editor state management class
 * @class EditorState
 * @description Manages the state of the visual editor including edit mode and active editor tracking
 */
export class EditorState {
    constructor() {
        this._isEditMode = false;
        this._activeEditor = null;
        this.currentPage = (location.pathname.replace(/^\//, '') || 'index').replace(/\.html?$/i, '');
        this._events = new Map();
    }

    get isEditMode() { return this._isEditMode; }
    get activeEditor() { return this._activeEditor; }

    on(name, handler) {
        if (!this._events.has(name)) this._events.set(name, []);
        this._events.get(name).push(handler);
    }

    emit(name, data) {
        if (this._events.has(name)) {
            for (const fn of this._events.get(name)) fn(data);
        }
    }

    setEditMode(val) {
        if (this._isEditMode === val) return;
        this._isEditMode = val;
        this.emit('editModeChange', val);
    }

    toggleEditMode() {
        this.setEditMode(!this._isEditMode);
    }

    setActiveEditor(obj) {
        this._activeEditor = obj;
        this.emit('activeEditorChange', obj);
    }

    validate() {
        if (!this._activeEditor) return false;
        if (!this._activeEditor.element || !this._activeEditor.element.isConnected) {
            this.setActiveEditor(null);
            return false;
        }
        return true;
    }
}

export const editorState = new EditorState();
