class EditorState {
    constructor() {
        this.listeners = {};
        this.isEditMode = false;
        this.currentPage = location.pathname;
        this.activeEditor = null;
    }
    on(event, callback) {
        (this.listeners[event] = this.listeners[event] || []).push(callback);
    }
    emit(event, data) {
        (this.listeners[event] || []).forEach(cb => cb(data));
    }
    setActiveEditor(editor) {
        this.activeEditor = editor;
        this.emit('activeEditorChanged', editor);
    }
    validate() {
        return !!this.activeEditor;
    }
}

export const editorState = new EditorState();
