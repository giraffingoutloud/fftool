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

  return rows;
}

async function checkRemainingInvalidValues() {
  console.log('=' .repeat(80));
  console.log('CHECKING FOR REMAINING "N/A" AND "null" VALUES');
  console.log('=' .repeat(80));

  const results = {
    totalFilesChecked: 0,
    filesWithIssues: [],
    totalNAFound: 0,
    totalNullFound: 0,
    details: []
  };

  // Check key files
  const filesToCheck = [
    { path: 'canonical_data/adp/adp0_2025.csv', name: 'ADP Data (Original)' },
    { path: 'canonical_data/projections/projections_2025.csv', name: 'Projections (Original)' },
    { path: 'canonical_data/adp/adp_tier_data_2025.csv', name: 'ADP Tiers' },
    { path: 'canonical_data/adp/cbs_trade_values_week0_2025.csv', name: 'CBS Trade Values' },
    { path: 'canonical_data/adp/fpros_trade_values_dynasty_week0_2025.csv', name: 'Dynasty Values' },
    { path: 'canonical_data/adp/fpros_trade_values_redraft_week0_2025.csv', name: 'Redraft Values' },
    { path: 'canonical_data/historical_stats/fantasy-stats-passing_2024.csv', name: 'Passing Stats' },
    { path: 'canonical_data/historical_stats/fantasy-stats-rushing_2024.csv', name: 'Rushing Stats' },
    { path: 'canonical_data/historical_stats/fantasy-stats-receiving_2024.csv', name: 'Receiving Stats' }
  ];

  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, file.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ File not found: ${file.name}`);
      continue;
    }

    results.totalFilesChecked++;
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSV(content);
    
    const fileResults = {
      fileName: file.name,
      filePath: file.path,
      totalRows: rows.length,
      naOccurrences: [],
      nullOccurrences: []
    };

    // Check each row for N/A and null values
    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for header
      
      Object.entries(row).forEach(([column, value]) => {
        const strValue = String(value).toLowerCase().trim();
        
        // Check for N/A variations
        if (strValue === 'n/a' || strValue === 'na' || strValue === 'n.a.' || strValue === 'n/a.') {
          fileResults.naOccurrences.push({
            row: rowNumber,
            column: column,
            value: value,
            context: {
              playerName: row['Full Name'] || row['playerName'] || row['player'] || 'Unknown',
              position: row['Position'] || row['position'] || 'Unknown'
            }
          });
          results.totalNAFound++;
        }
        
        // Check for null variations
        if (strValue === 'null' || strValue === 'none' || strValue === 'nil') {
          fileResults.nullOccurrences.push({
            row: rowNumber,
            column: column,
            value: value,
            context: {
              playerName: row['Full Name'] || row['playerName'] || row['player'] || 'Unknown',
              position: row['Position'] || row['position'] || 'Unknown'
            }
          });
          results.totalNullFound++;
        }
      });
    });

    if (fileResults.naOccurrences.length > 0 || fileResults.nullOccurrences.length > 0) {
      results.filesWithIssues.push(file.name);
      results.details.push(fileResults);
    }

    // Report for this file
    console.log(`\n📄 ${file.name}`);
    console.log(`   Path: ${file.path}`);
    console.log(`   Rows: ${rows.length}`);
    
    if (fileResults.naOccurrences.length === 0 && fileResults.nullOccurrences.length === 0) {
      console.log(`   ✅ CLEAN - No "N/A" or "null" values found`);
    } else {
      if (fileResults.naOccurrences.length > 0) {
        console.log(`   ❌ Found ${fileResults.naOccurrences.length} "N/A" values`);
        console.log(`      Columns affected:`);
        const columnCounts = {};
        fileResults.naOccurrences.forEach(occ => {
          columnCounts[occ.column] = (columnCounts[occ.column] || 0) + 1;
        });
        Object.entries(columnCounts).forEach(([col, count]) => {
          console.log(`        - ${col}: ${count} occurrences`);
        });
        
        // Show first 3 examples
        console.log(`      Examples:`);
        fileResults.naOccurrences.slice(0, 3).forEach(occ => {
          console.log(`        Row ${occ.row}: ${occ.column} = "${occ.value}" (${occ.context.playerName})`);
        });
      }
      
      if (fileResults.nullOccurrences.length > 0) {
        console.log(`   ❌ Found ${fileResults.nullOccurrences.length} "null" values`);
        console.log(`      Columns affected:`);
        const columnCounts = {};
        fileResults.nullOccurrences.forEach(occ => {
          columnCounts[occ.column] = (columnCounts[occ.column] || 0) + 1;
        });
        Object.entries(columnCounts).forEach(([col, count]) => {
          console.log(`        - ${col}: ${count} occurrences`);
        });
        
        // Show first 3 examples
        console.log(`      Examples:`);
        fileResults.nullOccurrences.slice(0, 3).forEach(occ => {
          console.log(`        Row ${occ.row}: ${occ.column} = "${occ.value}" (${occ.context.playerName})`);
        });
      }
    }
  }

  // Final summary
  console.log('\n' + '=' .repeat(80));
  console.log('SUMMARY');
  console.log('=' .repeat(80));
  console.log(`\nFiles checked: ${results.totalFilesChecked}`);
  console.log(`Files with issues: ${results.filesWithIssues.length}`);
  console.log(`Total "N/A" values found: ${results.totalNAFound}`);
  console.log(`Total "null" values found: ${results.totalNullFound}`);
  
  if (results.totalNAFound + results.totalNullFound === 0) {
    console.log('\n🎉 SUCCESS: No "N/A" or "null" values found in any checked files!');
  } else {
    console.log('\n⚠️  WARNING: Invalid values still present in the data');
    console.log('\nFiles requiring attention:');
    results.filesWithIssues.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    // Detailed breakdown
    console.log('\n📊 DETAILED BREAKDOWN:');
    results.details.forEach(detail => {
      if (detail.naOccurrences.length > 0) {
        console.log(`\n${detail.fileName} - "N/A" values:`);
        const byColumn = {};
        detail.naOccurrences.forEach(occ => {
          if (!byColumn[occ.column]) byColumn[occ.column] = [];
          byColumn[occ.column].push(occ.row);
        });
        Object.entries(byColumn).forEach(([col, rows]) => {
          console.log(`  ${col}: ${rows.length} occurrences in rows ${rows.slice(0, 5).join(', ')}${rows.length > 5 ? '...' : ''}`);
        });
      }
      
      if (detail.nullOccurrences.length > 0) {
        console.log(`\n${detail.fileName} - "null" values:`);
        const byColumn = {};
        detail.nullOccurrences.forEach(occ => {
          if (!byColumn[occ.column]) byColumn[occ.column] = [];
          byColumn[occ.column].push(occ.row);
        });
        Object.entries(byColumn).forEach(([col, rows]) => {
          console.log(`  ${col}: ${rows.length} occurrences in rows ${rows.slice(0, 5).join(', ')}${rows.length > 5 ? '...' : ''}`);
        });
      }
    });
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('Run the data cleaning script to fix these values:');
    console.log('  node -e "require(\'./src/lib/cleanCSVData\').cleanAllCSVData()"');
  }
  
  // Return summary for programmatic use
  return {
    hasIssues: results.totalNAFound + results.totalNullFound > 0,
    summary: {
      filesChecked: results.totalFilesChecked,
      filesWithIssues: results.filesWithIssues.length,
      totalNA: results.totalNAFound,
      totalNull: results.totalNullFound
    },
    files: results.filesWithIssues
  };
}

// Run the check
checkRemainingInvalidValues().catch(console.error);