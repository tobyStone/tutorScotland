# TutorScotland Testing Suite

This directory contains the comprehensive testing infrastructure for the TutorScotland application.

## Quick Start

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
```''

## Test Structure

```
tests/
├── unit/                 # Fast, isolated unit tests
│   ├── models/          # Database model tests
│   └── utils/           # Utility function tests
├── integration/         # API and database integration tests
│   └── api/            # API endpoint tests
├── e2e/                # End-to-end browser tests
├── fixtures/           # Test data and helpers
│   ├── data/           # JSON test data
│   └── helpers/        # Test utility functions
├── config/             # Test configuration
└── mocks/              # Mock implementations
```

## Phase 1 Implementation Status ✅

### Completed
- [x] **Test Infrastructure Setup**
  - Vitest configuration for unit/integration tests
  - Playwright configuration for E2E tests
  - MongoDB Memory Server for isolated testing
  - Mock implementations for external services

- [x] **Unit Testing**
  - User model validation tests
  - Authentication utility tests
  - Database schema validation

- [x] **Integration Testing**
  - Login API endpoint tests
  - JWT token validation tests
  - Database connection tests
  - Error handling scenarios

- [x] **CI/CD Pipeline**
  - GitHub Actions workflow
  - Automated test execution
  - Coverage reporting
  - Security scanning

### Test Coverage Targets
- **Unit Tests**: 80% line coverage minimum
- **Integration Tests**: 70% API endpoint coverage
- **E2E Tests**: 100% critical user flow coverage

## Phase 2: Dynamic Sections Testing ✅

### Dynamic Section Test Suite
Comprehensive testing framework for dynamic sections with focus on preventing regressions when adding new section types (list, testimonial).

#### Test Files
- `tests/e2e/dynamic-sections-styling.spec.js` - Styling consistency across section types
- `tests/e2e/dynamic-sections-visual-regression.spec.js` - Visual regression protection
- `tests/e2e/dynamic-sections-cross-browser.spec.js` - Cross-browser compatibility
- `tests/integration/api/dynamic-sections.test.js` - CRUD operations and validation

#### Test Runner Script
- `scripts/test-dynamic-sections.js` - Automated baseline creation and validation

### Usage for Adding New Section Types

#### Before Adding New Types (Create Baseline)
```bash
npm run test:dynamic-sections:baseline
```
This captures the current "golden state" of dynamic sections styling and functionality.

#### After Adding New Types (Validate Changes)
```bash
npm run test:dynamic-sections:validate
```
This compares against the baseline to detect any regressions.

#### Individual Test Suites
```bash
npm run test:dynamic-sections:styling      # Styling consistency tests
npm run test:dynamic-sections:visual       # Visual regression tests
npm run test:dynamic-sections:cross-browser # Cross-browser compatibility
```

## Running Tests

### Unit Tests
```bash
npm run test:unit
```
Tests individual functions and components in isolation. Fast execution, no external dependencies.

### Integration Tests
```bash
npm run test:integration
```
Tests API endpoints with real database connections. Uses MongoDB Memory Server for isolation.

### End-to-End Tests
```bash
npm run test:e2e
```
Tests complete user workflows in real browsers. Requires the application to be running.

## Test Data Management

### Fixtures
- `tests/fixtures/data/` - Static JSON test data
- `tests/fixtures/helpers/` - Test utility functions
- Automatic database cleanup between tests

### Mocking Strategy
- **External Services**: Vercel Blob, Nodemailer, OpenAI
- **File System**: Mock file operations for testing
- **Database**: MongoDB Memory Server for integration tests

## Development Workflow

1. **Write Tests First** (TDD approach recommended)
2. **Run Tests Locally** before committing
3. **Check Coverage** to ensure adequate testing
4. **CI Pipeline** validates all changes automatically

## Next Steps (Phase 2)

- [ ] **Business Logic Testing**
  - Tutor search functionality
  - Image upload pipeline
  - Blog system tests

- [ ] **Visual Editor Testing**
  - Content management workflows
  - Dynamic sections CRUD
  - Visual regression testing

- [ ] **Performance Testing**
  - Load testing for API endpoints
  - Database query optimization
  - Image processing benchmarks

## Troubleshooting

### Common Issues

**MongoDB Connection Errors**
```bash
# Ensure MongoDB Memory Server is properly installed
npm install --save-dev mongodb-memory-server
```

**Test Timeouts**
- Increase timeout in `vitest.config.js` if needed
- Check for async operations without proper awaiting

**Mock Issues**
- Clear mocks between tests using `vi.clearAllMocks()`
- Verify mock implementations match actual API signatures

### Debug Mode
```bash
# Run tests with debug output
npm run test:unit -- --reporter=verbose

# Run specific test file
npx vitest run tests/unit/models/User.test.js
```

## Contributing

1. Follow the existing test structure and naming conventions
2. Ensure all new features have corresponding tests
3. Maintain test coverage above the minimum thresholds
4. Update this README when adding new test categories

For detailed implementation guidance, see the main project documentation.
