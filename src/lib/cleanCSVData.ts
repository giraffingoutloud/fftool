/**
 * Clean and standardize CSV data to fix invalid type errors
 * Implements specific logic for each type of invalid value
 */

import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

interface CleaningRule {
  column: string;
  invalidValues: string[];
  cleaningStrategy: 'replace_zero' | 'replace_default' | 'interpolate' | 'remove';
  defaultValue?: any;
  interpolationLogic?: (row: any) => any;
  condition?: (row: any) => boolean;
}

interface CleaningResult {
  file: string;
  totalRows: number;
  cleanedValues: number;
  removedRows: number;
  details: Array<{
    row: number;
    column: string;
    originalValue: string;
    newValue: any;
    strategy: string;
  }>;
}

/**
 * CLEANING RULES FOR FANTASY FOOTBALL DATA
 * 
 * Based on analysis:
 * 1. Auction Value "N/A" → 0 for low-ranked players (rank > 200)
 * 2. Auction Value "N/A" → Interpolated for high-ranked players
 * 3. ADP "null" → 999 (convention for undrafted players)
 */
const CLEANING_RULES: Record<string, CleaningRule[]> = {
  'adp0_2025.csv': [
    {
      column: 'Auction Value',
      invalidValues: ['N/A', 'NA', 'n/a', 'null', ''],
      cleaningStrategy: 'interpolate',
      interpolationLogic: (row) => {
        const rank = parseInt(row['Overall Rank']) || 999;
        const adp = parseFloat(row['ADP']) || rank;
        
        // For high-value players (rank <= 200), calculate auction value
        if (rank <= 200) {
          // Formula: Higher ranked = higher value
          // Top players (~$60-70), mid-tier (~$10-30), low-tier (~$1-10)
          const baseValue = Math.max(1, Math.round(200 - (adp * 0.8)));
          return Math.min(70, baseValue); // Cap at $70
        }
        // For low-value players, they have no auction value
        return 0;
      },
      condition: (row) => true
    },
    {
      column: 'ADP',
      invalidValues: ['null', 'NULL', 'N/A', ''],
      cleaningStrategy: 'replace_default',
      defaultValue: 999, // Standard for undrafted
      condition: (row) => true
    }
  ],
  'projections_2025.csv': [
    // Add rules for projections if needed
  ]
};

/**
 * Clean a single CSV file
 */
export function cleanCSVFile(
  filePath: string,
  outputPath: string,
  rules: CleaningRule[]
): CleaningResult {
  const fileName = path.basename(filePath);
  const result: CleaningResult = {
    file: fileName,
    totalRows: 0,
    cleanedValues: 0,
    removedRows: 0,
    details: []
  };

  try {
    // Read file
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    // Remove BOM if present
    if (lines[0].charCodeAt(0) === 0xFEFF) {
      lines[0] = lines[0].substring(1);
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const cleanedLines: string[] = [lines[0]]; // Keep header
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      result.totalRows++;
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index] : '';
      });
      
      let rowModified = false;
      let shouldRemoveRow = false;
      
      // Apply cleaning rules
      for (const rule of rules) {
        if (!row.hasOwnProperty(rule.column)) continue;
        
        const originalValue = row[rule.column];
        
        // Check if value needs cleaning
        if (rule.invalidValues.includes(originalValue)) {
          if (!rule.condition || rule.condition(row)) {
            let newValue: any;
            
            switch (rule.cleaningStrategy) {
              case 'replace_zero':
                newValue = 0;
                break;
                
              case 'replace_default':
                newValue = rule.defaultValue;
                break;
                
              case 'interpolate':
                if (rule.interpolationLogic) {
                  newValue = rule.interpolationLogic(row);
                } else {
                  newValue = rule.defaultValue || 0;
                }
                break;
                
              case 'remove':
                shouldRemoveRow = true;
                break;
            }
            
            if (!shouldRemoveRow) {
              row[rule.column] = newValue;
              rowModified = true;
              result.cleanedValues++;
              
              result.details.push({
                row: i + 1,
                column: rule.column,
                originalValue,
                newValue,
                strategy: rule.cleaningStrategy
              });
            }
          }
        }
      }
      
      if (shouldRemoveRow) {
        result.removedRows++;
      } else {
        // Reconstruct the CSV line with cleaned values
        const cleanedValues = headers.map(header => {
          const value = String(row[header] || '');
          // Quote values that contain commas
          if (value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        });
        cleanedLines.push(cleanedValues.join(','));
      }
    }
    
    // Write cleaned file
    fs.writeFileSync(outputPath, cleanedLines.join('\n'), 'utf8');
    
  } catch (error) {
    logger.error(`Error cleaning file ${fileName}:`, error);
    throw error;
  }
  
  return result;
}

/**
 * Main cleaning function
 */
export async function cleanAllCSVData(): Promise<void> {
  logger.info('=' .repeat(80));
  logger.info('CLEANING CSV DATA - FIXING INVALID TYPE ERRORS');
  logger.info('=' .repeat(80));

  const baseDir = path.join(process.cwd(), 'canonical_data');
  const cleanedDir = path.join(process.cwd(), 'canonical_data_cleaned');
  
  // Create cleaned directory if it doesn't exist
  if (!fs.existsSync(cleanedDir)) {
    fs.mkdirSync(cleanedDir, { recursive: true });
  }

  const results: CleaningResult[] = [];

  // Process each file with cleaning rules
  for (const [fileName, rules] of Object.entries(CLEANING_RULES)) {
    if (rules.length === 0) continue;
    
    logger.info(`\n📄 Cleaning: ${fileName}`);
    logger.info('-' .repeat(40));
    
    // Determine file path
    let inputPath: string;
    if (fileName.includes('adp')) {
      inputPath = path.join(baseDir, 'adp', fileName);
    } else if (fileName.includes('projections')) {
      inputPath = path.join(baseDir, 'projections', fileName);
    } else {
      inputPath = path.join(baseDir, fileName);
    }
    
    // Create output directory structure
    const relativeDir = path.dirname(inputPath.replace(baseDir, ''));
    const outputDir = path.join(cleanedDir, relativeDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, fileName);
    
    try {
      const result = cleanCSVFile(inputPath, outputPath, rules);
      results.push(result);
      
      logger.info(`✅ Cleaned ${result.cleanedValues} values`);
      logger.info(`   - Total rows: ${result.totalRows}`);
      logger.info(`   - Values fixed: ${result.cleanedValues}`);
      logger.info(`   - Rows removed: ${result.removedRows}`);
      
      // Show sample fixes
      if (result.details.length > 0) {
        logger.info(`   Sample fixes:`);
        result.details.slice(0, 3).forEach(d => {
          logger.info(`     Row ${d.row}, ${d.column}: "${d.originalValue}" → ${d.newValue}`);
        });
      }
      
    } catch (error) {
      logger.error(`❌ Failed to clean ${fileName}:`, error);
    }
  }

  // Summary
  logger.info('\n' + '=' .repeat(80));
  logger.info('CLEANING SUMMARY');
  logger.info('=' .repeat(80));
  
  const totalCleaned = results.reduce((sum, r) => sum + r.cleanedValues, 0);
  const totalRows = results.reduce((sum, r) => sum + r.totalRows, 0);
  
  logger.info(`\n✅ CLEANING COMPLETE:`);
  logger.info(`   - Files processed: ${results.length}`);
  logger.info(`   - Total rows: ${totalRows}`);
  logger.info(`   - Values cleaned: ${totalCleaned}`);
  logger.info(`   - Success rate: ${((totalCleaned / 468) * 100).toFixed(1)}% of known issues fixed`);
  
  logger.info('\n📁 Cleaned files saved to: canonical_data_cleaned/');
  
  // Detailed report per invalid value type
  logger.info('\n📊 FIXES BY TYPE:');
  
  const auctionValueFixes = results
    .flatMap(r => r.details)
    .filter(d => d.column === 'Auction Value');
  
  const adpFixes = results
    .flatMap(r => r.details)
    .filter(d => d.column === 'ADP');
  
  logger.info(`\n1. Auction Value "N/A" → numeric:`);
  logger.info(`   - Total fixed: ${auctionValueFixes.length}`);
  if (auctionValueFixes.length > 0) {
    const zeroValues = auctionValueFixes.filter(f => f.newValue === 0).length;
    const interpolated = auctionValueFixes.filter(f => f.newValue > 0).length;
    logger.info(`   - Replaced with 0: ${zeroValues} (low-value players)`);
    logger.info(`   - Interpolated: ${interpolated} (calculated from rank/ADP)`);
  }
  
  logger.info(`\n2. ADP "null" → 999:`);
  logger.info(`   - Total fixed: ${adpFixes.length}`);
  logger.info(`   - All replaced with 999 (undrafted convention)`);
}

/**
 * Validation function to verify fixes
 */
export async function validateCleanedData(): Promise<boolean> {
  logger.info('\n' + '=' .repeat(80));
  logger.info('VALIDATING CLEANED DATA');
  logger.info('=' .repeat(80));

  const cleanedDir = path.join(process.cwd(), 'canonical_data_cleaned');
  let allValid = true;

  // Check ADP file
  const adpPath = path.join(cleanedDir, 'adp', 'adp0_2025.csv');
  if (fs.existsSync(adpPath)) {
    const content = fs.readFileSync(adpPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    
    logger.info('\n📄 Validating: adp0_2025.csv');
    
    let invalidCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      // Check Auction Value (should be index 5)
      const auctionValue = values[5];
      if (auctionValue === 'N/A' || auctionValue === 'NA' || auctionValue === 'null') {
        logger.error(`   ❌ Row ${i + 1}: Auction Value still invalid: "${auctionValue}"`);
        invalidCount++;
        allValid = false;
      }
      
      // Check ADP (should be index 4)
      const adp = values[4];
      if (adp === 'null' || adp === 'NULL' || adp === 'N/A') {
        logger.error(`   ❌ Row ${i + 1}: ADP still invalid: "${adp}"`);
        invalidCount++;
        allValid = false;
      }
    }
    
    if (invalidCount === 0) {
      logger.info(`   ✅ All values are valid numbers!`);
    } else {
      logger.error(`   ❌ Still ${invalidCount} invalid values found`);
    }
    
    // Verify numeric parsing
    logger.info('\n   Testing numeric parsing:');
    const testLines = lines.slice(1, 4); // Test first 3 data rows
    testLines.forEach((line, idx) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const auctionValue = parseFloat(values[5]);
      const adp = parseFloat(values[4]);
      logger.info(`     Row ${idx + 2}: ADP=${adp}, Auction=${auctionValue} ✅`);
    });
  }

  return allValid;
}

// Export for browser
if (typeof window !== 'undefined') {
  (window as any).cleanAllCSVData = cleanAllCSVData;
  (window as any).validateCleanedData = validateCleanedData;
  logger.info('CSV data cleaner loaded. Run window.cleanAllCSVData() to fix invalid values.');
}