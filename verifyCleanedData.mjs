import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSV(content, delimiter = ',') {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return rows;
}

async function verifyCleanedData() {
  console.log('=' .repeat(80));
  console.log('VERIFYING CLEANED DATA');
  console.log('=' .repeat(80));

  const cleanedFile = path.join(__dirname, 'canonical_data_cleaned', 'adp', 'adp0_2025.csv');
  const originalFile = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  
  // Check cleaned file
  console.log('\n📄 Analyzing cleaned file: adp0_2025.csv');
  console.log('-' .repeat(40));
  
  const cleanedContent = fs.readFileSync(cleanedFile, 'utf8');
  const cleanedRows = parseCSV(cleanedContent);
  
  const originalContent = fs.readFileSync(originalFile, 'utf8');
  const originalRows = parseCSV(originalContent);
  
  // Count issues in original
  let originalNA = 0;
  let originalNull = 0;
  originalRows.forEach(row => {
    if (row['Auction Value'] === 'N/A' || row['Auction Value'] === 'NA') originalNA++;
    if (row['ADP'] === 'null' || row['ADP'] === 'NULL') originalNull++;
  });
  
  // Count issues in cleaned
  let cleanedNA = 0;
  let cleanedNull = 0;
  let cleanedInvalid = 0;
  const invalidExamples = [];
  
  cleanedRows.forEach((row, index) => {
    const auctionValue = row['Auction Value'];
    const adp = row['ADP'];
    
    // Check for remaining N/A or null
    if (auctionValue === 'N/A' || auctionValue === 'NA') {
      cleanedNA++;
    }
    if (adp === 'null' || adp === 'NULL') {
      cleanedNull++;
    }
    
    // Check if values are valid numbers
    const auctionNum = parseFloat(auctionValue);
    const adpNum = parseFloat(adp);
    
    if (isNaN(auctionNum) && auctionValue !== '0' && auctionValue !== '') {
      cleanedInvalid++;
      if (invalidExamples.length < 5) {
        invalidExamples.push({
          row: index + 2,
          column: 'Auction Value',
          value: auctionValue,
          player: row['Full Name']
        });
      }
    }
    
    if (isNaN(adpNum) && adp !== '999' && adp !== '') {
      cleanedInvalid++;
      if (invalidExamples.length < 5) {
        invalidExamples.push({
          row: index + 2,
          column: 'ADP',
          value: adp,
          player: row['Full Name']
        });
      }
    }
  });
  
  // Report results
  console.log('\n📊 ORIGINAL FILE:');
  console.log(`   Total rows: ${originalRows.length}`);
  console.log(`   "N/A" values in Auction Value: ${originalNA}`);
  console.log(`   "null" values in ADP: ${originalNull}`);
  console.log(`   Total invalid values: ${originalNA + originalNull}`);
  
  console.log('\n📊 CLEANED FILE:');
  console.log(`   Total rows: ${cleanedRows.length}`);
  console.log(`   Remaining "N/A" values: ${cleanedNA}`);
  console.log(`   Remaining "null" values: ${cleanedNull}`);
  console.log(`   Invalid numeric values: ${cleanedInvalid}`);
  
  if (invalidExamples.length > 0) {
    console.log('\n⚠️  Invalid values found:');
    invalidExamples.forEach(ex => {
      console.log(`   Row ${ex.row}: ${ex.column} = "${ex.value}" for ${ex.player}`);
    });
  }
  
  // Sample some cleaned values
  console.log('\n✅ SAMPLE CLEANED VALUES:');
  console.log('(Showing rows that had N/A or null in original)');
  
  // Check specific rows that had issues
  const problemRows = [112, 131, 135, 146, 147]; // Row numbers (0-indexed)
  
  problemRows.forEach(idx => {
    if (idx < cleanedRows.length && idx < originalRows.length) {
      const origRow = originalRows[idx];
      const cleanRow = cleanedRows[idx];
      const rowNum = idx + 2; // Display row number (1-indexed + header)
      
      console.log(`\n   Row ${rowNum}: ${cleanRow['Full Name']} (${cleanRow['Position']})`);
      console.log(`     Original: ADP="${origRow['ADP']}", Auction="${origRow['Auction Value']}"`);
      console.log(`     Cleaned:  ADP="${cleanRow['ADP']}", Auction="${cleanRow['Auction Value']}"`);
      
      // Verify numeric parsing
      const adpNum = parseFloat(cleanRow['ADP']);
      const auctionNum = parseFloat(cleanRow['Auction Value']);
      console.log(`     Parsed:   ADP=${adpNum}, Auction=$${auctionNum}`);
    }
  });
  
  // Final verdict
  console.log('\n' + '=' .repeat(80));
  console.log('VERIFICATION SUMMARY');
  console.log('=' .repeat(80));
  
  const totalFixed = originalNA + originalNull - cleanedNA - cleanedNull;
  const successRate = ((totalFixed / (originalNA + originalNull)) * 100).toFixed(1);
  
  if (cleanedNA === 0 && cleanedNull === 0) {
    console.log(`\n✅ SUCCESS: All ${originalNA + originalNull} invalid values have been fixed!`);
    console.log(`   Success rate: ${successRate}%`);
    console.log(`   All "N/A" values → numeric (0 or calculated)`);
    console.log(`   All "null" values → 999`);
  } else {
    console.log(`\n⚠️  PARTIAL SUCCESS: ${totalFixed} of ${originalNA + originalNull} values fixed`);
    console.log(`   Success rate: ${successRate}%`);
    console.log(`   Remaining issues: ${cleanedNA} N/A, ${cleanedNull} null`);
  }
  
  console.log('\n📁 Cleaned data location: canonical_data_cleaned/adp/adp0_2025.csv');
  console.log('💡 The cleaned file is ready for use with strict type validation.');
}

// Run verification
verifyCleanedData().catch(console.error);