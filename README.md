# 🎓 Tutors Alliance Scotland

**A comprehensive platform to help disadvantaged Scottish children find tutors who suit their budget and circumstances.**

[![Security Status](https://img.shields.io/badge/Security-Enterprise%20Grade-green.svg)](docs/security-enhancements-implemented.md)
[![Testing](https://img.shields.io/badge/Testing-Comprehensive-blue.svg)](tests/README.md)
[![Visual Editor](https://img.shields.io/badge/Visual%20Editor-v2.0-purple.svg)](VISUAL_EDITOR_PERSISTENCE_SOLUTION.md)
[![Dynamic Sections](https://img.shields.io/badge/Dynamic%20Sections-Active-orange.svg)](DYNAMIC_SECTIONS_TESTING_PLAN.md)

## 🌟 Project Overview

Tutors Alliance Scotland is a charity-focused web platform designed to connect disadvantaged Scottish pupils with affordable, qualified tutoring services. The platform features a sophisticated content management system, enterprise-grade security, and comprehensive testing framework.

### 🎯 Mission
To provide accessible, high-quality tutoring services to disadvantaged children across Scotland, helping bridge educational gaps and improve academic outcomes.

## ✨ Key Features

### 🔐 **Enterprise-Grade Security**
- **Authentication**: JWT-based with HTTP-only cookies and role-based access control
- **Input Validation**: Comprehensive XSS and injection prevention on all APIs
- **CSRF Protection**: SameSite strict cookies and security headers
- **File Upload Security**: Multi-layer validation with authentication requirements
- **Rate Limiting**: 5 attempts per 15 minutes with security logging
- **Security Headers**: Full suite including XSS protection and clickjacking prevention

### 🎨 **Advanced Visual Editor (v2.0)**
- **Live Content Editing**: In-place editing with real-time preview
- **Content Override System**: Persistent edits across browsers and devices
- **Image Management**: Upload, replace, and optimize images with drag-and-drop
- **Section Reordering**: Drag-and-drop section management
- **Block ID System**: Stable element identification for consistent editing

### 📱 **Dynamic Content Management**
- **Multiple Section Types**: Standard, team members, lists, testimonials, video sections
- **Position-Based Rendering**: Top, middle, bottom placement with ordering
- **Responsive Design**: Optimized for all devices and screen sizes
- **Navigation Integration**: Automatic anchor generation and smooth scrolling
- **Fade-in Animations**: Intersection observer-based progressive loading

### 🧪 **Comprehensive Testing Framework**
- **Unit Tests**: 80%+ coverage with Vitest
- **Integration Tests**: Real API testing with MongoDB Memory Server
- **E2E Tests**: Cross-browser testing with Playwright
- **Visual Regression**: Screenshot comparison for UI consistency
- **Security Validation**: Automated security testing suite
- **Dynamic Sections Testing**: Specialized testing for content management

## 🏗️ Architecture

### **Frontend**
- **Vanilla JavaScript**: Modern ES6+ with modular architecture
- **CSS3**: Responsive design with CSS Grid and Flexbox
- **Progressive Enhancement**: Works without JavaScript, enhanced with it

### **Backend**
- **Node.js**: Serverless functions on Vercel
- **MongoDB**: Document database with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: Vercel Blob + Google Cloud Storage for large files

### **Security**
- **Input Validation**: Comprehensive sanitization and validation
- **Security Headers**: Full OWASP-recommended header suite
- **Error Handling**: Production-safe error messages
- **Logging**: Comprehensive security event logging

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- MongoDB (local or Atlas)
- Vercel CLI (for development)

### Installation
```bash
# Clone the repository
git clone https://github.com/tobyStone/tutorScotland.git
cd tutorScotland

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run start
```

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/tutorscotland

# Authentication
JWT_SECRET=your-jwt-secret-here

# File Storage
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_PRIVATE_KEY=your-private-key

# Email (optional)
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Development workflow
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report

# Dynamic sections testing
npm run test:dynamic-sections:baseline  # Create baseline before changes
npm run test:dynamic-sections:validate  # Validate after changes

# Security testing
npm run security:check    # Run security audit
npm run security:audit    # npm audit with moderate level
```

### Test Structure
```
tests/
├── unit/                 # Fast, isolated unit tests
├── integration/         # API and database integration tests
├── e2e/                # End-to-end browser tests
├── security/           # Security validation tests
├── fixtures/           # Test data and helpers
└── config/             # Test configuration
```

## 🔐 Security

### Security Posture: **🟢 ENTERPRISE-GRADE**

The platform implements comprehensive security measures suitable for protecting children's data:

- **✅ Authentication & Authorization**: JWT with role-based access control
- **✅ Input Validation**: XSS and injection prevention on all endpoints
- **✅ CSRF Protection**: SameSite strict cookies
- **✅ Security Headers**: Full OWASP-recommended suite
- **✅ File Upload Security**: Multi-layer validation and authentication
- **✅ Rate Limiting**: Brute force protection with security logging
- **✅ Error Handling**: Production-safe error messages
- **✅ Security Monitoring**: Comprehensive logging and audit trails

For detailed security information, see [Security Documentation](docs/security-enhancements-implemented.md).

## 📚 Documentation

### Core Documentation
- **[Security Enhancements](docs/security-enhancements-implemented.md)** - Complete security implementation details
- **[Testing Strategy](tests/TESTING_STRATEGY.md)** - Comprehensive testing approach
- **[Visual Editor Solution](VISUAL_EDITOR_PERSISTENCE_SOLUTION.md)** - Visual editor architecture and implementation
- **[Dynamic Sections Testing](DYNAMIC_SECTIONS_TESTING_PLAN.md)** - Testing framework for dynamic content

### API Documentation
- **[Integration Testing Plan](docs/integration-testing-plan.md)** - API testing strategy
- **[Security Risk Assessment](docs/security-risk-assessment.md)** - Security analysis and monitoring

### Setup Guides
- **[Google Cloud Setup](docs/google-cloud-setup-guide.md)** - Cloud storage configuration
- **[Gmail Setup](docs/gmail-setup-guide.md)** - Email service configuration

## 🛠️ Development

### Project Structure
```
tutorScotland/
├── api/                 # Serverless API functions
├── public/             # Static assets and HTML files
│   ├── css/           # Stylesheets
│   ├── js/            # JavaScript modules
│   └── images/        # Static images
├── models/            # MongoDB schemas
├── utils/             # Utility functions
├── tests/             # Test suites
├── docs/              # Documentation
└── scripts/           # Build and utility scripts
```

### Key Technologies
- **Runtime**: Node.js 18.x
- **Database**: MongoDB with Mongoose
- **Testing**: Vitest + Playwright + Supertest
- **Deployment**: Vercel (Serverless)
- **File Storage**: Vercel Blob + Google Cloud Storage
- **Security**: bcrypt, JWT, comprehensive validation

### Development Workflow
1. **Feature Development**: Create feature branch from main
2. **Testing**: Write tests first (TDD approach)
3. **Security**: Run security checks before commit
4. **Code Review**: All changes require review
5. **Deployment**: Automatic deployment via Vercel

## 🚀 Deployment

### Vercel Deployment
The application is optimized for Vercel's serverless platform:

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Configuration
- **Development**: Local MongoDB + Vercel dev server
- **Preview**: Vercel preview + MongoDB Atlas
- **Production**: Vercel production + MongoDB Atlas + CDN

## 🤝 Contributing

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm run test:all`
5. Run security checks: `npm run security:check`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Standards
- **ES6+**: Modern JavaScript with modules
- **Testing**: All features must have tests
- **Security**: Security-first development approach
- **Documentation**: Update docs for significant changes
- **Performance**: Consider performance impact of changes

## 📊 Project Status

### Current Version: **v2.0**
- ✅ **Security**: Enterprise-grade implementation complete
- ✅ **Visual Editor**: v2.0 with persistence and live editing
- ✅ **Testing**: Comprehensive test suite implemented
- ✅ **Dynamic Sections**: Full content management system
- ✅ **Performance**: Optimized for speed and scalability

### Recent Achievements
- **December 2024**: Tier 2 Security Enhancements completed
- **November 2024**: Visual Editor v2.0 with persistence solution
- **October 2024**: Comprehensive testing framework implementation
- **September 2024**: Dynamic sections testing and validation system

## 📞 Support

### For Developers
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Documentation**: Check the `docs/` directory for detailed guides
- **Testing**: Run `npm run test:all` to validate your changes

### For the Charity
- **Admin Access**: Contact the development team for admin credentials
- **Content Management**: Use the visual editor for live content updates
- **Support**: Email support available for urgent issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tutors Alliance Scotland** - For their mission to help disadvantaged children
- **Development Team** - For building a secure, scalable platform
- **Open Source Community** - For the excellent tools and libraries used

---

**Built with ❤️ for Scottish children's education**

<!-- Deployment trigger: Comprehensive README update -->


