/**
 * Script to run valuation invariant checks on the full dataset
 * Outputs results to ./reports/invariants.json
 */

import fs from 'fs';
import path from 'path';
import { valuationInvariantChecker } from '../src/lib/valuationInvariantChecker';
import { dataService } from '../src/lib/dataService';

async function runInvariantChecks() {
  console.log('Loading full dataset for invariant analysis...');
  
  try {
    // Load the integrated data using existing service
    const data = await dataService.getData();
    
    const players = data.projections || [];
    console.log(`Loaded ${players.length} players for analysis`);
    
    // Run invariant checks
    console.log('\nRunning valuation invariant checks...');
    const invariantsReport = await valuationInvariantChecker.checkAllInvariants(players);
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Save detailed report to file
    const reportPath = path.join(reportsDir, 'invariants.json');
    fs.writeFileSync(reportPath, JSON.stringify(invariantsReport, null, 2));
    
    // Print summary to console
    const summary = {
      timestamp: new Date().toISOString(),
      totalPlayers: players.length,
      invariants: {
        budgetConservation: {
          passed: invariantsReport.budgetConservation.passed,
          message: invariantsReport.budgetConservation.message
        },
        replacementLevelZeroing: {
          passed: invariantsReport.replacementLevelZeroing.passed,
          violationCount: invariantsReport.replacementLevelZeroing.violations?.length || 0
        },
        nonNegativity: {
          passed: invariantsReport.nonNegativity.passed,
          violationCount: invariantsReport.nonNegativity.violations?.length || 0
        },
        monotonicity: {
          passed: invariantsReport.monotonicity.passed,
          violationCount: invariantsReport.monotonicity.violations?.length || 0
        },
        positionalScarcity: {
          passed: invariantsReport.positionalScarcity.passed,
          message: invariantsReport.positionalScarcity.message
        },
        maxBudgetShare: {
          passed: invariantsReport.maxBudgetShare.passed,
          violationCount: invariantsReport.maxBudgetShare.violations?.length || 0
        }
      },
      reportPath: reportPath,
      allPassed: Object.values(invariantsReport).every(r => r.passed)
    };
    
    console.log('\n' + JSON.stringify(summary, null, 2));
    
    if (!summary.allPassed) {
      console.log('\n⚠️ Some invariants failed. Check the full report at:', reportPath);
      process.exit(1);
    } else {
      console.log('\n✅ All invariants passed!');
    }
    
  } catch (error) {
    console.error('Error running invariant checks:', error);
    process.exit(1);
  }
}

// Run the checks
runInvariantChecks().catch(console.error);