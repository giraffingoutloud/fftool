#!/usr/bin/env tsx

/**
 * Script to generate baseline integrity report for canonical_data
 * Run this to create the initial integrity snapshot
 */

import { integrityChecker } from '../validation/integrityChecker';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

async function main() {
  console.log('='.repeat(60));
  console.log('CANONICAL DATA INTEGRITY BASELINE GENERATOR');
  console.log('='.repeat(60));
  console.log('');
  
  // Ensure reports directory exists
  const reportsDir = '/mnt/c/Users/giraf/Documents/projects/fftool/reports';
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
    console.log(`Created reports directory: ${reportsDir}`);
  }
  
  try {
    // Check current status
    const status = integrityChecker.getIntegrityStatus();
    
    if (status.hasBaseline) {
      console.log(`⚠️  Existing baseline found from: ${status.baselineDate}`);
      console.log('This will overwrite the existing baseline.');
      console.log('');
    }
    
    // Generate baseline
    console.log('Scanning canonical_data directory...');
    const report = integrityChecker.generateBaseline();
    
    // Display summary
    console.log('');
    console.log('📊 BASELINE SUMMARY:');
    console.log('-'.repeat(40));
    console.log(`Total Files: ${report.totalFiles}`);
    console.log(`Total Size: ${(report.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Generated At: ${report.generatedAt}`);
    console.log('');
    
    console.log('Files by Category:');
    for (const [category, count] of Object.entries(report.summary.byCategory)) {
      console.log(`  ${category}: ${count} files`);
    }
    console.log('');
    
    console.log('✅ Baseline integrity report generated successfully!');
    console.log(`📁 Report saved to: ./reports/canonical_data_integrity.json`);
    
  } catch (error) {
    console.error('❌ Failed to generate baseline:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);