/**
 * Test suite for verifying CSV parsing improvements
 * Tests UTF-8 BOM handling, number parsing, validation, and error recovery
 */

import {
  parseCSVSafe,
  parseNumber,
  parseBoolean,
  parseInteger,
  removeBOM,
  detectDelimiter,
  parseCSVWithDuplicateColumns,
  validateRow,
  logger
} from '@/lib/utils';
import { DataValidator } from './dataValidator';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class CSVParsingTester {
  private results: TestResult[] = [];
  private validator = new DataValidator();

  /**
   * Run all CSV parsing tests
   */
  async runAllTests(): Promise<void> {
    logger.info('Starting CSV Parsing Tests');
    
    // Test BOM handling
    this.testBOMHandling();
    
    // Test number parsing
    this.testNumberParsing();
    
    // Test delimiter detection
    this.testDelimiterDetection();
    
    // Test duplicate column handling
    this.testDuplicateColumnHandling();
    
    // Test validation
    this.testDataValidation();
    
    // Test real CSV files
    await this.testRealCSVFiles();
    
    // Report results
    this.reportResults();
  }

  /**
   * Test UTF-8 BOM removal
   */
  private testBOMHandling(): void {
    const testName = 'UTF-8 BOM Handling';
    try {
      // Test with BOM
      const contentWithBOM = '\uFEFFname,value\ntest,123';
      const cleaned = removeBOM(contentWithBOM);
      
      if (cleaned.startsWith('name')) {
        this.results.push({ testName, passed: true });
      } else {
        this.results.push({ 
          testName, 
          passed: false, 
          error: 'BOM not properly removed' 
        });
      }
      
      // Test parsing with BOM
      const data = parseCSVSafe(contentWithBOM);
      if (data.length === 1 && data[0].name === 'test') {
        this.results.push({ 
          testName: 'BOM CSV Parsing', 
          passed: true 
        });
      } else {
        this.results.push({ 
          testName: 'BOM CSV Parsing', 
          passed: false,
          error: 'Failed to parse CSV with BOM'
        });
      }
    } catch (error) {
      this.results.push({ 
        testName, 
        passed: false, 
        error: String(error) 
      });
    }
  }

  /**
   * Test number parsing with various formats
   */
  private testNumberParsing(): void {
    const testCases = [
      { input: '123', expected: 123 },
      { input: '123.45', expected: 123.45 },
      { input: '1,234.56', expected: 1234.56 },
      { input: '$1,234.56', expected: 1234.56 },
      { input: '45%', expected: 45 },
      { input: '--', expected: undefined },
      { input: 'N/A', expected: undefined },
      { input: '', expected: undefined },
      { input: null, expected: undefined },
      { input: undefined, expected: undefined }
    ];
    
    for (const testCase of testCases) {
      const result = parseNumber(testCase.input);
      const testName = `Number Parsing: ${testCase.input}`;
      
      if (result === testCase.expected) {
        this.results.push({ testName, passed: true });
      } else {
        this.results.push({ 
          testName, 
          passed: false,
          error: `Expected ${testCase.expected}, got ${result}`
        });
      }
    }
  }

  /**
   * Test delimiter detection
   */
  private testDelimiterDetection(): void {
    const testCases = [
      { content: 'a,b,c\n1,2,3', expected: ',' },
      { content: 'a\tb\tc\n1\t2\t3', expected: '\t' },
      { content: 'a;b;c\n1;2;3', expected: ';' },
      { content: 'a|b|c\n1|2|3', expected: '|' }
    ];
    
    for (const testCase of testCases) {
      const detected = detectDelimiter(testCase.content);
      const testName = `Delimiter Detection: ${testCase.expected === '\t' ? 'tab' : testCase.expected}`;
      
      if (detected === testCase.expected) {
        this.results.push({ testName, passed: true });
      } else {
        this.results.push({ 
          testName, 
          passed: false,
          error: `Expected '${testCase.expected}', got '${detected}'`
        });
      }
    }
  }

  /**
   * Test duplicate column handling (FantasyPros format)
   */
  private testDuplicateColumnHandling(): void {
    const testName = 'Duplicate Column Handling';
    try {
      const content = '"Player","YDS","TDS","YDS","TDS"\n"Test Player","100","2","50","1"';
      const data = parseCSVWithDuplicateColumns(content, {
        'YDS': { count: 2, names: ['RUSH_YDS', 'REC_YDS'] },
        'TDS': { count: 2, names: ['RUSH_TDS', 'REC_TDS'] }
      });
      
      if (data.length === 1 && 
          data[0].RUSH_YDS === 100 && 
          data[0].REC_YDS === 50 &&
          data[0].RUSH_TDS === 2 &&
          data[0].REC_TDS === 1) {
        this.results.push({ testName, passed: true });
      } else {
        this.results.push({ 
          testName, 
          passed: false,
          error: 'Duplicate columns not properly renamed',
          details: data[0]
        });
      }
    } catch (error) {
      this.results.push({ 
        testName, 
        passed: false, 
        error: String(error) 
      });
    }
  }

  /**
   * Test data validation
   */
  private testDataValidation(): void {
    // Test row validation
    const validRow = { name: 'Test Player', position: 'WR', team: 'DAL' };
    const invalidRow = { position: 'XYZ' };
    
    if (validateRow(validRow, ['name', 'position'])) {
      this.results.push({ 
        testName: 'Valid Row Validation', 
        passed: true 
      });
    } else {
      this.results.push({ 
        testName: 'Valid Row Validation', 
        passed: false,
        error: 'Valid row failed validation'
      });
    }
    
    if (!validateRow(invalidRow, ['name', 'position'])) {
      this.results.push({ 
        testName: 'Invalid Row Validation', 
        passed: true 
      });
    } else {
      this.results.push({ 
        testName: 'Invalid Row Validation', 
        passed: false,
        error: 'Invalid row passed validation'
      });
    }
    
    // Test enhanced player validation
    const player = {
      name: 'Test Player',
      position: 'WR',
      team: 'DAL',
      projectedPoints: 250,
      auctionValue: 45
    };
    
    const validation = this.validator.validatePlayerEnhanced(player);
    if (validation.isValid && validation.errors.length === 0) {
      this.results.push({ 
        testName: 'Enhanced Player Validation', 
        passed: true 
      });
    } else {
      this.results.push({ 
        testName: 'Enhanced Player Validation', 
        passed: false,
        error: 'Valid player failed enhanced validation',
        details: validation
      });
    }
  }

  /**
   * Test with real CSV files
   */
  private async testRealCSVFiles(): Promise<void> {
    try {
      // Test ADP data
      const adpResponse = await fetch('/canonical_data/adp/adp0_2025.csv');
      const adpContent = await adpResponse.text();
      const adpData = parseCSVSafe(adpContent, undefined, ['Full Name', 'Position']);
      
      if (adpData.length > 0) {
        this.results.push({ 
          testName: 'Real CSV: ADP Data', 
          passed: true,
          details: `Parsed ${adpData.length} rows`
        });
      } else {
        this.results.push({ 
          testName: 'Real CSV: ADP Data', 
          passed: false,
          error: 'No data parsed from ADP file'
        });
      }
      
      // Validate the ADP data
      const adpValidation = this.validator.validateCSVData(
        adpData,
        ['Full Name', 'Position', 'ADP'],
        'ADP Data'
      );
      
      if (adpValidation.isValid) {
        this.results.push({ 
          testName: 'ADP Data Validation', 
          passed: true 
        });
      } else {
        this.results.push({ 
          testName: 'ADP Data Validation', 
          passed: false,
          error: adpValidation.errors.join(', ')
        });
      }
      
    } catch (error) {
      this.results.push({ 
        testName: 'Real CSV Files', 
        passed: false,
        error: String(error)
      });
    }
  }

  /**
   * Report test results
   */
  private reportResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    logger.info('=' .repeat(50));
    logger.info('CSV PARSING TEST RESULTS');
    logger.info('=' .repeat(50));
    logger.info(`Total Tests: ${total}`);
    logger.info(`Passed: ${passed}`);
    logger.info(`Failed: ${failed}`);
    logger.info(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    logger.info('=' .repeat(50));
    
    if (failed > 0) {
      logger.warn('FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          logger.error(`❌ ${r.testName}`, { 
            error: r.error, 
            details: r.details 
          });
        });
    }
    
    logger.info('PASSED TESTS:');
    this.results
      .filter(r => r.passed)
      .forEach(r => {
        logger.info(`✅ ${r.testName}`, r.details ? { details: r.details } : undefined);
      });
  }
}

// Export test runner
export async function runCSVParsingTests(): Promise<void> {
  const tester = new CSVParsingTester();
  await tester.runAllTests();
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - add test button or auto-run
  (window as any).runCSVParsingTests = runCSVParsingTests;
  logger.info('CSV parsing tests loaded. Run window.runCSVParsingTests() to execute.');
}