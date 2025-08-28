import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getChecksum(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (e) {
    return 'ERROR: ' + e.message;
  }
}

function getAllFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkForNullAndNA(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const naCount = (content.match(/\bN\/A\b/g) || []).length;
    const nullCount = (content.match(/\bnull\b/gi) || []).length;
    return { naCount, nullCount };
  } catch (e) {
    return { naCount: 0, nullCount: 0 };
  }
}

async function checkAllFiles() {
  console.log('=' .repeat(80));
  console.log('COMPREHENSIVE CHECK OF ALL FILES IN canonical_data/');
  console.log('=' .repeat(80));
  
  const canonicalPath = path.join(__dirname, 'canonical_data');
  const allFiles = getAllFiles(canonicalPath);
  
  console.log(`\n📊 TOTAL FILES FOUND: ${allFiles.length}`);
  
  // Group files by type
  const csvFiles = allFiles.filter(f => f.endsWith('.csv'));
  const txtFiles = allFiles.filter(f => f.endsWith('.txt'));
  const jsonFiles = allFiles.filter(f => f.endsWith('.json'));
  const otherFiles = allFiles.filter(f => !f.endsWith('.csv') && !f.endsWith('.txt') && !f.endsWith('.json'));
  
  console.log(`  CSV files: ${csvFiles.length}`);
  console.log(`  TXT files: ${txtFiles.length}`);
  console.log(`  JSON files: ${jsonFiles.length}`);
  console.log(`  Other files: ${otherFiles.length}`);
  
  // Get today's date for comparison
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Check modification dates
  console.log('\n📅 FILES MODIFIED TODAY (' + todayStr + '):');
  console.log('-' .repeat(40));
  
  let modifiedToday = 0;
  let modifiedThisWeek = 0;
  let modifiedThisMonth = 0;
  
  allFiles.forEach(file => {
    const stat = fs.statSync(file);
    const modDate = stat.mtime;
    const modDateStr = modDate.toISOString().split('T')[0];
    const daysDiff = Math.floor((today - modDate) / (1000 * 60 * 60 * 24));
    
    if (modDateStr === todayStr) {
      modifiedToday++;
      const relPath = file.replace(canonicalPath + path.sep, '');
      console.log(`  📝 ${relPath}`);
      console.log(`     Modified: ${modDate.toISOString()}`);
    }
    
    if (daysDiff <= 7) modifiedThisWeek++;
    if (daysDiff <= 30) modifiedThisMonth++;
  });
  
  if (modifiedToday === 0) {
    console.log('  ✅ No files modified today');
  }
  
  console.log(`\n📊 MODIFICATION SUMMARY:`);
  console.log(`  Today: ${modifiedToday} files`);
  console.log(`  Last 7 days: ${modifiedThisWeek} files`);
  console.log(`  Last 30 days: ${modifiedThisMonth} files`);
  
  // Check critical files
  console.log('\n🔍 CRITICAL FILES CHECK:');
  console.log('-' .repeat(40));
  
  const criticalFiles = [
    'adp/adp0_2025.csv',
    'adp/adp1_2025.csv',
    'adp/adp2_2025.csv',
    'adp/adp3_2025.csv',
    'projections/projections_2025.csv',
    'projections/CBS_2025_QB.csv',
    'projections/CBS_2025_RB.csv',
    'projections/CBS_2025_WR.csv',
    'projections/CBS_2025_TE.csv'
  ];
  
  criticalFiles.forEach(file => {
    const fullPath = path.join(canonicalPath, file);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      const checksum = getChecksum(fullPath);
      const nullNA = checkForNullAndNA(fullPath);
      const size = stat.size;
      const modDate = stat.mtime.toISOString().split('T')[0];
      
      console.log(`\n📄 ${file}`);
      console.log(`   Size: ${size} bytes`);
      console.log(`   Modified: ${modDate}`);
      console.log(`   MD5: ${checksum}`);
      if (nullNA.naCount > 0 || nullNA.nullCount > 0) {
        console.log(`   Contains: ${nullNA.naCount} N/A values, ${nullNA.nullCount} null values`);
      }
    } else {
      console.log(`\n❌ ${file} - NOT FOUND`);
    }
  });
  
  // Check for N/A and null values across all CSV files
  console.log('\n📊 N/A AND NULL VALUE SUMMARY:');
  console.log('-' .repeat(40));
  
  let totalNA = 0;
  let totalNull = 0;
  let filesWithNA = 0;
  let filesWithNull = 0;
  
  csvFiles.forEach(file => {
    const { naCount, nullCount } = checkForNullAndNA(file);
    if (naCount > 0) {
      totalNA += naCount;
      filesWithNA++;
    }
    if (nullCount > 0) {
      totalNull += nullCount;
      filesWithNull++;
    }
  });
  
  console.log(`  Total N/A values: ${totalNA} (in ${filesWithNA} files)`);
  console.log(`  Total null values: ${totalNull} (in ${filesWithNull} files)`);
  
  // List all directories
  console.log('\n📁 DIRECTORY STRUCTURE:');
  console.log('-' .repeat(40));
  
  const dirs = new Set();
  allFiles.forEach(file => {
    const relPath = file.replace(canonicalPath + path.sep, '');
    const dir = path.dirname(relPath);
    if (dir !== '.') dirs.add(dir);
  });
  
  const sortedDirs = Array.from(dirs).sort();
  sortedDirs.forEach(dir => {
    const filesInDir = allFiles.filter(f => {
      const relPath = f.replace(canonicalPath + path.sep, '');
      return path.dirname(relPath) === dir;
    });
    console.log(`  ${dir}/ (${filesInDir.length} files)`);
  });
  
  // Generate checksums for all CSV files
  console.log('\n🔐 CHECKSUMS FOR ALL CSV FILES:');
  console.log('-' .repeat(40));
  
  const checksums = {};
  csvFiles.forEach(file => {
    const relPath = file.replace(canonicalPath + path.sep, '');
    const checksum = getChecksum(file);
    checksums[relPath] = checksum;
  });
  
  // Save checksums to file for future comparison
  const checksumFile = path.join(__dirname, 'canonical_checksums.json');
  fs.writeFileSync(checksumFile, JSON.stringify(checksums, null, 2));
  console.log(`  ✅ Generated checksums for ${csvFiles.length} CSV files`);
  console.log(`  📝 Saved to: canonical_checksums.json`);
  
  // Final integrity check
  console.log('\n' + '=' .repeat(80));
  console.log('INTEGRITY VERDICT');
  console.log('=' .repeat(80));
  
  if (modifiedToday === 0) {
    console.log('\n✅ NO FILES MODIFIED TODAY - Data integrity maintained!');
  } else {
    console.log(`\n⚠️  ${modifiedToday} files were modified today - Review needed`);
  }
  
  console.log('\n📋 KEY FINDINGS:');
  console.log(`  • Total files: ${allFiles.length}`);
  console.log(`  • CSV files with N/A: ${filesWithNA}`);
  console.log(`  • CSV files with null: ${filesWithNull}`);
  console.log(`  • Files modified today: ${modifiedToday}`);
  
  return {
    totalFiles: allFiles.length,
    modifiedToday,
    checksums
  };
}

// Run the check
checkAllFiles().catch(console.error);