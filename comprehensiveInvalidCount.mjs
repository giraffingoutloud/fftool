import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function countInvalidValuesInCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    
    if (lines.length < 2) return null;
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    
    // Patterns that indicate invalid/missing values
    const invalidPatterns = [
      'N/A', 'NA', 'n/a', 'N/a',
      'null', 'NULL', 'Null',
      '', // empty values
      '-', '--', '---',
      'undefined', 'UNDEFINED',
      'None', 'none', 'NONE'
    ];
    
    let invalidCounts = {};
    let totalInvalid = 0;
    
    // Check each data row
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      headers.forEach((header, idx) => {
        const value = (values[idx] || '').trim().replace(/^"|"$/g, '');
        
        // Check if this value matches any invalid pattern
        if (invalidPatterns.includes(value)) {
          const pattern = value || '(empty)';
          if (!invalidCounts[pattern]) invalidCounts[pattern] = 0;
          invalidCounts[pattern]++;
          totalInvalid++;
        }
      });
    }
    
    return {
      file: path.basename(filePath),
      path: filePath,
      invalidCounts,
      totalInvalid
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

async function comprehensiveInvalidCount() {
  console.log('=' .repeat(80));
  console.log('COMPREHENSIVE COUNT OF ALL INVALID/MISSING VALUES IN CSV FILES');
  console.log('=' .repeat(80));
  
  const canonicalPath = path.join(__dirname, 'canonical_data');
  const csvFiles = findAllCSVFiles(canonicalPath);
  
  console.log(`\nAnalyzing ${csvFiles.length} CSV files...\n`);
  
  let globalCounts = {};
  let grandTotal = 0;
  let filesWithIssues = [];
  
  for (const file of csvFiles) {
    const result = countInvalidValuesInCSV(file);
    if (result && result.totalInvalid > 0) {
      filesWithIssues.push(result);
      grandTotal += result.totalInvalid;
      
      // Add to global counts
      Object.entries(result.invalidCounts).forEach(([pattern, count]) => {
        if (!globalCounts[pattern]) globalCounts[pattern] = 0;
        globalCounts[pattern] += count;
      });
    }
  }
  
  // Sort files by total invalid count
  filesWithIssues.sort((a, b) => b.totalInvalid - a.totalInvalid);
  
  console.log('TOP FILES WITH INVALID VALUES:');
  console.log('-' .repeat(40));
  
  // Show top 10 files
  filesWithIssues.slice(0, 10).forEach(file => {
    const relPath = file.path.replace(canonicalPath + path.sep, '');
    console.log(`\n📄 ${relPath}`);
    console.log(`   Total invalid: ${file.totalInvalid}`);
    
    // Show breakdown of patterns in this file
    const topPatterns = Object.entries(file.invalidCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    topPatterns.forEach(([pattern, count]) => {
      console.log(`     • "${pattern}": ${count}`);
    });
  });
  
  if (filesWithIssues.length > 10) {
    console.log(`\n... and ${filesWithIssues.length - 10} more files`);
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('PATTERN BREAKDOWN ACROSS ALL FILES');
  console.log('=' .repeat(80));
  
  // Sort patterns by count
  const sortedPatterns = Object.entries(globalCounts)
    .sort((a, b) => b[1] - a[1]);
  
  console.log('\nInvalid value patterns found:');
  sortedPatterns.forEach(([pattern, count]) => {
    console.log(`  "${pattern}": ${count} occurrences`);
  });
  
  console.log('\n' + '=' .repeat(80));
  console.log('FINAL SUMMARY');
  console.log('=' .repeat(80));
  
  console.log(`\n📊 GRAND TOTAL: ${grandTotal} invalid/missing values`);
  console.log(`📁 Files affected: ${filesWithIssues.length} out of ${csvFiles.length} CSV files`);
  
  // Check against expected 468
  if (grandTotal === 468) {
    console.log('\n✅ PERFECT MATCH: All 468 invalid values accounted for!');
  } else {
    const diff = 468 - grandTotal;
    if (diff > 0) {
      console.log(`\n⚠️  Found ${grandTotal} invalid values (expected 468, missing ${diff})`);
      console.log('   Note: The difference might be due to:');
      console.log('   • Different counting methodology');
      console.log('   • Files that were added/removed');
      console.log('   • Different pattern matching rules');
    } else {
      console.log(`\n⚠️  Found ${grandTotal} invalid values (expected 468, ${Math.abs(diff)} extra)`);
      console.log('   This might include empty values or other patterns');
    }
  }
  
  // Show which patterns are most common
  console.log('\n📈 MOST COMMON ISSUES:');
  const top3 = sortedPatterns.slice(0, 3);
  top3.forEach(([pattern, count], idx) => {
    const pct = ((count / grandTotal) * 100).toFixed(1);
    console.log(`   ${idx + 1}. "${pattern}": ${count} (${pct}% of all invalid values)`);
  });
  
  return grandTotal;
}

// Run comprehensive count
comprehensiveInvalidCount().catch(console.error);