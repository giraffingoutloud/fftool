import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function countInvalidValuesInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    let naCount = 0;
    let nullCount = 0;
    let fileName = path.basename(filePath);
    
    // Count N/A and null occurrences
    lines.forEach((line, idx) => {
      // Count N/A patterns
      naCount += (line.match(/\bN\/A\b/g) || []).length;
      naCount += (line.match(/\bNA\b/g) || []).length;
      
      // Count null patterns
      nullCount += (line.match(/\bnull\b/gi) || []).length;
    });
    
    return {
      file: fileName,
      path: filePath,
      naCount,
      nullCount,
      total: naCount + nullCount
    };
  } catch (e) {
    return null;
  }
}

function findAllCSVFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findAllCSVFiles(fullPath, files);
    } else if (item.endsWith('.csv')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function countAllInvalidValues() {
  console.log('=' .repeat(80));
  console.log('COUNTING ALL N/A AND NULL VALUES ACROSS ALL CSV FILES');
  console.log('=' .repeat(80));
  
  const canonicalPath = path.join(__dirname, 'canonical_data');
  const csvFiles = findAllCSVFiles(canonicalPath);
  
  console.log(`\nFound ${csvFiles.length} CSV files to check\n`);
  
  let totalNA = 0;
  let totalNull = 0;
  let filesWithIssues = [];
  
  for (const file of csvFiles) {
    const result = countInvalidValuesInFile(file);
    if (result && result.total > 0) {
      totalNA += result.naCount;
      totalNull += result.nullCount;
      filesWithIssues.push(result);
    }
  }
  
  // Sort by total count
  filesWithIssues.sort((a, b) => b.total - a.total);
  
  console.log('FILES WITH N/A OR NULL VALUES:');
  console.log('-' .repeat(40));
  
  filesWithIssues.forEach(file => {
    const relPath = file.path.replace(canonicalPath + path.sep, '');
    console.log(`\n📄 ${relPath}`);
    console.log(`   N/A values: ${file.naCount}`);
    console.log(`   null values: ${file.nullCount}`);
    console.log(`   Total: ${file.total}`);
  });
  
  console.log('\n' + '=' .repeat(80));
  console.log('SUMMARY');
  console.log('=' .repeat(80));
  
  console.log(`\n📊 TOTAL COUNTS ACROSS ALL FILES:`);
  console.log(`   N/A values: ${totalNA}`);
  console.log(`   null values: ${totalNull}`);
  console.log(`   GRAND TOTAL: ${totalNA + totalNull} invalid values`);
  
  console.log(`\n📁 Files with issues: ${filesWithIssues.length} out of ${csvFiles.length} CSV files`);
  
  // Check if this matches the original 468
  const grandTotal = totalNA + totalNull;
  if (grandTotal === 468) {
    console.log('\n✅ MATCHES ORIGINAL COUNT: All 468 invalid values accounted for!');
  } else {
    const diff = 468 - grandTotal;
    if (diff > 0) {
      console.log(`\n⚠️  DISCREPANCY: Found ${grandTotal}, expected 468 (missing ${diff})`);
    } else {
      console.log(`\n⚠️  DISCREPANCY: Found ${grandTotal}, expected 468 (${Math.abs(diff)} extra)`);
    }
  }
  
  // Show breakdown by directory
  console.log('\n📂 BREAKDOWN BY DIRECTORY:');
  console.log('-' .repeat(40));
  
  const byDir = {};
  filesWithIssues.forEach(file => {
    const relPath = file.path.replace(canonicalPath + path.sep, '');
    const dir = path.dirname(relPath).split(path.sep)[0];
    if (!byDir[dir]) byDir[dir] = { na: 0, null: 0 };
    byDir[dir].na += file.naCount;
    byDir[dir].null += file.nullCount;
  });
  
  Object.entries(byDir).forEach(([dir, counts]) => {
    console.log(`\n${dir}/`);
    console.log(`   N/A: ${counts.na}, null: ${counts.null}, Total: ${counts.na + counts.null}`);
  });
  
  return grandTotal;
}

// Run the count
countAllInvalidValues().catch(console.error);