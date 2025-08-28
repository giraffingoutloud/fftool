#!/usr/bin/env tsx

/**
 * Script to verify canonical_data integrity against baseline
 * Run this before and after any data processing pipeline
 */

import { integrityChecker } from '../validation/integrityChecker';

async function main() {
  console.log('='.repeat(60));
  console.log('CANONICAL DATA INTEGRITY VERIFICATION');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // Check status
    const status = integrityChecker.getIntegrityStatus();
    
    if (!status.hasBaseline) {
      console.error('❌ No baseline integrity report found!');
      console.error('Run: npm run integrity:baseline');
      process.exit(1);
    }
    
    console.log(`📊 Baseline Date: ${status.baselineDate}`);
    if (status.lastCheckDate) {
      console.log(`📊 Last Check: ${status.lastCheckDate} (${status.isValid ? 'PASSED' : 'FAILED'})`);
    }
    console.log('');
    
    console.log('Verifying integrity...');
    const result = integrityChecker.verifyIntegrity();
    
    console.log('-'.repeat(40));
    
    if (result.isValid) {
      console.log('✅ INTEGRITY CHECK PASSED');
      console.log('All canonical_data files are unchanged.');
    } else {
      console.log('❌ INTEGRITY CHECK FAILED');
      console.log('');
      
      if (result.changedFiles.length > 0) {
        console.log('🔴 Modified Files:');
        result.changedFiles.forEach(f => console.log(`   - ${f}`));
      }
      
      if (result.missingFiles.length > 0) {
        console.log('🔴 Missing Files:');
        result.missingFiles.forEach(f => console.log(`   - ${f}`));
      }
      
      console.log('');
      console.log('PIPELINE HALTED: Canonical data must remain immutable!');
      process.exit(1);
    }
    
    if (result.warnings.length > 0) {
      console.log('');
      console.log('⚠️  Warnings:');
      result.warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    if (result.newFiles.length > 0) {
      console.log('');
      console.log('📝 New Files Detected:');
      result.newFiles.forEach(f => console.log(`   - ${f}`));
      console.log('   (Consider regenerating baseline if these are expected)');
    }
    
    console.log('');
    console.log('Check complete.');
    
  } catch (error) {
    console.error('❌ Integrity verification failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);