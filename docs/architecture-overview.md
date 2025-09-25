# 🏗️ TutorScotland Architecture Overview

**Comprehensive architectural documentation for the Tutors Alliance Scotland platform**

[![Architecture](https://img.shields.io/badge/Architecture-Serverless-blue.svg)](https://vercel.com/)
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-green.svg)](security-enhancements-implemented.md)
[![Visual Editor](https://img.shields.io/badge/Visual%20Editor-v2.0-purple.svg)](../VISUAL_EDITOR_PERSISTENCE_SOLUTION.md)

## 🎯 System Overview

TutorScotland is a modern, serverless web application built to connect disadvantaged Scottish children with affordable tutoring services. The platform features enterprise-grade security, advanced content management, and comprehensive testing frameworks.

### Core Principles
- **Security First**: Enterprise-grade security suitable for protecting children's data
- **Performance**: Optimized for speed and scalability
- **Accessibility**: WCAG compliant and mobile-first design
- **Maintainability**: Clean, modular architecture with comprehensive testing

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Client)                        │
├─────────────────────────────────────────────────────────────┤
│  • Static HTML/CSS/JS                                      │
│  • Visual Editor v2.0                                      │
│  • Dynamic Sections System                                 │
│  • Progressive Enhancement                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 API Layer (Vercel Functions)               │
├─────────────────────────────────────────────────────────────┤
│  • Authentication & Authorization                          │
│  • Content Management APIs                                 │
│  • File Upload & Processing                                │
│  • Security Middleware                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│  • MongoDB (Primary Database)                              │
│  • Vercel Blob (File Storage)                             │
│  • Google Cloud Storage (Large Files)                      │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Frontend Architecture

### Technology Stack
- **Core**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling**: CSS Grid, Flexbox, Custom Properties
- **Enhancement**: Progressive Enhancement approach
- **Build**: No build step required, direct deployment

### Key Components

#### 1. Visual Editor v2.0
**Location**: `public/js/visual-editor-v2.js`

```javascript
// Core Visual Editor Architecture
class VisualEditor {
    constructor() {
        this.uiManager = new UIManager();
        this.overrideEngine = new OverrideEngine();
        this.apiService = new APIService();
        this.sectionSorter = new SectionSorter();
    }
}
```

**Features**:
- Live in-place content editing
- Content override management with persistence
- Image upload and replacement
- Section reordering with drag-and-drop
- Real-time preview and restore functionality

#### 2. Dynamic Sections System
**Location**: `public/js/dynamic-sections.js`

**Section Types**:
- **Standard**: Text content with optional images
- **Team Members**: Staff profiles with photos and bios
- **Lists**: Ordered and unordered lists
- **Testimonials**: Customer reviews with ratings
- **Video**: Embedded video content

**Rendering Pipeline**:
```javascript
loadDynamicSections() → fetchSections() → renderSections() → applyAnimations()
```

#### 3. Content Override System
**Purpose**: Enables persistent content edits across browsers and devices

**Architecture**:
```javascript
// Override Engine Flow
ContentEdit → GenerateSelector → SaveOverride → ApplyOnLoad
```

**Key Features**:
- Stable block ID system for consistent element targeting
- Cross-browser persistence
- Real-time preview with restore capability
- Integration with visual editor

### Frontend File Structure
```
public/
├── css/
│   ├── styles2.css          # Main stylesheet
│   ├── editor.css           # Visual editor styles
│   └── header-banner.css    # Header component styles
├── js/
│   ├── visual-editor-v2.js  # Main visual editor
│   ├── dynamic-sections.js  # Dynamic content system
│   ├── editor/              # Editor modules
│   │   ├── ui-manager.js    # UI overlay management
│   │   ├── override-engine.js # Content override system
│   │   ├── api-service.js   # API communication
│   │   └── features/        # Feature modules
│   └── video-player.js      # Video playback system
└── images/                  # Static assets
```

## 🔧 Backend Architecture

### Technology Stack
- **Runtime**: Node.js 18.x (Serverless Functions)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt
- **File Storage**: Vercel Blob + Google Cloud Storage
- **Deployment**: Vercel (Serverless Platform)

### API Architecture

#### Serverless Functions Structure
```
api/
├── login.js              # Authentication endpoint
├── protected.js          # JWT validation utility
├── addTutor.js          # Tutor management
├── blog-writer.js       # Blog content management
├── content-manager.js   # Content override management
├── content-display.js   # Public content serving
├── sections.js          # Dynamic sections CRUD
├── video-sections.js    # Video content management
├── tutors.js            # Tutor search and display
├── upload-image.js      # File upload handling
└── connectToDatabase.js # Database connection utility
```

#### Security Middleware
**Location**: `utils/`

```javascript
// Security Architecture
SecurityHeaders → InputValidation → Authentication → Authorization → BusinessLogic
```

**Components**:
- **Security Headers**: OWASP-recommended headers
- **Input Validation**: XSS and injection prevention
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Error Handling**: Production-safe error responses

### Database Architecture

#### MongoDB Collections
```javascript
// Core Data Models
Users: {
    email, password, role, profile, preferences
}

Sections: {
    pageSlug, type, title, content, position, order,
    headingBlockId, contentBlockId, imageBlockId, buttonBlockId
}

Blogs: {
    title, content, author, publishDate, status, metadata
}

Tutors: {
    name, subjects, regions, rates, availability, profile
}

Orders: {
    sectionId, newOrder, timestamp, userId
}
```

#### Data Relationships
```
Users (1:N) → Sections (content ownership)
Sections (N:1) → Pages (page association)
Users (1:N) → Blogs (authorship)
Sections (1:N) → Orders (reordering history)
```

## 🔐 Security Architecture

### Multi-Layer Security Model

#### Layer 1: Input Validation
- **XSS Prevention**: HTML sanitization and encoding
- **Injection Prevention**: Parameter validation and sanitization
- **Path Traversal Protection**: File path validation
- **Size Limits**: Request and file size restrictions

#### Layer 2: Authentication & Authorization
- **JWT Tokens**: HTTP-only cookies with secure flags
- **Role-Based Access**: admin, tutor, blogwriter, parent roles
- **Session Management**: 3-hour expiration with cleanup
- **Rate Limiting**: 5 attempts per 15 minutes

#### Layer 3: Security Headers
```javascript
// Applied Security Headers
'X-Content-Type-Options': 'nosniff'
'X-Frame-Options': 'DENY'
'X-XSS-Protection': '1; mode=block'
'Referrer-Policy': 'strict-origin-when-cross-origin'
'Content-Security-Policy': 'default-src \'self\'; ...'
```

#### Layer 4: Error Handling
- **Production Safety**: Generic error messages in production
- **Information Disclosure Prevention**: No sensitive data in errors
- **Security Logging**: Comprehensive audit trails
- **Monitoring**: Automated security event detection

### Security Implementation Files
```
utils/
├── security-headers.js    # Security headers utility
├── error-handler.js       # Secure error handling
├── input-validation.js    # Input validation utilities
├── security-logger.js     # Security event logging
└── csrf-protection.js     # CSRF protection utilities
```

## 📁 File Storage Architecture

### Multi-Tier Storage Strategy

#### Tier 1: Vercel Blob (Primary)
- **Use Case**: Images, documents, small videos (<4.5MB)
- **Features**: CDN integration, automatic optimization
- **Access**: Direct URL access with authentication

#### Tier 2: Google Cloud Storage (Overflow)
- **Use Case**: Large videos (>4.5MB), bulk storage
- **Features**: Scalable storage, cost-effective for large files
- **Access**: Signed URLs with expiration

#### File Processing Pipeline
```javascript
Upload → Validation → Processing → Storage → CDN → Delivery
```

**Validation Steps**:
1. File type validation (MIME + signature)
2. Size limits enforcement
3. Image dimension validation
4. Malware scanning (planned)
5. Hash-based deduplication

## 🧪 Testing Architecture

### Multi-Level Testing Strategy

#### Unit Tests (Vitest)
- **Scope**: Individual functions and utilities
- **Speed**: <1 second per test
- **Coverage**: 80%+ line coverage

#### Integration Tests (Supertest + MongoDB Memory Server)
- **Scope**: API endpoints with real database
- **Database**: In-memory MongoDB for isolation
- **Coverage**: 70%+ API endpoint coverage

#### E2E Tests (Playwright)
- **Scope**: Complete user workflows
- **Browsers**: Chromium, Firefox, Safari
- **Coverage**: 100% critical user flows

#### Security Tests (Custom Suite)
- **Scope**: Security feature validation
- **Coverage**: 100% security implementations
- **Automation**: Continuous security validation

### Testing Infrastructure
```
tests/
├── unit/           # Fast, isolated tests
├── integration/    # API + database tests
├── e2e/           # Browser automation tests
├── security/      # Security validation tests
├── fixtures/      # Test data and helpers
└── config/        # Test configuration
```

## 🚀 Deployment Architecture

### Vercel Serverless Platform

#### Function Limits
- **Maximum Functions**: 12 (Hobby tier limit)
- **Runtime**: Node.js 18.x
- **Memory**: 1024MB per function
- **Timeout**: 10 seconds per request

#### Deployment Pipeline
```
Git Push → Vercel Build → Function Deployment → CDN Update → Live
```

#### Environment Configuration
- **Development**: Local MongoDB + Vercel dev server
- **Preview**: Vercel preview + MongoDB Atlas
- **Production**: Vercel production + MongoDB Atlas + CDN

### Performance Optimizations
- **Static Asset Caching**: Aggressive caching for CSS/JS/images
- **Database Connection Pooling**: Efficient MongoDB connections
- **Image Optimization**: Automatic WebP conversion and resizing
- **Code Splitting**: Modular JavaScript loading

## 📊 Monitoring and Observability

### Performance Monitoring
- **Core Web Vitals**: LCP, FID, CLS tracking
- **API Response Times**: Endpoint performance monitoring
- **Database Query Performance**: Slow query detection
- **Error Rates**: 4xx/5xx response tracking

### Security Monitoring
- **Failed Login Attempts**: Brute force detection
- **Unusual API Usage**: Anomaly detection
- **File Upload Monitoring**: Malicious file detection
- **Security Event Logging**: Comprehensive audit trails

### Logging Strategy
```javascript
// Structured Logging
{
    timestamp: "2024-12-09T10:30:00Z",
    level: "INFO|WARN|ERROR",
    event: "login_success|upload_failed|security_violation",
    userId: "user-id",
    ip: "client-ip",
    details: { /* event-specific data */ }
}
```

---

**This architecture supports the mission of providing secure, accessible tutoring services to disadvantaged Scottish children while maintaining enterprise-grade reliability and performance.**
