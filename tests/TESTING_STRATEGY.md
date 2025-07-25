# Testing Strategy for TutorScotland

## Overview

This document outlines the comprehensive testing strategy for the TutorScotland website, with particular focus on preventing regressions between interconnected systems.

## Test Categories

### 1. Unit Tests (`tests/unit/`)
- Test individual functions and components in isolation
- Mock external dependencies
- Fast execution, high coverage

### 2. Integration Tests (`tests/integration/`)
- Test interactions between different parts of the system
- Use real database connections (in-memory MongoDB)
- Test API endpoints working together

### 3. End-to-End Tests (`tests/e2e/`)
- Test complete user workflows
- Use real browser automation
- Test UI interactions and visual elements

## Key Integration Points to Test

### Dynamic Content System Integration

The dynamic content system has several interconnected parts that must work together:

1. **Static HTML Pages** with dynamic sections
2. **Composed Pages** built from multiple sections
3. **Admin Interface** for managing both of these
4. **API Endpoints** that serve different content types

### Critical Test Scenarios

#### 1. Page Creation and Section Targeting
**Problem**: When new composed pages are created, they must be available as targets for dynamic sections.

**Test Coverage**:
- `page-section-targeting-regression.test.js` - Tests the specific regression
- `admin-interface-integration.test.js` - Tests UI integration

**Key Assertions**:
- New composed pages appear in admin dropdown
- Sections can be created targeting new pages
- Static page sections continue to work

#### 2. API Endpoint Compatibility
**Problem**: Changes to one API endpoint can break other parts of the system.

**Test Coverage**:
- Verify `/api/sections` still works for static pages
- Verify `/api/page` works for composed pages
- Verify both can coexist without conflicts

#### 3. Data Model Consistency
**Problem**: Different data models (Section vs Page) must maintain referential integrity.

**Test Coverage**:
- Test section references in composed pages
- Test page slug uniqueness
- Test data cleanup and migration

## Regression Prevention Strategy

### 1. Cross-System Impact Testing
When making changes to any part of the system, run tests that verify:
- Other systems still function correctly
- Data flows between systems remain intact
- UI components reflect backend changes

### 2. Test-Driven Development for Integrations
Before adding new features that touch multiple systems:
1. Write integration tests that define expected behavior
2. Implement the feature
3. Verify all tests pass

### 3. Automated Regression Detection
The test suite includes specific regression tests for known issues:
- Page dropdown population after page creation
- Section targeting for new pages
- Static page functionality preservation

## Running Tests

### Development Workflow
```bash
# Run all tests
npm run test:all

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e

# Run regression tests
npm run test:regression
npm run test:admin-integration

# Watch mode for development
npm run test:watch
```

### Pre-Commit Testing
```bash
npm run test:pre-commit
```

### CI/CD Pipeline
```bash
npm run test:ci
```

## Test Data Management

### Database Setup
- Integration tests use MongoDB Memory Server
- Each test gets a fresh database
- Test data is created programmatically

### Mock Strategy
- Unit tests mock external dependencies
- Integration tests use real database but mock external APIs
- E2E tests use real services in test environment

## Monitoring and Alerting

### Test Failure Analysis
When tests fail:
1. Check if it's a regression in existing functionality
2. Verify if new changes broke integration points
3. Update tests if requirements have legitimately changed

### Coverage Requirements
- Unit tests: >90% code coverage
- Integration tests: Cover all API endpoints and major workflows
- E2E tests: Cover all user-facing features

## Future Improvements

### 1. Visual Regression Testing
Add screenshot comparison tests for:
- Admin interface layouts
- Dynamic section rendering
- Responsive design breakpoints

### 2. Performance Testing
Add tests for:
- Page load times
- API response times
- Database query performance

### 3. Accessibility Testing
Add automated tests for:
- WCAG compliance
- Keyboard navigation
- Screen reader compatibility

## Lessons Learned

### Page-Section Targeting Regression
**What Happened**: New composed pages weren't available in admin dropdown for section targeting.

**Root Cause**: Admin interface used hardcoded page list instead of dynamic API query.

**Prevention**: 
- Added integration tests that verify admin UI reflects backend changes
- Added regression test for this specific scenario
- Improved test coverage for cross-system interactions

**Test Improvements Made**:
1. Created `page-section-targeting-regression.test.js` to catch this specific issue
2. Added `admin-interface-integration.test.js` for broader UI/API integration testing
3. Enhanced existing tests to verify data consistency across systems

## Contributing to Tests

When adding new features:
1. Write unit tests for individual components
2. Write integration tests for API interactions
3. Add E2E tests for user workflows
4. Consider cross-system impacts and add regression tests
5. Update this documentation with new test scenarios
