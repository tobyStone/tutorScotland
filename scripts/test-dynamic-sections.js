#!/usr/bin/env node

/**
 * Dynamic Sections Test Runner
 * 
 * This script runs comprehensive tests for dynamic sections before and after
 * adding new section types (list, testimonial) to catch any regressions.
 * 
 * Usage:
 *   npm run test:dynamic-sections:baseline  # Run before adding new types
 *   npm run test:dynamic-sections:validate # Run after adding new types
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RESULTS_DIR = 'test-results/dynamic-sections';
const BASELINE_FILE = path.join(RESULTS_DIR, 'baseline-results.json');
const VALIDATION_FILE = path.join(RESULTS_DIR, 'validation-results.json');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Run a specific test suite and capture results
 */
function runTestSuite(suiteName, testPattern) {
  console.log(`\n🧪 Running ${suiteName}...`);
  
  try {
    const startTime = Date.now();
    
    // Run the test and capture output
    const result = execSync(`npx playwright test ${testPattern} --reporter=json`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${suiteName} completed in ${duration}ms`);
    
    // Parse JSON result
    const testResult = JSON.parse(result);
    
    return {
      suite: suiteName,
      pattern: testPattern,
      duration,
      passed: testResult.stats?.passed || 0,
      failed: testResult.stats?.failed || 0,
      skipped: testResult.stats?.skipped || 0,
      total: testResult.stats?.total || 0,
      timestamp: new Date().toISOString(),
      details: testResult
    };
    
  } catch (error) {
    console.error(`❌ ${suiteName} failed:`, error.message);
    
    return {
      suite: suiteName,
      pattern: testPattern,
      duration: 0,
      passed: 0,
      failed: 1,
      skipped: 0,
      total: 1,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Run integration tests
 */
function runIntegrationTests() {
  console.log(`\n🔧 Running Integration Tests...`);

  try {
    const result = execSync('npm run test:integration -- tests/integration/api/dynamic-sections.test.js', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log('✅ Integration tests completed');
    return { success: true, output: result };

  } catch (error) {
    console.error('❌ Integration tests failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run critical migration safety tests
 */
function runMigrationTests() {
  console.log(`\n🛡️ Running Migration Safety Tests...`);

  try {
    // Test schema compatibility
    const schemaResult = execSync('npm run test:integration -- tests/integration/models/section-schema.test.js', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Test migration safety
    const migrationResult = execSync('npm run test:integration -- tests/migration/schema-migration.test.js', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log('✅ Migration safety tests completed');
    return {
      success: true,
      output: { schema: schemaResult, migration: migrationResult }
    };

  } catch (error) {
    console.error('❌ Migration safety tests failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create baseline results before adding new section types
 */
function createBaseline() {
  console.log('🎯 Creating Dynamic Sections Test Baseline...');
  console.log('This will capture the current "golden state" before adding list/testimonial sections.');
  
  const results = {
    timestamp: new Date().toISOString(),
    purpose: 'Baseline before adding list and testimonial section types',
    testSuites: []
  };
  
  // Run styling tests
  const stylingResults = runTestSuite(
    'Dynamic Section Styling Tests',
    'tests/e2e/dynamic-sections-styling.spec.js'
  );
  results.testSuites.push(stylingResults);
  
  // Run visual regression tests (creates baseline screenshots)
  const visualResults = runTestSuite(
    'Visual Regression Tests (Baseline Creation)',
    'tests/e2e/dynamic-sections-visual-regression.spec.js'
  );
  results.testSuites.push(visualResults);
  
  // Run cross-browser tests
  const crossBrowserResults = runTestSuite(
    'Cross-Browser Consistency Tests',
    'tests/e2e/dynamic-sections-cross-browser.spec.js'
  );
  results.testSuites.push(crossBrowserResults);
  
  // Run integration tests
  const integrationResults = runIntegrationTests();
  results.integrationTests = integrationResults;

  // ✅ CRITICAL: Run migration safety tests
  const migrationResults = runMigrationTests();
  results.migrationTests = migrationResults;
  
  // Calculate overall stats
  const totalPassed = results.testSuites.reduce((sum, suite) => sum + suite.passed, 0);
  const totalFailed = results.testSuites.reduce((sum, suite) => sum + suite.failed, 0);
  const totalTests = results.testSuites.reduce((sum, suite) => sum + suite.total, 0);
  
  results.summary = {
    totalTests,
    totalPassed,
    totalFailed,
    successRate: totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(2) + '%' : '0%'
  };
  
  // Save baseline results
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(results, null, 2));
  
  console.log('\n📊 Baseline Results Summary:');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${results.summary.successRate}`);
  
  if (totalFailed > 0) {
    console.log('\n⚠️  Some tests failed in baseline. Please fix these before adding new section types.');
    process.exit(1);
  } else {
    console.log('\n✅ Baseline created successfully! You can now safely add list and testimonial section types.');
    console.log(`Baseline saved to: ${BASELINE_FILE}`);
  }
}

/**
 * Validate results after adding new section types
 */
function validateChanges() {
  console.log('🔍 Validating Dynamic Sections After Adding New Types...');
  
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('❌ No baseline found. Please run baseline creation first.');
    process.exit(1);
  }
  
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  
  const results = {
    timestamp: new Date().toISOString(),
    purpose: 'Validation after adding list and testimonial section types',
    baseline: baseline.timestamp,
    testSuites: []
  };
  
  // Run the same test suites
  const stylingResults = runTestSuite(
    'Dynamic Section Styling Tests',
    'tests/e2e/dynamic-sections-styling.spec.js'
  );
  results.testSuites.push(stylingResults);
  
  const visualResults = runTestSuite(
    'Visual Regression Tests (Validation)',
    'tests/e2e/dynamic-sections-visual-regression.spec.js'
  );
  results.testSuites.push(visualResults);
  
  const crossBrowserResults = runTestSuite(
    'Cross-Browser Consistency Tests',
    'tests/e2e/dynamic-sections-cross-browser.spec.js'
  );
  results.testSuites.push(crossBrowserResults);
  
  const integrationResults = runIntegrationTests();
  results.integrationTests = integrationResults;
  
  // Compare with baseline
  const comparison = {
    testSuites: results.testSuites.map((current, index) => {
      const baselineSuite = baseline.testSuites[index];
      return {
        suite: current.suite,
        baseline: {
          passed: baselineSuite?.passed || 0,
          failed: baselineSuite?.failed || 0,
          total: baselineSuite?.total || 0
        },
        current: {
          passed: current.passed,
          failed: current.failed,
          total: current.total
        },
        regression: current.failed > (baselineSuite?.failed || 0),
        improvement: current.passed > (baselineSuite?.passed || 0)
      };
    })
  };
  
  results.comparison = comparison;
  
  // Save validation results
  fs.writeFileSync(VALIDATION_FILE, JSON.stringify(results, null, 2));
  
  console.log('\n📊 Validation Results:');
  
  let hasRegressions = false;
  
  comparison.testSuites.forEach(suite => {
    console.log(`\n${suite.suite}:`);
    console.log(`  Baseline: ${suite.baseline.passed}/${suite.baseline.total} passed`);
    console.log(`  Current:  ${suite.current.passed}/${suite.current.total} passed`);
    
    if (suite.regression) {
      console.log(`  ❌ REGRESSION DETECTED: More failures than baseline`);
      hasRegressions = true;
    } else if (suite.improvement) {
      console.log(`  ✅ IMPROVEMENT: More tests passing than baseline`);
    } else {
      console.log(`  ✅ STABLE: No regressions detected`);
    }
  });
  
  if (hasRegressions) {
    console.log('\n❌ REGRESSIONS DETECTED! The new section types may have broken existing functionality.');
    console.log('Please review the test failures and fix any issues before proceeding.');
    process.exit(1);
  } else {
    console.log('\n✅ VALIDATION SUCCESSFUL! No regressions detected.');
    console.log('The new section types have been added without breaking existing functionality.');
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'baseline':
    createBaseline();
    break;
  case 'validate':
    validateChanges();
    break;
  default:
    console.log('Usage:');
    console.log('  node scripts/test-dynamic-sections.js baseline  # Create baseline before changes');
    console.log('  node scripts/test-dynamic-sections.js validate  # Validate after changes');
    process.exit(1);
}
