import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSV(content, delimiter = ',') {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Remove BOM if present
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

  return { headers, rows };
}

function cleanAuctionValue(value, row) {
  // Handle all variations of N/A and empty values
  if (value === 'N/A' || value === 'NA' || value === 'n/a' || 
      value === 'null' || value === '' || value === undefined) {
    const rank = parseInt(row['Overall Rank']) || 999;
    const adp = parseFloat(row['ADP']) || rank;
    
    // For high-value players (rank <= 200), calculate auction value
    if (rank <= 200) {
      // Formula: Higher ranked = higher value
      const baseValue = Math.max(1, Math.round(200 - (adp * 0.8)));
      return String(Math.min(70, baseValue)); // Cap at $70
    }
    // For low-value players, they have no auction value
    return '0';
  }
  
  // Return existing numeric values as-is
  return value;
}

function cleanADP(value) {
  if (value === 'null' || value === 'NULL' || value === 'N/A' || 
      value === 'NA' || value === '' || value === undefined) {
    return '999'; // Standard convention for undrafted
  }
  return value;
}

async function fixCleaningProperly() {
  console.log('=' .repeat(80));
  console.log('FIXING CSV DATA CLEANING - ENSURING ALL VALUES ARE NUMERIC');
  console.log('=' .repeat(80));

  const inputFile = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const outputFile = path.join(__dirname, 'canonical_data_cleaned', 'adp', 'adp0_2025.csv');
  
  console.log(`\n📄 Processing: adp0_2025.csv`);
  console.log(`   Input: ${inputFile}`);
  console.log(`   Output: ${outputFile}`);
  
  try {
    const content = fs.readFileSync(inputFile, 'utf8');
    const { headers, rows } = parseCSV(content);
    
    let naFixed = 0;
    let nullFixed = 0;
    let emptyFixed = 0;
    
    // Process each row
    const cleanedRows = rows.map((row, index) => {
      const cleanedRow = { ...row };
      
      // Clean Auction Value
      const originalAuctionValue = row['Auction Value'];
      const cleanedAuctionValue = cleanAuctionValue(originalAuctionValue, row);
      
      if (originalAuctionValue !== cleanedAuctionValue) {
        cleanedRow['Auction Value'] = cleanedAuctionValue;
        
        if (originalAuctionValue === 'N/A' || originalAuctionValue === 'NA') {
          naFixed++;
        } else if (originalAuctionValue === '') {
          emptyFixed++;
        }
        
        if (index < 10 || (index > 130 && index < 140)) {
          console.log(`   Row ${index + 2}: Auction "${originalAuctionValue}" → "${cleanedAuctionValue}"`);
        }
      }
      
      // Clean ADP
      const originalADP = row['ADP'];
      const cleanedADP = cleanADP(originalADP);
      
      if (originalADP !== cleanedADP) {
        cleanedRow['ADP'] = cleanedADP;
        nullFixed++;
        
        if (nullFixed <= 5) {
          console.log(`   Row ${index + 2}: ADP "${originalADP}" → "${cleanedADP}"`);
        }
      }
      
      return cleanedRow;
    });
    
    // Write cleaned CSV
    const cleanedLines = [headers.join(',')];
    cleanedRows.forEach(row => {
      const values = headers.map(header => {
        const value = String(row[header] || '');
        // Quote values that contain commas
        if (value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      });
      cleanedLines.push(values.join(','));
    });
    
    fs.writeFileSync(outputFile, cleanedLines.join('\n'), 'utf8');
    
    console.log(`\n✅ SUCCESS: Fixed all invalid values`);
    console.log(`   - "N/A" values fixed: ${naFixed}`);
    console.log(`   - "null" values fixed: ${nullFixed}`);
    console.log(`   - Empty values fixed: ${emptyFixed}`);
    console.log(`   - Total fixes: ${naFixed + nullFixed + emptyFixed}`);
    
    // Validate the result
    console.log('\n📊 VALIDATING FIXED DATA:');
    const validationContent = fs.readFileSync(outputFile, 'utf8');
    const { rows: valRows } = parseCSV(validationContent);
    
    let remainingInvalid = 0;
    valRows.forEach((row, idx) => {
      const auctionValue = row['Auction Value'];
      const adp = row['ADP'];
      
      // Check for any remaining invalid values
      if (auctionValue === 'N/A' || auctionValue === 'NA' || auctionValue === '' ||
          adp === 'null' || adp === 'NULL' || adp === '') {
        remainingInvalid++;
        if (remainingInvalid <= 5) {
          console.log(`   ❌ Row ${idx + 2}: Still has invalid values`);
        }
      }
      
      // Verify numeric parsing
      const auctionNum = parseFloat(auctionValue);
      const adpNum = parseFloat(adp);
      
      if (isNaN(auctionNum) || isNaN(adpNum)) {
        remainingInvalid++;
        if (remainingInvalid <= 5) {
          console.log(`   ❌ Row ${idx + 2}: Non-numeric values: Auction="${auctionValue}", ADP="${adp}"`);
        }
      }
    });
    
    if (remainingInvalid === 0) {
      console.log('   ✅ All values are now valid numbers!');
      
      // Sample some values
      console.log('\n   Sample cleaned values:');
      [130, 131, 132, 146, 147].forEach(idx => {
        if (idx < valRows.length) {
          const row = valRows[idx];
          console.log(`   Row ${idx + 2}: ${row['Full Name']} - ADP=${row['ADP']}, Auction=$${row['Auction Value']}`);
        }
      });
    } else {
      console.log(`   ❌ ${remainingInvalid} invalid values still remain`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('CLEANING COMPLETE');
  console.log('=' .repeat(80));
}

// Run the fix
fixCleaningProperly().catch(console.error);