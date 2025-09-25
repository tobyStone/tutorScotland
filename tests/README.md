# 🧪 TutorScotland Testing Suite

**Comprehensive testing infrastructure for the Tutors Alliance Scotland platform**

[![Testing Framework](https://img.shields.io/badge/Framework-Vitest%20%2B%20Playwright-blue.svg)](https://vitest.dev/)
[![Coverage](https://img.shields.io/badge/Coverage-80%25%2B-green.svg)](#test-coverage-targets)
[![Security Testing](https://img.shields.io/badge/Security-Validated-red.svg)](../docs/security-enhancements-implemented.md)

This directory contains the comprehensive testing infrastructure for the TutorScotland application, including unit tests, integration tests, end-to-end tests, security validation, and specialized testing for dynamic content management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Development workflow
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report

# Specialized testing
npm run test:dynamic-sections:baseline  # Create baseline before changes
npm run test:dynamic-sections:validate  # Validate after changes
npm run security:check                  # Security validation
```

## 🏗️ Test Architecture

### Test Structure
```
tests/
├── unit/                    # Fast, isolated unit tests
│   ├── models/             # Database model tests
│   ├── utils/              # Utility function tests
│   └── security/           # Security utility tests
├── integration/            # API and database integration tests
│   ├── api/               # Real API endpoint tests with supertest
│   ├── models/            # Database integration tests
│   └── security/          # Security integration tests
├── e2e/                   # End-to-end browser tests
│   ├── dynamic-sections/  # Dynamic content testing
│   ├── visual-editor/     # Visual editor testing
│   ├── security/          # Security E2E tests
│   └── cross-browser/     # Cross-browser compatibility
├── security/              # Dedicated security test suite
│   ├── validation/        # Input validation tests
│   ├── headers/           # Security headers tests
│   └── authentication/    # Auth security tests
├── fixtures/              # Test data and helpers
│   ├── data/             # JSON test data
│   ├── helpers/          # Test utility functions
│   └── security/         # Security test fixtures
├── config/               # Test configuration
├── mocks/                # Mock implementations
└── migration/            # Database migration tests
```

### Testing Technologies
- **Unit & Integration**: [Vitest](https://vitest.dev/) - Fast, modern test runner
- **E2E Testing**: [Playwright](https://playwright.dev/) - Cross-browser automation
- **API Testing**: [Supertest](https://github.com/ladjs/supertest) - HTTP assertion library
- **Database**: [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server) - In-memory MongoDB
- **Mocking**: [MSW](https://mswjs.io/) - Mock Service Worker for API mocking

## ✅ Implementation Status

### Phase 1: Core Testing Infrastructure (COMPLETED)
- [x] **Test Infrastructure Setup**
  - Vitest configuration for unit/integration tests
  - Playwright configuration for E2E tests
  - MongoDB Memory Server for isolated testing
  - Mock implementations for external services
  - Supertest for real API testing

- [x] **Unit Testing**
  - User model validation tests
  - Authentication utility tests
  - Database schema validation
  - Security utility tests

- [x] **Integration Testing**
  - Real API endpoint tests with supertest
  - JWT token validation tests
  - Database connection tests
  - Error handling scenarios
  - Security integration tests

- [x] **CI/CD Pipeline**
  - GitHub Actions workflow
  - Automated test execution
  - Coverage reporting
  - Security scanning
  - Automated dependency updates

### Phase 2: Advanced Testing Features (COMPLETED)
- [x] **Security Testing Suite**
  - Input validation testing (XSS, injection prevention)
  - Security headers verification
  - Authentication and authorization tests
  - CSRF protection validation
  - Error handling security tests

- [x] **Dynamic Sections Testing Framework**
  - Styling consistency tests across viewports
  - Visual regression testing with screenshots
  - Cross-browser compatibility validation
  - CRUD functionality tests for all section types
  - Automated baseline creation and validation

- [x] **Visual Editor Testing**
  - Content persistence testing
  - Block ID stability validation
  - Override system testing
  - Image upload and management tests
  - Cross-browser editing consistency

### Test Coverage Targets
- **Unit Tests**: 80% line coverage minimum ✅ **ACHIEVED**
- **Integration Tests**: 70% API endpoint coverage ✅ **ACHIEVED**
- **E2E Tests**: 100% critical user flow coverage ✅ **ACHIEVED**
- **Security Tests**: 100% security feature coverage ✅ **ACHIEVED**

## 🎯 Specialized Testing Frameworks

### 1. Dynamic Sections Testing Suite ✅
**Purpose**: Comprehensive testing framework for dynamic content management with regression prevention.

#### Test Files
- `tests/e2e/dynamic-sections-styling.spec.js` - Styling consistency across all section types and viewports
- `tests/e2e/dynamic-sections-visual-regression.spec.js` - Visual regression protection with screenshot comparison
- `tests/e2e/dynamic-sections-cross-browser.spec.js` - Cross-browser compatibility validation
- `tests/integration/api/dynamic-sections.test.js` - Real API CRUD operations and validation

#### Automated Test Runner
- `scripts/test-dynamic-sections.js` - Orchestrates baseline creation and validation workflow

#### Usage Workflow
```bash
# Before adding new section types (create baseline)
npm run test:dynamic-sections:baseline

# After implementing changes (validate)
npm run test:dynamic-sections:validate

# Individual test suites
npm run test:dynamic-sections:styling      # Styling consistency
npm run test:dynamic-sections:visual       # Visual regression
npm run test:dynamic-sections:cross-browser # Cross-browser compatibility
```

### 2. Security Testing Suite ✅
**Purpose**: Comprehensive security validation for all security enhancements.

#### Test Files
- `tests/security-validation.js` - Automated security test suite
- `tests/security/input-validation.test.js` - XSS and injection prevention tests
- `tests/security/headers.test.js` - Security headers verification
- `tests/security/authentication.test.js` - Auth security tests

#### Security Test Categories
- **Input Validation**: Tests malicious payloads and edge cases
- **Security Headers**: Validates all OWASP-recommended headers
- **Authentication**: Tests JWT security and session management
- **CSRF Protection**: Validates cookie security settings
- **Error Handling**: Tests information disclosure prevention

### 3. Visual Editor Testing Suite ✅
**Purpose**: Validates visual editor functionality and content persistence.

#### Test Coverage
- **Content Persistence**: Cross-browser/device editing consistency
- **Block ID Stability**: Ensures stable element identification
- **Override System**: Tests content override management
- **Image Management**: Upload, replace, and optimization testing
- **Section Reordering**: Drag-and-drop functionality validation

## 🏃‍♂️ Running Tests

### Core Test Suites

#### Unit Tests
```bash
npm run test:unit
```
**Purpose**: Tests individual functions and components in isolation
- **Speed**: Fast execution (< 1 second per test)
- **Dependencies**: No external dependencies
- **Coverage**: Business logic, utilities, models

#### Integration Tests
```bash
npm run test:integration
```
**Purpose**: Tests API endpoints with real database connections
- **Database**: MongoDB Memory Server for isolation
- **API Testing**: Real HTTP requests with supertest
- **Coverage**: API endpoints, database operations, authentication

#### End-to-End Tests
```bash
npm run test:e2e
```
**Purpose**: Tests complete user workflows in real browsers
- **Browsers**: Chromium, Firefox, Safari (via Playwright)
- **Viewports**: Desktop, tablet, mobile
- **Coverage**: User interactions, visual consistency, cross-browser compatibility

### Specialized Test Commands

#### Security Testing
```bash
npm run security:check          # Comprehensive security audit
npm run security:audit          # npm audit with moderate level
npm run security:fix            # Attempt to fix vulnerabilities
```

#### Dynamic Sections Testing
```bash
npm run test:dynamic-sections:baseline   # Create baseline before changes
npm run test:dynamic-sections:validate   # Validate changes against baseline
npm run test:dynamic-sections:styling    # Styling consistency only
npm run test:dynamic-sections:visual     # Visual regression only
npm run test:dynamic-sections:cross-browser # Cross-browser only
```

#### Database Testing
```bash
npm run test:migration          # Database migration tests
npm run test:schema-safety      # Schema validation tests
```

#### Development Workflow
```bash
npm run test:watch             # Watch mode for active development
npm run test:coverage          # Generate detailed coverage report
npm run test:pre-commit        # Pre-commit validation
npm run test:ci                # CI/CD pipeline tests
```

## 📊 Test Data Management

### Fixtures and Test Data
```
tests/fixtures/
├── data/
│   ├── users.json          # Test user accounts
│   ├── sections.json       # Dynamic section test data
│   ├── blogs.json          # Blog post test data
│   └── tutors.json         # Tutor profile test data
├── helpers/
│   ├── auth-helper.js      # Authentication test utilities
│   ├── db-helper.js        # Database test utilities
│   └── api-helper.js       # API test utilities
└── security/
    ├── malicious-payloads.js # XSS and injection test data
    └── security-headers.js   # Expected security headers
```

### Mocking Strategy
- **External Services**: Vercel Blob, Nodemailer, Google Cloud Storage
- **File System**: Mock file operations for upload testing
- **Database**: MongoDB Memory Server for integration tests
- **HTTP Requests**: MSW for external API mocking
- **Authentication**: JWT token mocking for protected routes

### Database Management
- **Isolation**: Each test gets a fresh database instance
- **Seeding**: Programmatic test data creation
- **Cleanup**: Automatic cleanup between tests
- **Migration Testing**: Validates database schema changes

## 🔄 Development Workflow

### Test-Driven Development (TDD)
1. **Write Tests First**: Define expected behavior before implementation
2. **Red Phase**: Write failing tests
3. **Green Phase**: Implement minimal code to pass tests
4. **Refactor Phase**: Improve code while maintaining test coverage

### Pre-Commit Workflow
```bash
# Before committing changes
npm run test:pre-commit     # Run critical tests
npm run security:check      # Security validation
npm run test:coverage       # Ensure coverage targets met
```

### CI/CD Integration
- **GitHub Actions**: Automated test execution on all PRs
- **Coverage Reports**: Automatic coverage reporting
- **Security Scanning**: Automated dependency vulnerability scanning
- **Cross-Browser Testing**: Automated E2E tests across browsers

## 🚀 Advanced Testing Features

### Performance Testing
- **Load Testing**: API endpoint performance validation
- **Database Optimization**: Query performance testing
- **Image Processing**: Upload and processing benchmarks
- **Memory Usage**: Memory leak detection

### Accessibility Testing
- **WCAG Compliance**: Automated accessibility testing
- **Keyboard Navigation**: Tab order and keyboard accessibility
- **Screen Reader**: Screen reader compatibility testing
- **Color Contrast**: Automated contrast ratio validation

### Visual Regression Testing
- **Screenshot Comparison**: Pixel-perfect UI consistency
- **Cross-Browser Rendering**: Visual consistency across browsers
- **Responsive Design**: Layout validation across viewports
- **Dynamic Content**: Visual validation of dynamic sections

## 🔧 Troubleshooting

### Common Issues and Solutions

#### MongoDB Connection Errors
```bash
# Ensure MongoDB Memory Server is properly installed
npm install --save-dev mongodb-memory-server

# Clear npm cache if installation issues persist
npm cache clean --force
```

#### Test Timeouts
```bash
# Increase timeout in vitest.config.js
export default defineConfig({
  test: {
    timeout: 30000  // 30 seconds
  }
})
```

#### Playwright Browser Issues
```bash
# Install browser dependencies
npx playwright install
npx playwright install-deps
```

#### Security Test Failures
- **Input Validation**: Check that malicious payloads are properly blocked
- **Security Headers**: Verify all required headers are present
- **Authentication**: Ensure JWT tokens are properly validated

#### Visual Regression Failures
- **Screenshot Differences**: Review visual diffs in `test-results/`
- **Timing Issues**: Add proper wait conditions for dynamic content
- **Browser Differences**: Check cross-browser compatibility

### Debug Mode
```bash
# Run tests with verbose output
npm run test:unit -- --reporter=verbose

# Run specific test file
npx vitest run tests/unit/models/User.test.js

# Debug E2E tests
npm run test:e2e:debug

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

### Performance Debugging
```bash
# Generate coverage report with performance metrics
npm run test:coverage

# Profile test execution
npx vitest run --reporter=verbose --coverage
```

## 📈 Test Metrics and Monitoring

### Coverage Targets
- **Unit Tests**: 80%+ line coverage ✅
- **Integration Tests**: 70%+ API coverage ✅
- **E2E Tests**: 100% critical flows ✅
- **Security Tests**: 100% security features ✅

### Quality Metrics
- **Test Execution Time**: < 5 minutes for full suite
- **Flaky Test Rate**: < 1% failure rate
- **Security Test Coverage**: 100% of security features
- **Cross-Browser Compatibility**: 100% across target browsers

## 🤝 Contributing to Tests

### Test Development Guidelines
1. **Follow TDD**: Write tests before implementation
2. **Test Structure**: Use consistent naming and organization
3. **Coverage**: Maintain coverage above minimum thresholds
4. **Documentation**: Update README for new test categories
5. **Security**: Include security tests for new features

### Adding New Test Categories
1. Create appropriate directory structure
2. Add npm scripts for new test types
3. Update CI/CD pipeline configuration
4. Document new testing procedures
5. Update coverage targets if needed

### Code Review Checklist
- [ ] Tests cover happy path and edge cases
- [ ] Security implications are tested
- [ ] Cross-browser compatibility considered
- [ ] Performance impact assessed
- [ ] Documentation updated

## 📚 Additional Resources

### Documentation Links
- **[Testing Strategy](TESTING_STRATEGY.md)** - Comprehensive testing approach
- **[Security Testing](../docs/security-enhancements-implemented.md)** - Security validation details
- **[Dynamic Sections Testing](../DYNAMIC_SECTIONS_TESTING_PLAN.md)** - Dynamic content testing
- **[Integration Testing Plan](../docs/integration-testing-plan.md)** - API testing strategy

### External Resources
- **[Vitest Documentation](https://vitest.dev/)** - Unit and integration testing
- **[Playwright Documentation](https://playwright.dev/)** - E2E testing
- **[Supertest Documentation](https://github.com/ladjs/supertest)** - API testing
- **[MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)** - Database testing

---

**For detailed implementation guidance and architectural decisions, see the main project documentation.**

**Built with comprehensive testing to ensure reliability and security for Scottish children's education** 🧪✅
