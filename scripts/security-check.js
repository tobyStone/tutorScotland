#!/usr/bin/env node

/**
 * Security Check Script for tutorScotland
 * Automated security assessment for npm dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Severity levels to report (moderate and above)
  reportLevels: ['moderate', 'high', 'critical'],
  
  // Critical production dependencies to monitor closely
  criticalDeps: [
    'bcryptjs',      // Password hashing
    'jsonwebtoken',  // Authentication
    'mongoose',      // Database
    'axios',         // HTTP requests
    'sharp',         // Image processing
    '@vercel/blob',  // File storage
    '@google-cloud/storage' // Cloud storage
  ],
  
  // Output file for security reports
  reportFile: 'security-report.json'
};

class SecurityChecker {
  constructor() {
    this.vulnerabilities = [];
    this.packageJson = this.loadPackageJson();
  }

  loadPackageJson() {
    try {
      return JSON.parse(fs.readFileSync('package.json', 'utf8'));
    } catch (error) {
      console.error('❌ Could not load package.json:', error.message);
      process.exit(1);
    }
  }

  async runAudit() {
    console.log('🔍 Running npm security audit...\n');
    
    try {
      // Run npm audit and capture JSON output
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const auditData = JSON.parse(auditOutput);
      this.processAuditResults(auditData);
      
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          this.processAuditResults(auditData);
        } catch (parseError) {
          console.error('❌ Could not parse audit results:', parseError.message);
          return false;
        }
      } else {
        console.error('❌ Audit failed:', error.message);
        return false;
      }
    }
    
    return true;
  }

  processAuditResults(auditData) {
    const { vulnerabilities = {}, metadata = {} } = auditData;
    
    console.log(`📊 Audit Summary:`);
    console.log(`   Total packages: ${metadata.totalDependencies || 'Unknown'}`);
    console.log(`   Vulnerabilities found: ${Object.keys(vulnerabilities).length}\n`);

    // Process each vulnerability
    Object.entries(vulnerabilities).forEach(([packageName, vulnData]) => {
      this.analyzeVulnerability(packageName, vulnData);
    });
  }

  analyzeVulnerability(packageName, vulnData) {
    const { severity, via = [], range, nodes = [] } = vulnData;
    
    // Determine if this affects production or development
    const isProductionDep = this.isProductionDependency(packageName);
    const isCriticalDep = CONFIG.criticalDeps.includes(packageName);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(severity, isProductionDep, isCriticalDep);
    
    const vulnerability = {
      package: packageName,
      severity,
      range,
      isProduction: isProductionDep,
      isCritical: isCriticalDep,
      riskScore,
      advisories: via.filter(v => typeof v === 'object'),
      dependencyPath: nodes.map(n => n.name).join(' → ')
    };
    
    this.vulnerabilities.push(vulnerability);
    this.reportVulnerability(vulnerability);
  }

  isProductionDependency(packageName) {
    const { dependencies = {}, devDependencies = {} } = this.packageJson;
    return packageName in dependencies;
  }

  calculateRiskScore(severity, isProduction, isCritical) {
    const severityScores = {
      'low': 1,
      'moderate': 3,
      'high': 7,
      'critical': 10
    };
    
    let score = severityScores[severity] || 0;
    
    // Multiply by production impact
    if (isProduction) score *= 3;
    if (isCritical) score *= 2;
    
    return Math.min(score, 10); // Cap at 10
  }

  reportVulnerability(vuln) {
    const { package: pkg, severity, riskScore, isProduction, isCritical } = vuln;
    
    // Choose emoji based on risk score
    const riskEmoji = riskScore >= 8 ? '🔴' : riskScore >= 5 ? '🟠' : riskScore >= 3 ? '🟡' : '🟢';
    
    console.log(`${riskEmoji} ${pkg} (${severity.toUpperCase()})`);
    console.log(`   Risk Score: ${riskScore}/10`);
    console.log(`   Type: ${isProduction ? 'Production' : 'Development'} dependency`);
    if (isCritical) console.log(`   ⚠️  CRITICAL SYSTEM DEPENDENCY`);
    
    // Show advisories
    vuln.advisories.forEach(advisory => {
      if (advisory.title) {
        console.log(`   Advisory: ${advisory.title}`);
      }
      if (advisory.url) {
        console.log(`   URL: ${advisory.url}`);
      }
    });
    
    console.log(''); // Empty line for readability
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.vulnerabilities.length,
        byType: {
          production: this.vulnerabilities.filter(v => v.isProduction).length,
          development: this.vulnerabilities.filter(v => !v.isProduction).length
        },
        bySeverity: {
          critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
          high: this.vulnerabilities.filter(v => v.severity === 'high').length,
          moderate: this.vulnerabilities.filter(v => v.severity === 'moderate').length,
          low: this.vulnerabilities.filter(v => v.severity === 'low').length
        },
        highRisk: this.vulnerabilities.filter(v => v.riskScore >= 7).length
      },
      vulnerabilities: this.vulnerabilities
    };

    // Save report to file
    fs.writeFileSync(CONFIG.reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${CONFIG.reportFile}`);
    
    return report;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(50));
    console.log('🛡️  SECURITY ASSESSMENT SUMMARY');
    console.log('='.repeat(50));
    
    const { summary } = report;
    
    console.log(`📦 Total vulnerabilities: ${summary.total}`);
    console.log(`🏭 Production dependencies: ${summary.byType.production}`);
    console.log(`🔧 Development dependencies: ${summary.byType.development}`);
    console.log(`🔴 High risk (score ≥7): ${summary.highRisk}`);
    
    console.log('\n📊 By Severity:');
    Object.entries(summary.bySeverity).forEach(([severity, count]) => {
      if (count > 0) {
        const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'moderate' ? '🟡' : '🟢';
        console.log(`   ${emoji} ${severity}: ${count}`);
      }
    });

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (summary.byType.production > 0) {
      console.log('   🚨 PRIORITY: Fix production dependency vulnerabilities');
    }
    
    if (summary.highRisk > 0) {
      console.log('   ⚠️  Review high-risk vulnerabilities immediately');
    }
    
    if (summary.total === 0) {
      console.log('   ✅ No vulnerabilities found - great job!');
    } else if (summary.byType.production === 0) {
      console.log('   ✅ No production vulnerabilities - development issues can be addressed in next sprint');
    }
    
    console.log('\n🔗 For detailed analysis, see: docs/security-risk-assessment.md');
  }
}

// Main execution
async function main() {
  console.log('🛡️  tutorScotland Security Check\n');
  
  const checker = new SecurityChecker();
  
  const success = await checker.runAudit();
  if (!success) {
    process.exit(1);
  }
  
  const report = checker.generateReport();
  checker.printSummary(report);
  
  // Exit with error code if high-risk vulnerabilities found
  if (report.summary.highRisk > 0) {
    console.log('\n❌ High-risk vulnerabilities detected!');
    process.exit(1);
  }
  
  console.log('\n✅ Security check completed successfully');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Security check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { SecurityChecker, CONFIG };
