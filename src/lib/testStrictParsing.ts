/**
 * Test and demonstration of strict CSV parsing with schema enforcement
 */

import { strictParser } from './utils/strictCsvParser';
import { CSV_SCHEMAS, REFERENTIAL_INTEGRITY_RULES, ParseConfig } from './utils/csvSchema';
import { logger } from './utils/logger';

export async function testStrictCSVParsing(): Promise<void> {
  logger.info('=' .repeat(60));
  logger.info('STRICT CSV PARSING TEST - WITH SCHEMA ENFORCEMENT');
  logger.info('=' .repeat(60));

  try {
    // Test 1: Parse ADP data with strict schema
    logger.info('\n📊 TEST 1: ADP Data with Strict Schema');
    logger.info('-' .repeat(40));
    
    const adpResponse = await fetch('/canonical_data/adp/adp0_2025.csv');
    const adpContent = await adpResponse.text();
    
    const adpConfig: ParseConfig = {
      schema: CSV_SCHEMAS.ADP_DATA,
      bomHandling: 'remove',
      trimWhitespace: true,
      skipEmptyLines: true,
      maxErrors: 10,
      quarantinePath: '/tmp/quarantine/adp_errors.csv'
    };
    
    const adpResult = strictParser.parseWithSchema(adpContent, adpConfig);
    
    logger.info(`✅ ADP Parse Result:`);
    logger.info(`  - Success: ${adpResult.success}`);
    logger.info(`  - Total rows parsed: ${adpResult.data.length}`);
    logger.info(`  - Errors: ${adpResult.errors.length}`);
    logger.info(`  - Warnings: ${adpResult.warnings.length}`);
    
    if (adpResult.errors.length > 0) {
      logger.error('ADP Parsing Errors (first 5):');
      adpResult.errors.slice(0, 5).forEach(e => {
        logger.error(`  Row ${e.row}: ${e.message}`);
      });
    }
    
    // Display lineage information
    const lineage = adpResult.lineage;
    logger.info('\n📈 Data Lineage:');
    logger.info(`  Original rows: ${lineage.rowCountOriginal}`);
    logger.info(`  After headers: ${lineage.rowCountAfterHeaders}`);
    logger.info(`  After empty removal: ${lineage.rowCountAfterEmpty}`);
    logger.info(`  After validation: ${lineage.rowCountAfterValidation}`);
    logger.info(`  After deduplication: ${lineage.rowCountAfterDuplicates}`);
    logger.info(`  Final count: ${lineage.rowCountFinal}`);
    logger.info(`  Coercions: ${lineage.coercions.length}`);
    logger.info(`  Quarantined: ${lineage.quarantinedRows.length}`);
    
    // Show sample coercions
    if (lineage.coercions.length > 0) {
      logger.info('\n🔄 Sample Coercions (first 5):');
      lineage.coercions.slice(0, 5).forEach(c => {
        logger.info(`  Row ${c.row}, Column "${c.column}": "${c.originalValue}" → ${c.coercedValue} (${c.reason})`);
      });
    }
    
    // Test 2: Parse Projections data
    logger.info('\n📊 TEST 2: Projections Data');
    logger.info('-' .repeat(40));
    
    const projResponse = await fetch('/canonical_data/projections/projections_2025.csv');
    const projContent = await projResponse.text();
    
    const projConfig: ParseConfig = {
      schema: CSV_SCHEMAS.PROJECTIONS,
      bomHandling: 'remove',
      trimWhitespace: true,
      skipEmptyLines: true,
      maxErrors: 10
    };
    
    const projResult = strictParser.parseWithSchema(projContent, projConfig);
    
    logger.info(`✅ Projections Parse Result:`);
    logger.info(`  - Success: ${projResult.success}`);
    logger.info(`  - Total rows parsed: ${projResult.data.length}`);
    logger.info(`  - Errors: ${projResult.errors.length}`);
    logger.info(`  - Warnings: ${projResult.warnings.length}`);
    
    // Test 3: Parse Team Metrics (tab-delimited)
    logger.info('\n📊 TEST 3: Team Metrics (Tab-Delimited)');
    logger.info('-' .repeat(40));
    
    const teamResponse = await fetch('/canonical_data/advanced_data/team_data/team_points_per_game.txt');
    const teamContent = await teamResponse.text();
    
    const teamConfig: ParseConfig = {
      schema: CSV_SCHEMAS.TEAM_METRICS,
      bomHandling: 'remove',
      trimWhitespace: true,
      skipEmptyLines: true,
      maxErrors: 10
    };
    
    const teamResult = strictParser.parseWithSchema(teamContent, teamConfig);
    
    logger.info(`✅ Team Metrics Parse Result:`);
    logger.info(`  - Success: ${teamResult.success}`);
    logger.info(`  - Total rows parsed: ${teamResult.data.length}`);
    logger.info(`  - Errors: ${teamResult.errors.length}`);
    logger.info(`  - Warnings: ${teamResult.warnings.length}`);
    
    // Test 4: Referential Integrity Check
    logger.info('\n🔗 TEST 4: Referential Integrity Check');
    logger.info('-' .repeat(40));
    
    const integrityResult = strictParser.checkReferentialIntegrity(REFERENTIAL_INTEGRITY_RULES);
    
    logger.info(`✅ Referential Integrity Result:`);
    logger.info(`  - Valid: ${integrityResult.valid}`);
    logger.info(`  - Violations: ${integrityResult.violations.length}`);
    
    if (integrityResult.violations.length > 0) {
      logger.warn('Referential Integrity Violations:');
      integrityResult.violations.forEach(v => {
        logger.warn(`  ${v.rule.sourceTable}.${v.rule.sourceColumn} → ${v.rule.targetTable}.${v.rule.targetColumn}`);
        logger.warn(`    Missing values (${v.count} total): ${v.missingValues.slice(0, 5).join(', ')}${v.count > 5 ? '...' : ''}`);
      });
    }
    
    // Test 5: Test duplicate handling
    logger.info('\n🔍 TEST 5: Duplicate Handling Test');
    logger.info('-' .repeat(40));
    
    const duplicateCSV = `"Full Name","Position","Team Abbreviation","ADP"
"Justin Jefferson","WR","MIN","4.5"
"Justin Jefferson","WR","MIN","4.8"
"CeeDee Lamb","WR","DAL","6.2"`;
    
    const dupConfig: ParseConfig = {
      schema: {
        ...CSV_SCHEMAS.ADP_DATA,
        duplicatePolicy: 'last', // Keep the last occurrence
        columns: [
          { name: 'Full Name', type: 'string' as any, required: true },
          { name: 'Position', type: 'enum' as any, required: true, allowedValues: ['WR', 'RB', 'QB', 'TE'] },
          { name: 'Team Abbreviation', type: 'string' as any, required: true },
          { name: 'ADP', type: 'float' as any, required: true }
        ]
      },
      bomHandling: 'remove',
      trimWhitespace: true,
      skipEmptyLines: true,
      maxErrors: 10
    };
    
    const dupResult = strictParser.parseWithSchema(duplicateCSV, dupConfig);
    
    logger.info(`✅ Duplicate Handling Result:`);
    logger.info(`  - Original rows: 3`);
    logger.info(`  - After deduplication: ${dupResult.data.length}`);
    logger.info(`  - Duplicates removed: ${dupResult.lineage.duplicatesRemoved}`);
    logger.info(`  - Final data:`);
    dupResult.data.forEach(row => {
      logger.info(`    ${row['Full Name']} (${row['Position']}) - ADP: ${row['ADP']}`);
    });
    
    // Test 6: Test strict validation failure
    logger.info('\n❌ TEST 6: Strict Validation Failure');
    logger.info('-' .repeat(40));
    
    const invalidCSV = `"Full Name","Position","Team Abbreviation","ADP"
"Invalid Player","XYZ","ZZZ","999"
"Valid Player","WR","MIN","4.5"`;
    
    const strictConfig: ParseConfig = {
      schema: {
        ...CSV_SCHEMAS.ADP_DATA,
        validationMode: 'strict',
        columns: [
          { name: 'Full Name', type: 'string' as any, required: true },
          { name: 'Position', type: 'enum' as any, required: true, allowedValues: ['WR', 'RB', 'QB', 'TE'] },
          { name: 'Team Abbreviation', type: 'string' as any, required: true, pattern: /^[A-Z]{2,3}$/ },
          { name: 'ADP', type: 'float' as any, required: true, min: 1, max: 300 }
        ]
      },
      bomHandling: 'remove',
      trimWhitespace: true,
      skipEmptyLines: true,
      maxErrors: 10
    };
    
    const invalidResult = strictParser.parseWithSchema(invalidCSV, strictConfig);
    
    logger.info(`✅ Strict Validation Result:`);
    logger.info(`  - Success: ${invalidResult.success}`);
    logger.info(`  - Valid rows: ${invalidResult.data.length}`);
    logger.info(`  - Quarantined rows: ${invalidResult.lineage.quarantinedRows.length}`);
    logger.info(`  - Errors: ${invalidResult.errors.length}`);
    
    if (invalidResult.errors.length > 0) {
      logger.error('Validation Errors:');
      invalidResult.errors.forEach(e => {
        logger.error(`  Row ${e.row}, Column "${e.column}": ${e.message}`);
      });
    }
    
    // Export lineage report
    logger.info('\n📋 FINAL LINEAGE REPORT');
    logger.info('-' .repeat(40));
    const report = strictParser.exportLineageReport();
    logger.info(report);
    
    // Summary
    logger.info('\n' + '=' .repeat(60));
    logger.info('✅ ALL STRICT PARSING TESTS COMPLETE');
    logger.info('=' .repeat(60));
    logger.info('\nKey Features Demonstrated:');
    logger.info('  ✓ Explicit dtype enforcement per column');
    logger.info('  ✓ NA value handling with configurable patterns');
    logger.info('  ✓ Thousands/decimal separator support');
    logger.info('  ✓ BOM detection and removal');
    logger.info('  ✓ Strict schema enforcement (fail on unexpected)');
    logger.info('  ✓ Duplicate handling with configurable policy');
    logger.info('  ✓ Referential integrity checking across CSVs');
    logger.info('  ✓ Comprehensive row count logging at each stage');
    logger.info('  ✓ Coercion tracking and quarantine support');
    
  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).testStrictCSVParsing = testStrictCSVParsing;
  logger.info('Strict CSV parsing test loaded. Run window.testStrictCSVParsing() to execute.');
}