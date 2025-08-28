/**
 * Main entry point for data validation
 * Runs all validation tests and generates comprehensive report
 */

import { quickDataTest } from './quickDataTest';
import { testStrictCSVParsing } from './testStrictParsing';
import { runFullValidation } from './runFullValidation';
import { logger } from './utils/logger';

export async function validateAllData(): Promise<void> {
  logger.info('🚀 Starting comprehensive data validation...\n');
  
  try {
    // Step 1: Quick test of key files
    logger.info('Step 1: Quick parsing test of key files');
    await quickDataTest();
    
    // Step 2: Test strict parsing features
    logger.info('\nStep 2: Testing strict parsing features');
    await testStrictCSVParsing();
    
    // Step 3: Full validation of all files
    logger.info('\nStep 3: Full validation of all CSV files');
    await runFullValidation();
    
    logger.info('\n✅ All validation tests complete!');
    logger.info('Check window.validationReport for detailed results');
    
  } catch (error) {
    logger.error('Validation failed:', error);
    throw error;
  }
}

// Make available in browser
if (typeof window !== 'undefined') {
  (window as any).validateAllData = validateAllData;
  logger.info('Data validation suite loaded. Run window.validateAllData() to validate all CSV parsing.');
}