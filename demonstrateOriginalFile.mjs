import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NULL-preserving parser that works directly with original data
function parseOriginalWithNulls(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];
  
  // Values that mean "missing data"
  const missingPatterns = ['N/A', 'NA', 'n/a', 'null', 'NULL', '', '-', '--'];

  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    
    headers.forEach((header, index) => {
      const rawValue = values[index] || '';
      
      // For numeric columns, convert missing values to null
      if (header === 'ADP' || header === 'Auction Value') {
        if (missingPatterns.includes(rawValue)) {
          row[header] = null;
        } else {
          const parsed = parseFloat(rawValue);
          row[header] = isNaN(parsed) ? null : parsed;
        }
      } else if (header === 'Overall Rank') {
        row[header] = parseInt(rawValue) || i; // Use row as fallback
      } else {
        // String columns - preserve as-is
        row[header] = rawValue;
      }
    });
    
    data.push(row);
  }
  
  return data;
}

// Analysis functions that handle nulls properly
const Analysis = {
  average(values) {
    const valid = values.filter(v => v !== null && v !== undefined);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  },
  
  count(values) {
    return values.filter(v => v !== null && v !== undefined).length;
  },
  
  completeness(values) {
    const valid = this.count(values);
    return ((valid / values.length) * 100).toFixed(1) + '%';
  }
};

async function demonstrateOriginalFile() {
  console.log('=' .repeat(80));
  console.log('USING ORIGINAL FILE DIRECTLY - NO CLEANING NEEDED!');
  console.log('=' .repeat(80));

  // Load ORIGINAL file (not cleaned)
  const originalFile = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const originalContent = fs.readFileSync(originalFile, 'utf8');
  
  // Parse with null preservation
  const data = parseOriginalWithNulls(originalContent);
  
  console.log('\n✅ PARSING ORIGINAL FILE DIRECTLY');
  console.log('-' .repeat(40));
  console.log(`File: canonical_data/adp/adp0_2025.csv (ORIGINAL)`);
  console.log(`Total players: ${data.length}`);
  
  // Check data completeness
  const adpValues = data.map(p => p['ADP']);
  const auctionValues = data.map(p => p['Auction Value']);
  
  console.log(`\n📊 DATA COMPLETENESS:`);
  console.log(`  ADP data: ${Analysis.count(adpValues)}/${data.length} (${Analysis.completeness(adpValues)})`);
  console.log(`  Auction data: ${Analysis.count(auctionValues)}/${data.length} (${Analysis.completeness(auctionValues)})`);
  
  // Calculate real statistics
  console.log(`\n📈 REAL STATISTICS (nulls properly excluded):`);
  console.log(`  Average ADP: ${Analysis.average(adpValues)?.toFixed(1) || 'N/A'}`);
  console.log(`  Average Auction Value: $${Analysis.average(auctionValues)?.toFixed(2) || 'N/A'}`);
  
  // Show sample data with nulls preserved
  console.log('\n🔍 SAMPLE DATA (showing null preservation):');
  const samples = [112, 131, 146, 147, 194]; // Rows with known N/A or null values
  
  samples.forEach(idx => {
    const player = data[idx];
    console.log(`\n  ${player['Full Name']} (${player['Position']})`);
    console.log(`    ADP: ${player['ADP'] !== null ? player['ADP'] : 'null (missing)'}`);
    console.log(`    Auction: ${player['Auction Value'] !== null ? '$' + player['Auction Value'] : 'null (missing)'}`);
  });
  
  // Show how to use in analysis
  console.log('\n💡 HOW TO USE IN YOUR CODE:');
  console.log('-' .repeat(40));
  
  console.log('\nExample 1: Calculate average for position');
  const qbs = data.filter(p => p.Position === 'QB');
  const qbAuctions = qbs.map(p => p['Auction Value']);
  console.log(`  QBs with auction data: ${Analysis.count(qbAuctions)}/${qbs.length}`);
  console.log(`  QB average auction: $${Analysis.average(qbAuctions)?.toFixed(2) || 'N/A'}`);
  
  console.log('\nExample 2: Get only complete records');
  const completeRecords = data.filter(p => 
    p['ADP'] !== null && p['Auction Value'] !== null
  );
  console.log(`  Players with complete data: ${completeRecords.length}`);
  
  console.log('\nExample 3: VORP calculation (only on valid data)');
  const playersWithValue = data.filter(p => p['Auction Value'] !== null);
  const baseline = playersWithValue[100]?.['Auction Value'] || 0;
  const withVORP = playersWithValue.map(p => ({
    ...p,
    vorp: Math.max(0, p['Auction Value'] - baseline)
  }));
  console.log(`  VORP calculated for: ${withVORP.length} players (with auction values)`);
  console.log(`  Skipped: ${data.length - withVORP.length} players (no auction values)`);
  
  console.log('\n' + '=' .repeat(80));
  console.log('BENEFITS OF USING ORIGINAL FILE:');
  console.log('=' .repeat(80));
  
  console.log('\n✅ No need for "cleaned" file');
  console.log('✅ No fake data pollution');
  console.log('✅ Single source of truth');
  console.log('✅ Transparent about missing data');
  console.log('✅ Accurate statistics');
  console.log('✅ Follows best practices');
  
  console.log('\n📝 MIGRATION PATH:');
  console.log('1. Update parser to preserve nulls (like above)');
  console.log('2. Update analysis functions to handle nulls');
  console.log('3. Delete the "cleaned" file - not needed!');
  console.log('4. Point all code to original file');
  
  console.log('\n🎯 SIMPLE RULE:');
  console.log('If value is "N/A" or "null" → parse as null');
  console.log('If calculating statistics → filter out nulls first');
  console.log('Never create fake data!');
}

// Run demonstration
demonstrateOriginalFile().catch(console.error);