/**
 * Analyze invalid values in CSV files to understand patterns
 * and determine appropriate handling strategies
 */

import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

interface InvalidValueAnalysis {
  file: string;
  column: string;
  invalidValue: string;
  occurrences: number;
  rows: number[];
  context: {
    playerName?: string;
    position?: string;
    overallRank?: number;
    adp?: number;
  }[];
}

function parseCSV(content: string, delimiter: string = ','): any[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return rows;
}

export async function analyzeInvalidValues(): Promise<void> {
  logger.info('=' .repeat(80));
  logger.info('ANALYZING INVALID VALUES IN CSV FILES');
  logger.info('=' .repeat(80));

  const analysisResults: InvalidValueAnalysis[] = [];

  // Analyze ADP file
  try {
    const adpPath = path.join(process.cwd(), 'canonical_data', 'adp', 'adp0_2025.csv');
    const adpContent = fs.readFileSync(adpPath, 'utf8');
    const adpRows = parseCSV(adpContent);

    // Analyze Auction Value "N/A" patterns
    const auctionNAAnalysis: InvalidValueAnalysis = {
      file: 'adp0_2025.csv',
      column: 'Auction Value',
      invalidValue: 'N/A',
      occurrences: 0,
      rows: [],
      context: []
    };

    // Analyze ADP "null" patterns
    const adpNullAnalysis: InvalidValueAnalysis = {
      file: 'adp0_2025.csv',
      column: 'ADP',
      invalidValue: 'null',
      occurrences: 0,
      rows: [],
      context: []
    };

    adpRows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for header

      // Check Auction Value
      if (row['Auction Value'] === 'N/A' || row['Auction Value'] === 'NA') {
        auctionNAAnalysis.occurrences++;
        auctionNAAnalysis.rows.push(rowNumber);
        auctionNAAnalysis.context.push({
          playerName: row['Full Name'],
          position: row['Position'],
          overallRank: parseInt(row['Overall Rank']) || 0,
          adp: parseFloat(row['ADP']) || 999
        });
      }

      // Check ADP
      if (row['ADP'] === 'null' || row['ADP'] === 'NULL') {
        adpNullAnalysis.occurrences++;
        adpNullAnalysis.rows.push(rowNumber);
        adpNullAnalysis.context.push({
          playerName: row['Full Name'],
          position: row['Position'],
          overallRank: parseInt(row['Overall Rank']) || 0,
          adp: 999 // Since ADP is null
        });
      }
    });

    analysisResults.push(auctionNAAnalysis, adpNullAnalysis);

    // Analyze patterns
    logger.info('\n📊 PATTERN ANALYSIS:');
    logger.info('-' .repeat(40));

    // Auction Value N/A Analysis
    logger.info('\n1. AUCTION VALUE "N/A" PATTERN:');
    logger.info(`   Total occurrences: ${auctionNAAnalysis.occurrences}`);
    
    if (auctionNAAnalysis.context.length > 0) {
      // Check if N/A correlates with high rank numbers (low-value players)
      const avgRank = auctionNAAnalysis.context.reduce((sum, c) => sum + (c.overallRank || 0), 0) / auctionNAAnalysis.context.length;
      logger.info(`   Average Overall Rank: ${avgRank.toFixed(1)}`);
      
      // Check position distribution
      const positionCounts: Record<string, number> = {};
      auctionNAAnalysis.context.forEach(c => {
        positionCounts[c.position || 'Unknown'] = (positionCounts[c.position || 'Unknown'] || 0) + 1;
      });
      logger.info(`   Position distribution:`);
      Object.entries(positionCounts).forEach(([pos, count]) => {
        logger.info(`     - ${pos}: ${count} players`);
      });

      // Sample players with N/A auction value
      logger.info(`   Sample players:`);
      auctionNAAnalysis.context.slice(0, 5).forEach(c => {
        logger.info(`     - ${c.playerName} (${c.position}) - Rank: ${c.overallRank}, ADP: ${c.adp}`);
      });
    }

    // ADP null Analysis
    logger.info('\n2. ADP "null" PATTERN:');
    logger.info(`   Total occurrences: ${adpNullAnalysis.occurrences}`);
    
    if (adpNullAnalysis.context.length > 0) {
      const avgRank = adpNullAnalysis.context.reduce((sum, c) => sum + (c.overallRank || 0), 0) / adpNullAnalysis.context.length;
      logger.info(`   Average Overall Rank: ${avgRank.toFixed(1)}`);
      
      logger.info(`   Sample players:`);
      adpNullAnalysis.context.slice(0, 5).forEach(c => {
        logger.info(`     - ${c.playerName} (${c.position}) - Rank: ${c.overallRank}`);
      });
    }

    // DETERMINATION OF MEANING
    logger.info('\n📋 SEMANTIC ANALYSIS:');
    logger.info('-' .repeat(40));
    
    logger.info('\n1. AUCTION VALUE "N/A":');
    if (avgRank > 150) {
      logger.info('   ✓ Represents: Players with no auction value (undrafted/very low value)');
      logger.info('   ✓ Meaning: These are deep bench or undrafted players');
      logger.info('   ✓ Recommendation: Replace with 0 (zero dollar value)');
    } else {
      logger.info('   ⚠ Unexpected: N/A values for players with good rankings');
      logger.info('   ✓ Recommendation: Interpolate based on ADP');
    }

    logger.info('\n2. ADP "null":');
    logger.info('   ✓ Represents: Players not being drafted in most leagues');
    logger.info('   ✓ Meaning: Undrafted free agents');
    logger.info('   ✓ Recommendation: Replace with 999 (convention for undrafted)');

    // PROPOSED FIXES
    logger.info('\n🔧 PROPOSED FIXES:');
    logger.info('-' .repeat(40));
    
    logger.info('\n1. For Auction Value "N/A":');
    logger.info('   - If Overall Rank > 200: Replace with 0');
    logger.info('   - If Overall Rank <= 200: Calculate based on ADP');
    logger.info('   - Formula: auction_value = max(0, 200 - (ADP * 0.8))');
    
    logger.info('\n2. For ADP "null":');
    logger.info('   - Replace with 999 (standard for undrafted)');
    logger.info('   - This maintains sorting order correctly');

  } catch (error) {
    logger.error('Error analyzing file:', error);
  }

  logger.info('\n' + '=' .repeat(80));
  logger.info('ANALYSIS COMPLETE');
  logger.info('=' .repeat(80));
}

// Export for browser
if (typeof window !== 'undefined') {
  (window as any).analyzeInvalidValues = analyzeInvalidValues;
  logger.info('Invalid value analyzer loaded. Run window.analyzeInvalidValues()');
}