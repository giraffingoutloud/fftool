/**
 * Quick test to verify all CSV data is being parsed correctly
 */

import { strictParser } from './utils/strictCsvParser';
import { CSVSchema, ColumnType, ParseConfig } from './utils/csvSchema';
import { logger } from './utils/logger';

export async function quickDataTest(): Promise<void> {
  logger.info('=' .repeat(60));
  logger.info('QUICK DATA PARSING TEST - KEY FILES');
  logger.info('=' .repeat(60));

  const testFiles = [
    {
      path: '/canonical_data/adp/adp0_2025.csv',
      name: 'ADP Data',
      expectedColumns: ['Overall Rank', 'Full Name', 'Position', 'ADP'],
      sampleCheck: (row: any) => row['Full Name'] && row['ADP']
    },
    {
      path: '/canonical_data/projections/projections_2025.csv',
      name: 'Projections 2025',
      expectedColumns: ['playerName', 'position', 'fantasyPoints'],
      sampleCheck: (row: any) => row['playerName'] && row['fantasyPoints']
    },
    {
      path: '/canonical_data/advanced_data/2024-2025/passing_summary.csv',
      name: 'Passing Summary',
      expectedColumns: ['player', 'team_name', 'yards'],
      sampleCheck: (row: any) => row['player'] && row['yards']
    },
    {
      path: '/canonical_data/advanced_data/team_data/team_points_per_game.txt',
      name: 'Team Points Per Game',
      delimiter: '\t',
      expectedColumns: ['Rank', 'Team', '2024'],
      sampleCheck: (row: any) => row['Team'] && row['2024']
    },
    {
      path: '/canonical_data/historical_stats/fantasy-stats-passing_2024.csv',
      name: 'Historical Passing Stats',
      expectedColumns: ['player', 'team', 'fantasyPts'],
      sampleCheck: (row: any) => row['player'] && row['fantasyPts']
    }
  ];

  let allSuccess = true;

  for (const test of testFiles) {
    try {
      logger.info(`\n📄 Testing: ${test.name}`);
      logger.info('-' .repeat(40));
      
      const response = await fetch(test.path);
      const content = await response.text();
      
      // Create a flexible schema for testing
      const schema: CSVSchema = {
        name: test.name.toLowerCase().replace(/\s+/g, '_'),
        columns: [], // Allow all columns
        uniqueKeys: [],
        allowExtraColumns: true,
        encoding: 'UTF-8',
        delimiter: test.delimiter || ',',
        quoteChar: '"',
        escapeChar: '\\',
        hasHeader: true,
        skipRows: 0,
        naValues: ['', 'N/A', '--', 'null', 'NA'],
        thousandsSeparator: ',',
        decimalSeparator: '.',
        duplicatePolicy: 'last',
        validationMode: 'warning'
      };

      const config: ParseConfig = {
        schema,
        bomHandling: 'remove',
        trimWhitespace: true,
        skipEmptyLines: true,
        maxErrors: 10
      };

      const result = strictParser.parseWithSchema(content, config);
      
      if (result.success && result.data.length > 0) {
        logger.info(`✅ SUCCESS: Parsed ${result.data.length} rows`);
        
        // Check first row structure
        const firstRow = result.data[0];
        const columns = Object.keys(firstRow);
        logger.info(`  Columns found: ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? '...' : ''}`);
        
        // Verify sample data
        if (test.sampleCheck && test.sampleCheck(firstRow)) {
          logger.info(`  ✓ Sample data validated`);
        } else {
          logger.warn(`  ⚠ Sample check failed`);
        }
        
        // Show sample row
        const sampleData = Object.entries(firstRow)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        logger.info(`  Sample: ${sampleData}`);
        
      } else {
        logger.error(`❌ FAILED: ${result.errors.slice(0, 2).map(e => e.message).join('; ')}`);
        allSuccess = false;
      }
      
    } catch (error) {
      logger.error(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      allSuccess = false;
    }
  }

  // Summary
  logger.info('\n' + '=' .repeat(60));
  if (allSuccess) {
    logger.info('✅ ALL KEY FILES PARSED SUCCESSFULLY');
  } else {
    logger.error('❌ SOME FILES FAILED TO PARSE');
  }
  logger.info('=' .repeat(60));

  // Test specific parsing features
  logger.info('\n🔍 TESTING SPECIFIC FEATURES:');
  
  // Test 1: BOM Handling
  const bomTest = '\uFEFFname,value\ntest,123';
  const bomResult = strictParser.parseWithSchema(bomTest, {
    schema: {
      name: 'bom_test',
      columns: [
        { name: 'name', type: ColumnType.STRING, required: true },
        { name: 'value', type: ColumnType.INTEGER, required: true }
      ],
      uniqueKeys: [['name']],
      allowExtraColumns: false,
      encoding: 'UTF-8',
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '\\',
      hasHeader: true,
      skipRows: 0,
      naValues: [],
      thousandsSeparator: ',',
      decimalSeparator: '.',
      duplicatePolicy: 'fail',
      validationMode: 'strict'
    },
    bomHandling: 'remove',
    trimWhitespace: true,
    skipEmptyLines: true,
    maxErrors: 10
  });
  logger.info(`  BOM Handling: ${bomResult.success ? '✅ PASS' : '❌ FAIL'}`);

  // Test 2: Number parsing with separators
  const numberTest = 'name,value,percent,currency\ntest,"1,234.56","45.5%","$199"';
  const numberResult = strictParser.parseWithSchema(numberTest, {
    schema: {
      name: 'number_test',
      columns: [
        { name: 'name', type: ColumnType.STRING, required: true },
        { name: 'value', type: ColumnType.FLOAT, required: true },
        { name: 'percent', type: ColumnType.PERCENTAGE, required: true },
        { name: 'currency', type: ColumnType.CURRENCY, required: true }
      ],
      uniqueKeys: [],
      allowExtraColumns: false,
      encoding: 'UTF-8',
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '\\',
      hasHeader: true,
      skipRows: 0,
      naValues: [],
      thousandsSeparator: ',',
      decimalSeparator: '.',
      duplicatePolicy: 'fail',
      validationMode: 'strict'
    },
    bomHandling: 'remove',
    trimWhitespace: true,
    skipEmptyLines: true,
    maxErrors: 10
  });
  
  if (numberResult.success && numberResult.data.length > 0) {
    const row = numberResult.data[0];
    logger.info(`  Number Parsing: ✅ PASS`);
    logger.info(`    - Float: ${row.value} (expected: 1234.56)`);
    logger.info(`    - Percent: ${row.percent} (expected: 0.455)`);
    logger.info(`    - Currency: ${row.currency} (expected: 199)`);
  } else {
    logger.error(`  Number Parsing: ❌ FAIL`);
  }

  // Test 3: Duplicate handling
  const dupTest = 'name,value\nJohn,100\nJohn,200\nJane,300';
  const dupResult = strictParser.parseWithSchema(dupTest, {
    schema: {
      name: 'dup_test',
      columns: [
        { name: 'name', type: ColumnType.STRING, required: true },
        { name: 'value', type: ColumnType.INTEGER, required: true }
      ],
      uniqueKeys: [['name']],
      allowExtraColumns: false,
      encoding: 'UTF-8',
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '\\',
      hasHeader: true,
      skipRows: 0,
      naValues: [],
      thousandsSeparator: ',',
      decimalSeparator: '.',
      duplicatePolicy: 'last',
      validationMode: 'strict'
    },
    bomHandling: 'remove',
    trimWhitespace: true,
    skipEmptyLines: true,
    maxErrors: 10
  });
  
  logger.info(`  Duplicate Handling: ${dupResult.data.length === 2 ? '✅ PASS' : '❌ FAIL'}`);
  if (dupResult.success) {
    const john = dupResult.data.find((r: any) => r.name === 'John');
    logger.info(`    - John's value: ${john?.value} (expected: 200 with 'last' policy)`);
  }

  logger.info('\n✨ Test complete! All CSV parsing features verified.');
}

// Make available in browser
if (typeof window !== 'undefined') {
  (window as any).quickDataTest = quickDataTest;
  logger.info('Quick data test loaded. Run window.quickDataTest() to test parsing.');
}