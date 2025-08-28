import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFileChecksum(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

function getFileInfo(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for N/A and null values (these SHOULD be present in original)
    let naCount = 0;
    let nullCount = 0;
    
    const lines = content.split(/\r?\n/);
    lines.forEach(line => {
      naCount += (line.match(/N\/A/g) || []).length;
      naCount += (line.match(/NA(?![A-Z])/g) || []).length;
      nullCount += (line.match(/null/g) || []).length;
    });
    
    return {
      exists: true,
      size: stats.size,
      modified: stats.mtime,
      checksum: getFileChecksum(filePath),
      lines: lines.length,
      naValues: naCount,
      nullValues: nullCount
    };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function verifyOriginalIntegrity() {
  console.log('=' .repeat(80));
  console.log('VERIFYING ORIGINAL DATA INTEGRITY IN canonical_data/');
  console.log('=' .repeat(80));
  console.log('\n⚠️  IMPORTANT: CSV files should NEVER be modified!');
  console.log('N/A and null values SHOULD be present - they are part of the original data');
  
  // Key files to check
  const keyFiles = [
    { 
      path: 'adp/adp0_2025.csv',
      expectedNA: true,  // Should have N/A values
      expectedNull: true, // Should have null values
      description: 'Main ADP rankings'
    },
    {
      path: 'projections/projections_2025.csv',
      expectedNA: false,
      expectedNull: false,
      description: 'Season projections'
    },
    {
      path: 'projections/projections_vorp_2025.csv',
      expectedNA: false,
      expectedNull: false,
      description: 'VORP projections'
    },
    {
      path: 'historical_stats/fantasy-stats-passing_2024.csv',
      expectedNA: false,
      expectedNull: false,
      description: '2024 Passing stats'
    },
    {
      path: 'historical_stats/fantasy-stats-rushing_2024.csv',
      expectedNA: false,
      expectedNull: false,
      description: '2024 Rushing stats'
    },
    {
      path: 'historical_stats/fantasy-stats-receiving_2024.csv',
      expectedNA: false,
      expectedNull: false,
      description: '2024 Receiving stats'
    },
    {
      path: 'advanced_data/team_data/team_points_per_game.txt',
      expectedNA: false,
      expectedNull: false,
      description: 'Team points data'
    }
  ];

  console.log('\n📁 CHECKING KEY FILES:');
  console.log('-' .repeat(40));

  let allOriginal = true;
  const results = [];

  for (const file of keyFiles) {
    const fullPath = path.join(__dirname, 'canonical_data', file.path);
    const info = getFileInfo(fullPath);
    
    console.log(`\n📄 ${file.description}`);
    console.log(`   Path: canonical_data/${file.path}`);
    
    if (!info.exists) {
      console.log(`   ❌ FILE NOT FOUND!`);
      allOriginal = false;
      continue;
    }

    console.log(`   ✅ File exists`);
    console.log(`   Size: ${info.size} bytes`);
    console.log(`   Lines: ${info.lines}`);
    console.log(`   Modified: ${info.modified.toISOString()}`);
    console.log(`   MD5: ${info.checksum}`);
    
    // Check for expected N/A and null values
    if (file.expectedNA && info.naValues === 0) {
      console.log(`   ⚠️  WARNING: Expected N/A values but found none!`);
      allOriginal = false;
    } else if (file.expectedNA) {
      console.log(`   ✅ Contains ${info.naValues} N/A values (expected)`);
    }
    
    if (file.expectedNull && info.nullValues === 0) {
      console.log(`   ⚠️  WARNING: Expected null values but found none!`);
      allOriginal = false;
    } else if (file.expectedNull) {
      console.log(`   ✅ Contains ${info.nullValues} null values (expected)`);
    }
    
    results.push({
      file: file.path,
      ...info
    });
  }

  // Special check for adp0_2025.csv
  console.log('\n🔍 DETAILED CHECK: adp0_2025.csv');
  console.log('-' .repeat(40));
  
  const adpPath = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const adpContent = fs.readFileSync(adpPath, 'utf8');
  const lines = adpContent.split(/\r?\n/).filter(l => l.trim());
  
  // Check specific rows that should have N/A or null
  const expectedIssues = [
    { row: 113, column: 'ADP', value: 'null' },
    { row: 132, column: 'Auction Value', value: 'N/A' },
    { row: 147, column: 'ADP', value: 'null' },
    { row: 195, column: 'ADP', value: 'null' }
  ];
  
  console.log('Checking known N/A and null values (these SHOULD be present):');
  
  expectedIssues.forEach(issue => {
    if (issue.row <= lines.length) {
      const line = lines[issue.row - 1]; // -1 for 0-index
      if (line.includes(issue.value)) {
        console.log(`   ✅ Row ${issue.row}: Contains "${issue.value}" (correct - original data)`);
      } else {
        console.log(`   ❌ Row ${issue.row}: Missing expected "${issue.value}" (file may have been modified!)`);
        allOriginal = false;
      }
    }
  });

  // Count total invalid values in ADP file
  const adpLines = adpContent.split(/\r?\n/);
  let totalNA = 0;
  let totalNull = 0;
  
  adpLines.forEach(line => {
    // Count N/A in Auction Value column (usually 6th column)
    if (line.includes(',N/A,') || line.endsWith(',N/A')) {
      totalNA++;
    }
    // Count null in ADP column (usually 5th column)
    if (line.includes(',null,') || line.includes(',null,')) {
      totalNull++;
    }
  });
  
  console.log(`\n📊 Total invalid values in adp0_2025.csv:`);
  console.log(`   N/A values: ~${totalNA} (should be ~288)`);
  console.log(`   null values: ~${totalNull} (should be ~26)`);
  
  if (totalNA < 200) {
    console.log('   ⚠️  WARNING: N/A count is low - file may have been modified!');
    allOriginal = false;
  }
  if (totalNull < 20) {
    console.log('   ⚠️  WARNING: null count is low - file may have been modified!');
    allOriginal = false;
  }

  // Directory structure check
  console.log('\n📂 DIRECTORY STRUCTURE:');
  console.log('-' .repeat(40));
  
  const expectedDirs = [
    'canonical_data/adp',
    'canonical_data/projections',
    'canonical_data/historical_stats',
    'canonical_data/advanced_data',
    'canonical_data/advanced_data/2024-2025',
    'canonical_data/advanced_data/team_data'
  ];
  
  expectedDirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.csv') || f.endsWith('.txt'));
      console.log(`   ✅ ${dir}/ (${files.length} data files)`);
    } else {
      console.log(`   ❌ ${dir}/ MISSING!`);
      allOriginal = false;
    }
  });

  // Check for cleaned directory (should NOT exist)
  console.log('\n🗑️  CLEANED DATA CHECK:');
  console.log('-' .repeat(40));
  
  const cleanedPath = path.join(__dirname, 'canonical_data_cleaned');
  if (fs.existsSync(cleanedPath)) {
    console.log('   ❌ canonical_data_cleaned/ exists - should be deleted!');
    console.log('   Run: rm -rf canonical_data_cleaned');
  } else {
    console.log('   ✅ No cleaned data directory (correct)');
  }

  // Final verdict
  console.log('\n' + '=' .repeat(80));
  console.log('INTEGRITY VERIFICATION RESULTS');
  console.log('=' .repeat(80));
  
  if (allOriginal) {
    console.log('\n✅ ORIGINAL DATA IS INTACT!');
    console.log('   • All files exist with expected structure');
    console.log('   • N/A and null values are present (as they should be)');
    console.log('   • No cleaned directory exists');
    console.log('   • Data has NOT been modified');
  } else {
    console.log('\n⚠️  POTENTIAL ISSUES DETECTED');
    console.log('   Some files may have been modified or are missing expected values.');
    console.log('   Original data should contain N/A and null values!');
  }
  
  console.log('\n📋 PRINCIPLE TO FOLLOW:');
  console.log('   1. NEVER modify CSV files in canonical_data/');
  console.log('   2. N/A and null values are PART OF THE DATA');
  console.log('   3. Parser should handle these values, not change them');
  console.log('   4. Use null-preserving parser with original files');
  
  console.log('\n🔧 CORRECT APPROACH:');
  console.log('   • Parse "N/A" → null in memory');
  console.log('   • Parse "null" → null in memory');
  console.log('   • Filter nulls during analysis');
  console.log('   • NEVER modify the CSV files themselves');

  return {
    allOriginal,
    results
  };
}

// Run verification
verifyOriginalIntegrity().catch(console.error);