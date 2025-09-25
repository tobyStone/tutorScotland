# 👨‍💻 Developer Onboarding Guide

**Complete onboarding guide for TutorScotland developers**

[![Welcome](https://img.shields.io/badge/Welcome-New%20Developer-blue.svg)](#welcome)
[![Setup](https://img.shields.io/badge/Setup-30%20Minutes-green.svg)](#quick-setup)
[![Architecture](https://img.shields.io/badge/Architecture-Modern-purple.svg)](architecture-overview.md)

## 🎯 Welcome to TutorScotland

Welcome to the TutorScotland development team! This guide will help you get up and running quickly with our platform that helps disadvantaged Scottish children find affordable tutoring services.

### What You'll Learn
- **Project Setup**: Get your development environment running in 30 minutes
- **Architecture Understanding**: Learn our modern, secure architecture
- **Development Workflow**: Understand our testing-first approach
- **Security Practices**: Follow our enterprise-grade security standards
- **Contribution Guidelines**: Make your first meaningful contribution

## 🚀 Quick Setup (30 Minutes)

### Prerequisites
Before you begin, ensure you have:
- **Node.js 18.x or higher** ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **MongoDB** (local installation or Atlas account)
- **Vercel CLI** (for development server)
- **Code Editor** (VS Code recommended)

### Step 1: Repository Setup
```bash
# Clone the repository
git clone https://github.com/tobyStone/tutorScotland.git
cd tutorScotland

# Install dependencies
npm install

# Install Vercel CLI globally
npm install -g vercel
```

### Step 2: Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required variables:
MONGODB_URI=mongodb://localhost:27017/tutorscotland
JWT_SECRET=your-super-secret-jwt-key-here
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### Step 3: Database Setup
```bash
# Option 1: Local MongoDB
# Install MongoDB locally and start the service

# Option 2: MongoDB Atlas (Recommended)
# 1. Create account at https://cloud.mongodb.com/
# 2. Create cluster and get connection string
# 3. Update MONGODB_URI in .env
```

### Step 4: Development Server
```bash
# Start development server
npm run start

# Server will be available at http://localhost:3000
# API functions available at http://localhost:3000/api/*
```

### Step 5: Verify Setup
```bash
# Run tests to verify everything works
npm run test:unit
npm run test:integration

# If all tests pass, you're ready to develop! 🎉
```

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Node.js serverless functions (Vercel)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with HTTP-only cookies
- **File Storage**: Vercel Blob + Google Cloud Storage
- **Testing**: Vitest + Playwright + Supertest
- **Deployment**: Vercel (Serverless Platform)

### Project Structure
```
tutorScotland/
├── api/                    # Serverless API functions
│   ├── login.js           # Authentication
│   ├── protected.js       # JWT validation
│   ├── sections.js        # Dynamic content management
│   ├── upload-image.js    # File upload handling
│   └── ...
├── public/                # Frontend assets
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript modules
│   │   ├── visual-editor-v2.js
│   │   ├── dynamic-sections.js
│   │   └── editor/       # Editor components
│   ├── admin.html        # Admin interface
│   ├── index.html        # Homepage
│   └── ...
├── models/               # MongoDB schemas
│   ├── User.js
│   ├── Section.js
│   └── ...
├── utils/                # Utility functions
│   ├── security-headers.js
│   ├── error-handler.js
│   └── ...
├── tests/                # Test suites
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/
├── docs/                 # Documentation
└── scripts/              # Build and utility scripts
```

### Key Systems
1. **Visual Editor v2.0**: Live content editing with persistence
2. **Dynamic Sections**: Flexible content management system
3. **Security Framework**: Enterprise-grade security implementation
4. **Testing Suite**: Comprehensive testing across all layers

## 🔐 Security First Development

### Security Principles
- **Never trust user input**: Validate and sanitize everything
- **Authentication required**: Protect all sensitive operations
- **Principle of least privilege**: Grant minimum necessary permissions
- **Defense in depth**: Multiple layers of security controls
- **Security by design**: Build security into every feature

### Security Checklist for New Features
- [ ] **Input Validation**: All user inputs validated and sanitized
- [ ] **Authentication**: Protected endpoints require valid JWT
- [ ] **Authorization**: Role-based access control implemented
- [ ] **Security Headers**: Appropriate headers applied
- [ ] **Error Handling**: No sensitive information in error messages
- [ ] **Logging**: Security events properly logged
- [ ] **Testing**: Security tests written and passing

### Common Security Patterns
```javascript
// 1. API Authentication Pattern
const { verify } = require('./protected');

module.exports = async (req, res) => {
    // Check authentication for write operations
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const [ok, payload] = verify(req, res);
        if (!ok) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (payload.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
    }
    // ... business logic
};

// 2. Input Validation Pattern
function validateInput(data) {
    const errors = [];
    
    if (!data.title || data.title.length > 100) {
        errors.push('Title must be 1-100 characters');
    }
    
    if (data.content && /<script|javascript:/i.test(data.content)) {
        errors.push('Content contains invalid characters');
    }
    
    return { valid: errors.length === 0, errors };
}

// 3. Security Headers Pattern
const { applySecurityHeaders } = require('../utils/security-headers');

module.exports = async (req, res) => {
    applySecurityHeaders(res);
    // ... business logic
};
```

## 🧪 Testing-First Development

### Testing Philosophy
We follow a **Test-Driven Development (TDD)** approach:
1. **Write tests first** to define expected behavior
2. **Implement minimal code** to make tests pass
3. **Refactor** while maintaining test coverage
4. **Add security tests** for all new features

### Test Types and When to Use Them

#### Unit Tests (`npm run test:unit`)
**Use for**: Individual functions, utilities, business logic
```javascript
// Example: Testing input validation
import { validateTutorData } from '../utils/validation.js';

describe('validateTutorData', () => {
    test('should accept valid tutor data', () => {
        const validData = {
            name: 'John Smith',
            email: 'john@example.com',
            subjects: ['Mathematics', 'Physics']
        };
        
        const result = validateTutorData(validData);
        expect(result.valid).toBe(true);
    });
    
    test('should reject XSS attempts', () => {
        const maliciousData = {
            name: '<script>alert("xss")</script>',
            email: 'john@example.com'
        };
        
        const result = validateTutorData(maliciousData);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name contains invalid characters');
    });
});
```

#### Integration Tests (`npm run test:integration`)
**Use for**: API endpoints, database operations, system interactions
```javascript
// Example: Testing API endpoint
import request from 'supertest';
import { createTestApp } from '../fixtures/helpers/app-helper.js';

describe('POST /api/sections', () => {
    test('should create new section with authentication', async () => {
        const app = await createTestApp();
        const authToken = await getAuthToken('admin');
        
        const newSection = {
            pageSlug: 'home',
            type: 'text',
            title: 'Welcome',
            content: 'Welcome to our site'
        };
        
        const response = await request(app)
            .post('/api/sections')
            .set('Cookie', `token=${authToken}`)
            .send(newSection)
            .expect(201);
            
        expect(response.body.title).toBe('Welcome');
        
        // Verify in database
        const dbSection = await Section.findById(response.body._id);
        expect(dbSection.title).toBe('Welcome');
    });
});
```

#### E2E Tests (`npm run test:e2e`)
**Use for**: User workflows, visual consistency, cross-browser testing
```javascript
// Example: Testing visual editor
import { test, expect } from '@playwright/test';

test('admin can edit content with visual editor', async ({ page }) => {
    // Login as admin
    await page.goto('/login.html');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'password');
    await page.click('#loginBtn');
    
    // Navigate to page with editable content
    await page.goto('/about-us.html');
    
    // Enable edit mode
    await page.keyboard.press('Control+e');
    
    // Edit content
    await page.click('[data-ve-block-id]');
    await page.fill('.edit-dialog input', 'Updated content');
    await page.click('.save-btn');
    
    // Verify content updated
    await expect(page.locator('[data-ve-block-id]')).toContainText('Updated content');
});
```

### Running Tests
```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit          # Fast unit tests
npm run test:integration   # API and database tests
npm run test:e2e          # Browser automation tests

# Development workflow
npm run test:watch        # Watch mode for active development
npm run test:coverage     # Generate coverage report

# Security testing
npm run security:check    # Security validation
```

## 🔄 Development Workflow

### Git Workflow
1. **Create feature branch**: `git checkout -b feature/amazing-feature`
2. **Write tests first**: Define expected behavior
3. **Implement feature**: Make tests pass
4. **Run full test suite**: `npm run test:all`
5. **Security check**: `npm run security:check`
6. **Commit changes**: Use conventional commit messages
7. **Push and create PR**: Request code review
8. **Address feedback**: Iterate based on review
9. **Merge to main**: After approval and tests pass

### Commit Message Convention
```bash
# Format: type(scope): description
feat(auth): add two-factor authentication
fix(upload): resolve file validation issue
docs(readme): update setup instructions
test(security): add XSS prevention tests
refactor(editor): improve performance
```

### Code Review Checklist
- [ ] **Tests**: All new code has appropriate tests
- [ ] **Security**: Security implications considered and addressed
- [ ] **Performance**: No significant performance regressions
- [ ] **Documentation**: Code is well-documented
- [ ] **Standards**: Follows project coding standards
- [ ] **Accessibility**: UI changes are accessible
- [ ] **Cross-browser**: Works across target browsers

## 🎯 Making Your First Contribution

### Good First Issues
Look for issues labeled `good-first-issue` or consider these areas:
1. **Documentation improvements**: Fix typos, add examples
2. **Test coverage**: Add tests for existing functionality
3. **UI enhancements**: Improve accessibility or mobile experience
4. **Bug fixes**: Fix small, well-defined bugs
5. **Security improvements**: Add input validation or security headers

### Step-by-Step First Contribution
1. **Choose an issue**: Pick something manageable for your first PR
2. **Set up development environment**: Follow the setup guide above
3. **Create feature branch**: `git checkout -b fix/issue-123`
4. **Write tests**: Start with failing tests that define the fix
5. **Implement fix**: Make the tests pass
6. **Test thoroughly**: Run full test suite
7. **Document changes**: Update relevant documentation
8. **Submit PR**: Include clear description and link to issue
9. **Respond to feedback**: Address review comments promptly

### Getting Help
- **Documentation**: Check the `docs/` directory first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: Don't hesitate to ask for clarification
- **Security**: For security issues, contact maintainers privately

## 📚 Learning Resources

### Internal Documentation
- **[Architecture Overview](architecture-overview.md)** - System architecture
- **[Security Overview](security-overview.md)** - Security implementation
- **[Visual Editor Architecture](visual-editor-architecture.md)** - Editor system
- **[Testing Strategy](../tests/TESTING_STRATEGY.md)** - Testing approach

### External Resources
- **[Node.js Documentation](https://nodejs.org/docs/)** - Backend runtime
- **[MongoDB Manual](https://docs.mongodb.com/)** - Database
- **[Vercel Documentation](https://vercel.com/docs)** - Deployment platform
- **[Playwright Documentation](https://playwright.dev/)** - E2E testing
- **[Vitest Documentation](https://vitest.dev/)** - Unit testing

### Security Resources
- **[OWASP Top 10](https://owasp.org/www-project-top-ten/)** - Web security risks
- **[OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)** - Security guidance
- **[JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)** - Token security

## 🎉 Welcome to the Team!

You're now ready to contribute to TutorScotland! Remember:
- **Security first**: Always consider security implications
- **Test everything**: Write tests before implementing features
- **Ask questions**: The team is here to help
- **Have fun**: You're helping disadvantaged children access education!

**Next Steps**:
1. Set up your development environment
2. Run the test suite to verify everything works
3. Read through the architecture documentation
4. Pick your first issue and start contributing!

---

**Welcome to building a platform that makes a real difference in children's lives! 🎓✨**
