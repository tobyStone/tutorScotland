# 🎨 Visual Editor v2.0 Architecture

**Comprehensive architectural documentation for the Visual Editor system**

[![Visual Editor](https://img.shields.io/badge/Visual%20Editor-v2.0-purple.svg)](../VISUAL_EDITOR_PERSISTENCE_SOLUTION.md)
[![Persistence](https://img.shields.io/badge/Persistence-Cross%20Browser-green.svg)](#content-override-system)

## 🎯 System Overview

The Visual Editor v2.0 is an advanced in-place content editing system that allows administrators to edit website content directly on the live pages. It features persistent edits across browsers and devices, real-time preview capabilities, and comprehensive content management.

### Key Features
- **Live In-Place Editing**: Edit content directly on the webpage
- **Cross-Browser Persistence**: Edits persist across all browsers and devices
- **Real-Time Preview**: See changes immediately with restore capability
- **Image Management**: Upload, replace, and optimize images
- **Section Reordering**: Drag-and-drop section management
- **Block ID System**: Stable element identification for consistent editing

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Visual Editor v2.0                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ UI Manager  │  │ Override    │  │ API Service │        │
│  │             │  │ Engine      │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Editor      │  │ Section     │  │ Image       │        │
│  │ State       │  │ Sorter      │  │ Manager     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Content Override System                     │
├─────────────────────────────────────────────────────────────┤
│  • Block ID Generation & Management                        │
│  • Selector Stability & Persistence                        │
│  • Cross-Browser Synchronization                           │
│  • Real-Time Preview & Restore                             │
└─────────────────────────────────────────────────────────────┘
```

## 🧩 Core Components

### 1. Visual Editor Main Class
**File**: `public/js/visual-editor-v2.js`

```javascript
class VisualEditor {
    constructor() {
        this.uiManager = new UIManager({
            onToggle: this.toggleEditMode.bind(this),
            onEdit: this.handleEditClick.bind(this),
            onSave: this.handleSave.bind(this),
            onPreview: this.handlePreview.bind(this)
        });
        this.overrideEngine = new OverrideEngine();
        this.apiService = new APIService();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }
}
```

**Responsibilities**:
- Coordinate all editor components
- Handle user interactions and events
- Manage edit mode state transitions
- Integrate with authentication system

### 2. UI Manager
**File**: `public/js/editor/ui-manager.js`

```javascript
class UIManager {
    scanEditableElements() {
        // Find all elements with data-ve-block-id
        return document.querySelectorAll('[data-ve-block-id]');
    }
    
    addOverlays(elements) {
        // Add visual editing overlays to elements
        elements.forEach(element => this.createOverlay(element));
    }
    
    refreshEditableElements() {
        // Rescan and update overlays after dynamic content changes
        this.removeAllOverlays();
        const elements = this.scanEditableElements();
        this.addOverlays(elements);
    }
}
```

**Responsibilities**:
- Scan for editable elements
- Create and manage visual overlays
- Handle overlay interactions
- Manage edit mode UI state

### 3. Override Engine
**File**: `public/js/editor/override-engine.js`

```javascript
class OverrideEngine {
    async applyOverrides() {
        const overrides = await this.loadOverrides();
        for (const [selector, content] of overrides) {
            await this.applyOverride(selector, content);
        }
    }
    
    generateStableSelector(element) {
        // Generate consistent selector using block IDs
        const blockId = element.getAttribute('data-ve-block-id');
        const sectionId = element.closest('[data-ve-section-id]')
                                ?.getAttribute('data-ve-section-id');
        return `[data-ve-section-id="${sectionId}"] [data-ve-block-id="${blockId}"]`;
    }
}
```

**Responsibilities**:
- Load and apply content overrides
- Generate stable element selectors
- Handle override persistence
- Manage preview and restore functionality

### 4. API Service
**File**: `public/js/editor/api-service.js`

```javascript
class APIService {
    async saveOverride(selector, content, type) {
        const response = await fetch('/api/content-manager', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operation: 'save',
                selector,
                content,
                type
            })
        });
        return response.json();
    }
}
```

**Responsibilities**:
- Handle API communication
- Manage authentication headers
- Process API responses
- Handle error conditions

## 🔧 Block ID System

### Purpose
The Block ID system provides stable, unique identifiers for editable elements, ensuring consistent targeting across browser sessions and dynamic content updates.

### Implementation

#### 1. Block ID Generation
```javascript
function generateBlockId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
```

#### 2. Block ID Assignment
**Static Content**: Build-time injection via `bin/inject-ve-block-ids.js`
**Dynamic Content**: Runtime assignment in `dynamic-sections.js`

#### 3. Database Storage
```javascript
// Section Schema with Block IDs
const sectionSchema = new mongoose.Schema({
    // ... other fields
    headingBlockId: { type: String, default: '' },
    contentBlockId: { type: String, default: '' },
    imageBlockId: { type: String, default: '' },
    buttonBlockId: { type: String, default: '' }
});
```

### Block ID Flow
```
Database → API Response → Dynamic Rendering → DOM Elements → Selector Generation
    ↓           ↓              ↓                ↓               ↓
Section.headingBlockId → data-ve-block-id → Stable Selector → Override Match ✅
```

## 🔄 Content Override System

### Override Lifecycle

#### 1. Edit Initiation
```javascript
// User clicks edit overlay
handleEditClick(element) {
    const selector = this.overrideEngine.generateStableSelector(element);
    const currentContent = element.textContent || element.innerHTML;
    this.showEditDialog(selector, currentContent);
}
```

#### 2. Content Modification
```javascript
// User modifies content in edit dialog
handleSave(selector, newContent, type) {
    // Save to database via API
    await this.apiService.saveOverride(selector, newContent, type);
    
    // Apply immediately for preview
    this.overrideEngine.applyOverride(selector, newContent);
    
    // Update UI state
    this.uiManager.updateOverlayState(selector, 'saved');
}
```

#### 3. Persistence & Synchronization
```javascript
// On page load, apply all saved overrides
window.addEventListener('load', async () => {
    await visualEditor.overrideEngine.applyOverrides();
    visualEditor.uiManager.refreshEditableElements();
});
```

### Override Storage Format
```javascript
// Database storage format
{
    selector: "[data-ve-section-id='about'] [data-ve-block-id='uuid-here']",
    content: "Updated content text",
    type: "text|html|image",
    timestamp: "2024-12-09T10:30:00Z",
    userId: "admin-user-id"
}
```

## 🖼️ Image Management System

### Image Upload Flow
```javascript
// Image upload and replacement
async handleImageUpload(element, file) {
    // 1. Validate file
    if (!this.validateImageFile(file)) {
        throw new Error('Invalid image file');
    }
    
    // 2. Upload to storage
    const uploadResult = await this.apiService.uploadImage(file);
    
    // 3. Update element
    element.src = uploadResult.url;
    
    // 4. Save override
    const selector = this.overrideEngine.generateStableSelector(element);
    await this.apiService.saveOverride(selector, uploadResult.url, 'image');
}
```

### Image Processing Pipeline
```
File Selection → Validation → Upload → Processing → Storage → URL Generation → DOM Update
```

**Validation Steps**:
- File type validation (MIME + signature)
- Size limits (4MB for images)
- Dimension validation (max 2000px)
- Format optimization (WebP conversion)

## 🎯 Section Reordering System

### Drag-and-Drop Implementation
**File**: `public/js/editor/features/section-sorter.js`

```javascript
class SectionSorter {
    activate() {
        const sections = document.querySelectorAll('[data-ve-section-id]');
        sections.forEach(section => {
            section.draggable = true;
            section.addEventListener('dragstart', this.handleDragStart.bind(this));
            section.addEventListener('dragover', this.handleDragOver.bind(this));
            section.addEventListener('drop', this.handleDrop.bind(this));
        });
    }
    
    async handleDrop(event) {
        // Update section order in database
        const newOrder = this.calculateNewOrder(draggedElement, dropTarget);
        await this.apiService.updateSectionOrder(sectionId, newOrder);
        
        // Update DOM immediately
        this.reorderSections(newOrder);
    }
}
```

### Order Management
```javascript
// Order calculation and persistence
calculateNewOrder(draggedSection, targetSection) {
    const sections = Array.from(document.querySelectorAll('[data-ve-section-id]'));
    const draggedIndex = sections.indexOf(draggedSection);
    const targetIndex = sections.indexOf(targetSection);
    
    // Calculate new order values
    return this.generateOrderSequence(draggedIndex, targetIndex);
}
```

## 🔐 Security Integration

### Authentication Requirements
```javascript
// All editing operations require admin authentication
async checkEditPermissions() {
    const response = await fetch('/api/protected', {
        credentials: 'include'
    });
    
    if (!response.ok) {
        throw new Error('Authentication required');
    }
    
    const user = await response.json();
    if (user.role !== 'admin') {
        throw new Error('Admin access required');
    }
    
    return user;
}
```

### Content Sanitization
```javascript
// Sanitize content before saving
sanitizeContent(content, type) {
    if (type === 'html') {
        // Allow safe HTML tags only
        return DOMPurify.sanitize(content, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
            ALLOWED_ATTR: ['href', 'target']
        });
    }
    
    // For text content, escape HTML
    return this.escapeHtml(content);
}
```

## 🧪 Testing Strategy

### Unit Tests
- **Component Testing**: Individual editor components
- **Block ID System**: Stable selector generation
- **Override Engine**: Content persistence logic
- **API Service**: Communication layer testing

### Integration Tests
- **End-to-End Editing**: Complete editing workflows
- **Cross-Browser Persistence**: Override synchronization
- **Image Upload**: File handling and processing
- **Section Reordering**: Drag-and-drop functionality

### Visual Regression Tests
- **UI Consistency**: Overlay positioning and styling
- **Cross-Browser Rendering**: Visual consistency across browsers
- **Responsive Behavior**: Mobile and desktop editing experience

## 📊 Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Load editor components only when needed
- **Event Delegation**: Efficient event handling for dynamic content
- **Debounced Saves**: Prevent excessive API calls during editing
- **Cached Selectors**: Reuse generated selectors for performance

### Memory Management
- **Cleanup on Mode Exit**: Remove event listeners and overlays
- **Garbage Collection**: Clear references to prevent memory leaks
- **Efficient DOM Queries**: Minimize DOM traversal operations

---

**The Visual Editor v2.0 provides a powerful, secure, and user-friendly content management experience while maintaining the integrity and performance of the TutorScotland platform.**
