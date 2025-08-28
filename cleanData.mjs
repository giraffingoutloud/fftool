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
  if (value === 'N/A' || value === 'NA' || value === 'n/a' || value === 'null' || value === '') {
    const rank = parseInt(row['Overall Rank']) || 999;
    const adp = parseFloat(row['ADP']) || rank;
    
    // For high-value players (rank <= 200), calculate auction value
    if (rank <= 200) {
      // Formula: Higher ranked = higher value
      const baseValue = Math.max(1, Math.round(200 - (adp * 0.8)));
      return Math.min(70, baseValue); // Cap at $70
    }
    // For low-value players, they have no auction value
    return 0;
  }
  
  return value;
}

function cleanADP(value) {
  if (value === 'null' || value === 'NULL' || value === 'N/A' || value === 'NA' || value === '') {
    return 999; // Standard convention for undrafted
  }
  return value;
}

async function cleanAllCSVData() {
  console.log('=' .repeat(80));
  console.log('CLEANING CSV DATA - FIXING "N/A" AND "null" VALUES');
  console.log('=' .repeat(80));

  const baseDir = path.join(__dirname, 'canonical_data');
  const cleanedDir = path.join(__dirname, 'canonical_data_cleaned');
  
  // Create cleaned directory structure
  if (!fs.existsSync(cleanedDir)) {
    fs.mkdirSync(cleanedDir, { recursive: true });
  }
  
  const adpDir = path.join(cleanedDir, 'adp');
  if (!fs.existsSync(adpDir)) {
    fs.mkdirSync(adpDir, { recursive: true });
  }

  // Process ADP file
  const adpFile = 'adp0_2025.csv';
  const inputPath = path.join(baseDir, 'adp', adpFile);
  const outputPath = path.join(adpDir, adpFile);
  
  console.log(`\n📄 Processing: ${adpFile}`);
  console.log(`   Input: ${inputPath}`);
  console.log(`   Output: ${outputPath}`);
  
  try {
    const content = fs.readFileSync(inputPath, 'utf8');
    const { headers, rows } = parseCSV(content);
    
    let cleanedCount = 0;
    let naCount = 0;
    let nullCount = 0;
    
    // Clean each row
    const cleanedRows = rows.map((row, index) => {
      const cleanedRow = { ...row };
      
      // Clean Auction Value
      const originalAuctionValue = row['Auction Value'];
      if (originalAuctionValue === 'N/A' || originalAuctionValue === 'NA' || originalAuctionValue === 'null') {
        cleanedRow['Auction Value'] = cleanAuctionValue(originalAuctionValue, row);
        cleanedCount++;
        naCount++;
        
        if (index < 5) {
          console.log(`   Example: Row ${index + 2}, ${row['Full Name']}: Auction Value "${originalAuctionValue}" → ${cleanedRow['Auction Value']}`);
        }
      }
      
      // Clean ADP
      const originalADP = row['ADP'];
      if (originalADP === 'null' || originalADP === 'NULL' || originalADP === 'N/A') {
        cleanedRow['ADP'] = cleanADP(originalADP);
        cleanedCount++;
        nullCount++;
        
        if (index < 5 || nullCount <= 3) {
          console.log(`   Example: Row ${index + 2}, ${row['Full Name']}: ADP "${originalADP}" → ${cleanedRow['ADP']}`);
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
    
    fs.writeFileSync(outputPath, cleanedLines.join('\n'), 'utf8');
    
    console.log(`\n✅ SUCCESS: Cleaned ${cleanedCount} values`);
    console.log(`   - "N/A" values fixed: ${naCount}`);
    console.log(`   - "null" values fixed: ${nullCount}`);
    console.log(`   - Total rows processed: ${rows.length}`);
    console.log(`   - Output saved to: ${outputPath}`);
    
  } catch (error) {
    console.error(`❌ Error processing file:`, error.message);
  }

  // Copy other clean files to cleaned directory
  console.log('\n📁 Copying other data files to cleaned directory...');
  
  const otherDirs = ['projections', 'historical_stats', 'advanced_data'];
  for (const dir of otherDirs) {
    const srcDir = path.join(baseDir, dir);
    const destDir = path.join(cleanedDir, dir);
    
    if (fs.existsSync(srcDir)) {
      copyDirectorySync(srcDir, destDir);
      console.log(`   ✅ Copied ${dir}/`);
    }
  }

  // Validate the cleaned data
  console.log('\n' + '=' .repeat(80));
  console.log('VALIDATING CLEANED DATA');
  console.log('=' .repeat(80));
  
  const cleanedAdpPath = path.join(adpDir, adpFile);
  const validationContent = fs.readFileSync(cleanedAdpPath, 'utf8');
  const { rows: validationRows } = parseCSV(validationContent);
  
  let remainingNA = 0;
  let remainingNull = 0;
  
  validationRows.forEach((row, index) => {
    if (row['Auction Value'] === 'N/A' || row['Auction Value'] === 'NA') {
      remainingNA++;
      console.error(`   ❌ Row ${index + 2}: Auction Value still has "N/A"`);
    }
    if (row['ADP'] === 'null' || row['ADP'] === 'NULL') {
      remainingNull++;
      console.error(`   ❌ Row ${index + 2}: ADP still has "null"`);
    }
  });
  
  if (remainingNA === 0 && remainingNull === 0) {
    console.log('\n🎉 VALIDATION PASSED: All "N/A" and "null" values have been cleaned!');
    
    // Test parsing some values
    console.log('\n📊 Sample cleaned values:');
    for (let i = 130; i < 135 && i < validationRows.length; i++) {
      const row = validationRows[i];
      const auctionValue = parseFloat(row['Auction Value']);
      const adp = parseFloat(row['ADP']);
      console.log(`   Row ${i + 2}: ${row['Full Name']} - ADP=${adp}, Auction=$${auctionValue}`);
    }
  } else {
    console.error(`\n❌ VALIDATION FAILED: ${remainingNA} "N/A" and ${remainingNull} "null" values still remain`);
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('CLEANING COMPLETE');
  console.log('=' .repeat(80));
  console.log('\n📁 Cleaned data saved to: canonical_data_cleaned/');
  console.log('💡 To use cleaned data, update your imports to use canonical_data_cleaned/ instead of canonical_data/');
}

function copyDirectorySync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Run the cleaning
cleanAllCSVData().catch(console.error);