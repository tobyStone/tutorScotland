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
