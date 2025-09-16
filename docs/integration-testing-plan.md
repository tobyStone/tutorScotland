# Integration Testing Implementation Plan

## Current State Assessment

### ✅ What's Working
- MongoDB Memory Server successfully spins up
- Database connections work reliably
- Models are properly imported and functional
- Test utilities exist and work

### 🟡 What Needs Improvement
- Integration tests are mostly mocked instead of testing real API endpoints
- Supertest isn't being used to test actual HTTP requests
- API endpoints aren't being exercised - just business logic

## Tech Team Member's Recommendation: APPROVED ✅

### Why This Approach is Excellent

1. **Real API Testing**: Tests actual HTTP endpoints instead of mocked logic
2. **Database Integration**: Tests real database operations with MongoDB Memory Server
3. **End-to-End Validation**: Verifies complete request/response cycle
4. **Error Handling**: Tests actual error conditions and edge cases

## Implementation Strategy

### Phase 1: Convert Dynamic Sections Test

**File**: `tests/integration/api/dynamic-sections.test.js`

**Current State**: Mock-based testing
**Target State**: Real API endpoint testing

```javascript
// BEFORE (current mock-based approach)
it('should create a new dynamic section', async () => {
  const newSection = { /* test data */ };
  const createdSection = { ...newSection, id: 'section-5' }; // Mock
  expect(createdSection.title).toBe(newSection.title);
});

// AFTER (real API testing)
it('should create a new dynamic section via API', async () => {
  const newSection = {
    pageSlug: 'home',
    type: 'text',
    title: 'Welcome Message',
    content: 'Welcome to TutorScotland!',
    position: 'top',
    order: 1,
    isActive: true
  };

  const response = await request(app)
    .post('/api/sections')
    .send(newSection)
    .expect(201);

  expect(response.body.title).toBe(newSection.title);
  
  // Verify in database
  const dbSection = await Section.findById(response.body._id);
  expect(dbSection.title).toBe(newSection.title);
});
```

### Phase 2: Convert Blog System Test

**File**: `tests/integration/api/blog-system.test.js`

**Target API**: `/api/content-display.js` (blog operations)

### Phase 3: Convert Tutor Search Test

**File**: `tests/integration/api/tutor-search.test.js`

**Target API**: `/api/tutors.js` (search operations)

## Technical Implementation

### Required Changes

1. **Import supertest and create app instance**
2. **Seed database with fixture data in beforeEach**
3. **Use supertest to make HTTP requests**
4. **Assert on both HTTP responses AND database state**
5. **Remove mock-only logic**

### Example Implementation

```javascript
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import API handler
import sectionsHandler from '../../../api/sections.js';
import Section from '../../../models/Section.js';

// Create test server
const app = createServer((req, res) => {
  if (req.url.startsWith('/api/sections')) {
    return sectionsHandler(req, res);
  }
  res.statusCode = 404;
  res.end('Not Found');
});

describe('Dynamic Sections API Integration', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await Section.deleteMany({});
    
    // Seed with fixture data
    await Section.insertMany([
      {
        page: 'about',
        heading: 'Our Mission',
        text: 'We help students...',
        layout: 'standard',
        position: 'bottom',
        order: 1
      }
    ]);
  });

  it('should create new section via POST /api/sections', async () => {
    const newSection = {
      page: 'home',
      heading: 'Welcome',
      text: 'Welcome to our site',
      layout: 'standard',
      position: 'bottom',
      order: 1
    };

    const response = await request(app)
      .post('/api/sections')
      .send(newSection)
      .expect(201);

    // Assert HTTP response
    expect(response.body.heading).toBe('Welcome');
    expect(response.body._id).toBeDefined();

    // Assert database state
    const dbSection = await Section.findById(response.body._id);
    expect(dbSection.heading).toBe('Welcome');
    expect(dbSection.page).toBe('home');
  });

  it('should retrieve sections via GET /api/sections', async () => {
    const response = await request(app)
      .get('/api/sections?page=about')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].heading).toBe('Our Mission');
  });
});
```

## Benefits of This Approach

### 1. **Real Integration Testing**
- Tests actual API endpoints
- Verifies complete request/response cycle
- Catches integration bugs that mocks miss

### 2. **Database Validation**
- Tests real database operations
- Verifies data persistence
- Catches schema validation issues

### 3. **Error Handling**
- Tests actual error responses
- Verifies error status codes
- Tests edge cases and validation

### 4. **Confidence in Deployments**
- Tests match production behavior
- Reduces deployment risks
- Catches breaking changes early

## Implementation Timeline

### Week 1: Dynamic Sections
- Convert `dynamic-sections.test.js` to real API testing
- Test all CRUD operations
- Verify database side effects

### Week 2: Blog System
- Convert `blog-system.test.js` to real API testing
- Test content display operations
- Verify HTML generation

### Week 3: Tutor Search
- Convert `tutor-search.test.js` to real API testing
- Test search functionality
- Verify filtering and pagination

### Week 4: Cleanup & Documentation
- Remove commented mock code
- Update test documentation
- Add performance benchmarks

## Risk Mitigation

### Potential Issues
1. **Test Performance**: Real API calls slower than mocks
2. **Test Complexity**: More setup required
3. **Flaky Tests**: Network/timing issues

### Solutions
1. **Optimize Test Data**: Use minimal fixture data
2. **Parallel Execution**: Run tests in parallel where possible
3. **Proper Cleanup**: Ensure clean state between tests
4. **Timeouts**: Set appropriate test timeouts

## Success Metrics

- ✅ All integration tests use real API endpoints
- ✅ Tests verify both HTTP responses and database state
- ✅ No mock-only logic remains
- ✅ Test coverage increases for API endpoints
- ✅ CI/CD pipeline remains stable

## Conclusion

Your tech team member's recommendation is **excellent and should be implemented**. The MongoDB Memory Server infrastructure is already working, so the main work is converting from mocked logic to real API testing using supertest.

This will significantly improve test quality and catch integration issues that the current mock-based approach misses.
