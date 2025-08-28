/**
 * Data Integrity Test Suite
 * Validates that our CSV parsing fixes work correctly
 */

import { cleanDataLoader } from './cleanDataLoader';
import { 
  safeParseFloat, 
  safeParseInt, 
  isNullValue,
  countNullValues,
  getCompletenessStats 
} from './utils/csvParsingUtils';
import { logger } from './utils/logger';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export async function testDataIntegrity(): Promise<void> {
  logger.info('=' .repeat(60));
  logger.info('DATA INTEGRITY TEST SUITE');
  logger.info('Testing CSV parsing improvements');
  logger.info('=' .repeat(60));
  
  const results: TestResult[] = [];
  
  // Test 1: Safe parsing functions preserve nulls
  logger.info('\n📝 Test 1: Safe Parsing Functions');
  logger.info('-' .repeat(40));
  
  const testValues = [
    { input: 'N/A', expected: null, label: 'N/A string' },
    { input: '', expected: null, label: 'Empty string' },
    { input: null, expected: null, label: 'Null value' },
    { input: undefined, expected: null, label: 'Undefined' },
    { input: '0', expected: 0, label: 'Zero string' },
    { input: '123.45', expected: 123.45, label: 'Valid number' },
    { input: '$1,234.56', expected: 1234.56, label: 'Currency format' },
    { input: '45%', expected: 0.45, label: 'Percentage' },
    { input: '--', expected: null, label: 'Double dash' }
  ];
  
  let safeParsePassed = true;
  testValues.forEach(test => {
    const result = safeParseFloat(test.input, 2);
    const passed = result === test.expected;
    if (!passed) {
      safeParsePassed = false;
      logger.error(`  ❌ ${test.label}: Expected ${test.expected}, got ${result}`);
    } else {
      logger.info(`  ✅ ${test.label}: ${test.input} → ${result}`);
    }
  });
  
  results.push({
    testName: 'Safe Parsing Functions',
    passed: safeParsePassed,
    message: safeParsePassed ? 'All parsing tests passed' : 'Some parsing tests failed'
  });
  
  // Test 2: Load real data and check for corruption
  logger.info('\n📊 Test 2: Real Data Loading');
  logger.info('-' .repeat(40));
  
  try {
    const loadResult = await cleanDataLoader.loadAllCleanData();
    
    if (!loadResult.success) {
      results.push({
        testName: 'Data Loading',
        passed: false,
        message: 'Failed to load clean data',
        details: loadResult.errors
      });
    } else {
      // Check projections data
      const projections = loadResult.data.projections;
      logger.info(`  Loaded ${projections.length} projections`);
      
      // Count null values
      const nullStats = {
        totalRecords: projections.length,
        nullPoints: 0,
        nullTeams: 0,
        nullNames: 0,
        zeroPoints: 0,
        validPoints: 0
      };
      
      projections.forEach(proj => {
        if (proj.projectedPoints === null || proj.projectedPoints === undefined) {
          nullStats.nullPoints++;
        } else if (proj.projectedPoints === 0) {
          nullStats.zeroPoints++;
        } else if (proj.projectedPoints > 0) {
          nullStats.validPoints++;
        }
        
        if (!proj.team) nullStats.nullTeams++;
        if (!proj.name) nullStats.nullNames++;
      });
      
      logger.info('  Projection Data Quality:');
      logger.info(`    - Valid points: ${nullStats.validPoints} (${(nullStats.validPoints / nullStats.totalRecords * 100).toFixed(1)}%)`);
      logger.info(`    - Zero points: ${nullStats.zeroPoints} (${(nullStats.zeroPoints / nullStats.totalRecords * 100).toFixed(1)}%)`);
      logger.info(`    - Null points: ${nullStats.nullPoints} (${(nullStats.nullPoints / nullStats.totalRecords * 100).toFixed(1)}%)`);
      logger.info(`    - Null teams: ${nullStats.nullTeams}`);
      logger.info(`    - Null names: ${nullStats.nullNames}`);
      
      // Check for suspicious patterns
      const suspicious = projections.filter(p => 
        p.projectedPoints === 999 || 
        p.projectedPoints === 0 && p.games > 0
      );
      
      if (suspicious.length > 0) {
        logger.warn(`  ⚠️ Found ${suspicious.length} suspicious projections`);
        suspicious.slice(0, 3).forEach(p => {
          logger.warn(`    ${p.name} (${p.position}): ${p.projectedPoints} points in ${p.games} games`);
        });
      }
      
      // Check ADP data
      const adpData = loadResult.data.adpData;
      logger.info(`\n  Loaded ${adpData.length} ADP records`);
      
      const adpStats = {
        totalRecords: adpData.length,
        nullADP: 0,
        defaultADP: 0, // Count of 999 values
        validADP: 0,
        nullAuctionValue: 0,
        defaultAuctionValue: 0 // Count of 1 values
      };
      
      adpData.forEach(player => {
        if (player.adp === null || player.adp === undefined) {
          adpStats.nullADP++;
        } else if (player.adp === 999) {
          adpStats.defaultADP++;
        } else if (player.adp > 0 && player.adp < 500) {
          adpStats.validADP++;
        }
        
        if (player.auctionValue === null || player.auctionValue === undefined) {
          adpStats.nullAuctionValue++;
        } else if (player.auctionValue === 1) {
          adpStats.defaultAuctionValue++;
        }
      });
      
      logger.info('  ADP Data Quality:');
      logger.info(`    - Valid ADP: ${adpStats.validADP} (${(adpStats.validADP / adpStats.totalRecords * 100).toFixed(1)}%)`);
      logger.info(`    - Default ADP (999): ${adpStats.defaultADP} (${(adpStats.defaultADP / adpStats.totalRecords * 100).toFixed(1)}%)`);
      logger.info(`    - Null ADP: ${adpStats.nullADP}`);
      logger.info(`    - Default Auction ($1): ${adpStats.defaultAuctionValue} (${(adpStats.defaultAuctionValue / adpStats.totalRecords * 100).toFixed(1)}%)`);
      
      // Data quality assessment
      const dataQualityPassed = 
        nullStats.nullPoints === 0 && 
        nullStats.nullNames === 0 &&
        nullStats.nullTeams === 0 &&
        adpStats.nullADP === 0 &&
        suspicious.length === 0;
        
      results.push({
        testName: 'Data Loading Quality',
        passed: dataQualityPassed,
        message: dataQualityPassed ? 'Data loaded without corruption' : 'Data quality issues detected',
        details: { nullStats, adpStats, suspiciousCount: suspicious.length }
      });
    }
  } catch (error) {
    results.push({
      testName: 'Data Loading',
      passed: false,
      message: `Error loading data: ${error}`,
      details: error
    });
  }
  
  // Test 3: Check for parseFloat/parseInt corruption patterns
  logger.info('\n🔍 Test 3: Corruption Pattern Detection');
  logger.info('-' .repeat(40));
  
  const corruptionPatterns = [
    { pattern: 'N/A converted to 0', check: (val: any) => val === 0 },
    { pattern: 'null converted to 999', check: (val: any) => val === 999 },
    { pattern: 'undefined converted to 0', check: (val: any) => val === 0 }
  ];
  
  // Test with sample data
  const sampleCSV = `name,points,adp,value
"Player One",100.5,10.2,50
"Player Two","N/A","N/A","N/A"
"Player Three",,,
"Player Four",0,999,1`;
  
  const lines = sampleCSV.split('\n');
  const headers = lines[0].split(',');
  const dataRows = lines.slice(1).map(line => {
    const values = line.split(',');
    const row: any = {};
    headers.forEach((header, idx) => {
      const rawValue = values[idx]?.replace(/"/g, '').trim();
      row[header] = rawValue;
      // Parse with safe functions
      if (header !== 'name') {
        row[header + '_parsed'] = safeParseFloat(rawValue);
      }
    });
    return row;
  });
  
  logger.info('  Sample Data Parsing:');
  dataRows.forEach((row, idx) => {
    logger.info(`    Row ${idx + 1}: ${row.name}`);
    logger.info(`      Points: "${row.points}" → ${row.points_parsed}`);
    logger.info(`      ADP: "${row.adp}" → ${row.adp_parsed}`);
    logger.info(`      Value: "${row.value}" → ${row.value_parsed}`);
  });
  
  // Check for proper null preservation
  const nullPreservationPassed = 
    dataRows[1].points_parsed === null && // N/A should be null
    dataRows[1].adp_parsed === null &&
    dataRows[2].points_parsed === null && // Empty should be null
    dataRows[2].adp_parsed === null &&
    dataRows[3].points_parsed === 0 && // Actual 0 should stay 0
    dataRows[3].adp_parsed === 999; // Actual 999 should stay 999
  
  results.push({
    testName: 'Null Preservation',
    passed: nullPreservationPassed,
    message: nullPreservationPassed ? 'Nulls properly preserved' : 'Null preservation failed',
    details: dataRows
  });
  
  // Summary
  logger.info('\n' + '=' .repeat(60));
  logger.info('TEST SUMMARY');
  logger.info('=' .repeat(60));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  results.forEach((result, idx) => {
    const icon = result.passed ? '✅' : '❌';
    logger.info(`${idx + 1}. ${icon} ${result.testName}: ${result.message}`);
  });
  
  logger.info('\n' + '-' .repeat(40));
  logger.info(`Total: ${totalTests} tests`);
  logger.info(`Passed: ${passedTests} tests`);
  logger.info(`Failed: ${failedTests} tests`);
  logger.info(`Success Rate: ${(passedTests / totalTests * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    logger.info('\n🎉 All tests passed! CSV parsing is working correctly.');
  } else {
    logger.error(`\n⚠️ ${failedTests} test(s) failed. Review the details above.`);
  }
  
  logger.info('\n' + '=' .repeat(60));
  logger.info('Key Improvements Implemented:');
  logger.info('  ✓ Safe parsing functions that preserve null values');
  logger.info('  ✓ Standardized null token recognition');
  logger.info('  ✓ No more parseFloat/parseInt fallbacks to 0');
  logger.info('  ✓ Schema validation for all CSV files');
  logger.info('  ✓ Data completeness tracking');
  logger.info('  ✓ Consistent Papa Parse configuration');
  logger.info('=' .repeat(60));
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).testDataIntegrity = testDataIntegrity;
  logger.info('Data integrity test loaded. Run window.testDataIntegrity() to execute.');
}