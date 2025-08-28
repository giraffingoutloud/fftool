const fs = require('fs');
const path = require('path');

// Strict CSV parser - no libraries, no coercion
function parseCSVStrict(content, delimiter = ',') {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  // Parse header
  const headers = parseCSVLine(lines[0], delimiter);
  const rows = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function auditCSVFiles() {
  const report = {
    summary: {
      files_checked: 0,
      total_errors: 0
    },
    files: [],
    recommendations: []
  };

  const baseDir = path.join(__dirname, 'public', 'canonical_data');
  
  // Define files to audit
  const auditFiles = [
    // ADP Data
    { path: 'adp/adp0_2025.csv', delimiter: ',' },
    { path: 'adp/adp_tier_data_2025.csv', delimiter: ',' },
    { path: 'adp/cbs_trade_values_week0_2025.csv', delimiter: ',' },
    
    // Projections
    { path: 'projections/projections_2025.csv', delimiter: ',' },
    { path: 'projections/projections_vorp_2025.csv', delimiter: ',' },
    
    // Historical Stats
    { path: 'historical_stats/fantasy-stats-passing_2024.csv', delimiter: ',' },
    { path: 'historical_stats/fantasy-stats-rushing_2024.csv', delimiter: ',' },
    { path: 'historical_stats/fantasy-stats-receiving_2024.csv', delimiter: ',' },
    
    // Team Data
    { path: 'advanced_data/team_data/team_points_per_game.txt', delimiter: '\t' },
    { path: 'advanced_data/team_data/offensive_elo.txt', delimiter: '\t' },
    { path: 'advanced_data/team_data/defensive_elo.txt', delimiter: '\t' }
  ];

  // First, load reference data
  const playerNames = new Set();
  try {
    const adpPath = path.join(baseDir, 'adp', 'adp0_2025.csv');
    const adpContent = fs.readFileSync(adpPath, 'utf8');
    const adpRows = parseCSVStrict(adpContent, ',');
    adpRows.forEach(row => {
      if (row['Full Name']) playerNames.add(row['Full Name']);
    });
  } catch (e) {
    console.error('Could not load ADP reference data:', e.message);
  }

  // Audit each file
  for (const file of auditFiles) {
    const fileName = file.path.split('/').pop();
    const fileAudit = {
      file_name: fileName,
      errors: []
    };

    try {
      const filePath = path.join(baseDir, file.path);
      const content = fs.readFileSync(filePath, 'utf8');
      const rows = parseCSVStrict(content, file.delimiter);
      
      report.summary.files_checked++;

      if (rows.length === 0) {
        fileAudit.errors.push({
          type: 'missing_required',
          evidence: {
            file: fileName,
            row_number: 0,
            columns: [],
            details: 'File is empty or has no valid rows'
          }
        });
      } else {
        const expectedColumns = Object.keys(rows[0]);
        const expectedColumnCount = expectedColumns.length;
        const seenValues = new Map();
        
        // Check specific required columns based on file type
        const requiredColumns = {
          'adp0_2025.csv': ['Overall Rank', 'Full Name', 'Position', 'ADP'],
          'projections_2025.csv': ['playerName', 'position', 'fantasyPoints'],
          'fantasy-stats-passing_2024.csv': ['player', 'team', 'fantasyPts'],
          'fantasy-stats-rushing_2024.csv': ['player', 'team', 'fantasyPts'],
          'fantasy-stats-receiving_2024.csv': ['player', 'team', 'fantasyPts']
        };
        
        if (requiredColumns[fileName]) {
          for (const required of requiredColumns[fileName]) {
            if (!expectedColumns.includes(required)) {
              fileAudit.errors.push({
                type: 'missing_required',
                evidence: {
                  file: fileName,
                  row_number: 0,
                  columns: [required],
                  details: `Required column '${required}' not found in headers`
                }
              });
            }
          }
        }
        
        // Validate each row
        rows.forEach((row, index) => {
          const rowNumber = index + 2;
          
          // Check column count
          const actualColumnCount = Object.keys(row).length;
          if (actualColumnCount !== expectedColumnCount) {
            fileAudit.errors.push({
              type: 'row_length_mismatch',
              evidence: {
                file: fileName,
                row_number: rowNumber,
                columns: Object.keys(row),
                details: `Row has ${actualColumnCount} columns, expected ${expectedColumnCount}`
              }
            });
          }
          
          // Check each field
          Object.entries(row).forEach(([column, value]) => {
            const strValue = String(value).trim();
            
            // Check for missing required values
            if ((strValue === '' || strValue === 'null') && 
                ['Full Name', 'playerName', 'player', 'Position', 'position'].includes(column)) {
              fileAudit.errors.push({
                type: 'missing_required',
                evidence: {
                  file: fileName,
                  row_number: rowNumber,
                  columns: [column],
                  details: `Required field '${column}' is empty or null`
                }
              });
            }
            
            // Type validation for numeric columns (zero tolerance)
            const numericPatterns = [
              /rank/i, /adp/i, /value/i, /points/i, /yards/i, 
              /touchdowns/i, /completions/i, /attempts/i, /receptions/i,
              /targets/i, /games/i, /sacks/i, /interceptions/i, /fumbles/i
            ];
            
            const isNumericColumn = numericPatterns.some(p => p.test(column));
            
            if (isNumericColumn && strValue !== '' && strValue !== '-' && strValue !== '--') {
              const cleanValue = strValue.replace(/[$,%]/g, '').replace(/,/g, '');
              
              // Strict numeric check - no coercion
              if (!/^-?\d+(\.\d+)?$/.test(cleanValue) && 
                  cleanValue !== 'N/A' && cleanValue !== 'NA') {
                fileAudit.errors.push({
                  type: 'invalid_type',
                  evidence: {
                    file: fileName,
                    row_number: rowNumber,
                    columns: [column],
                    details: `Column '${column}' has non-numeric value: '${strValue}'`
                  }
                });
              }
              
              // Domain validation
              if (column === 'Overall Rank' || column === 'Rank') {
                const rankValue = parseInt(cleanValue);
                if (!isNaN(rankValue) && rankValue < 1) {
                  fileAudit.errors.push({
                    type: 'invalid_domain',
                    evidence: {
                      file: fileName,
                      row_number: rowNumber,
                      columns: [column],
                      details: `Rank value ${rankValue} must be positive`
                    }
                  });
                }
              }
              
              if (column === 'ADP') {
                const adpValue = parseFloat(cleanValue);
                if (!isNaN(adpValue) && (adpValue < 0 || adpValue > 500)) {
                  fileAudit.errors.push({
                    type: 'invalid_domain',
                    evidence: {
                      file: fileName,
                      row_number: rowNumber,
                      columns: [column],
                      details: `ADP value ${adpValue} outside valid range [0, 500]`
                    }
                  });
                }
              }
            }
            
            // Position validation
            if ((column === 'Position' || column === 'position') && strValue) {
              const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'D/ST'];
              if (!validPositions.includes(strValue.toUpperCase())) {
                fileAudit.errors.push({
                  type: 'invalid_domain',
                  evidence: {
                    file: fileName,
                    row_number: rowNumber,
                    columns: [column],
                    details: `Invalid position value: '${strValue}'`
                  }
                });
              }
            }
            
            // Check for duplicates in key columns
            const pkColumns = ['Overall Rank', 'Full Name', 'playerName', 'player'];
            if (pkColumns.includes(column) && strValue) {
              const key = `${column}:${strValue}`;
              if (!seenValues.has(key)) {
                seenValues.set(key, []);
              }
              const seen = seenValues.get(key);
              if (seen.length > 0) {
                fileAudit.errors.push({
                  type: 'duplicate_pk',
                  evidence: {
                    file: fileName,
                    row_number: rowNumber,
                    columns: [column],
                    details: `Duplicate value '${strValue}' in column '${column}' (also in row ${seen[0]})`
                  }
                });
              }
              seen.push(rowNumber);
            }
          });
          
          // Check foreign keys
          if (fileName === 'projections_2025.csv' || fileName === 'projections_vorp_2025.csv') {
            const playerName = row['playerName'];
            if (playerName && !playerNames.has(playerName)) {
              fileAudit.errors.push({
                type: 'broken_fk',
                evidence: {
                  file: fileName,
                  row_number: rowNumber,
                  columns: ['playerName'],
                  details: `Player '${playerName}' not found in ADP reference data`
                }
              });
            }
          }
        });
      }
      
    } catch (error) {
      fileAudit.errors.push({
        type: 'missing_required',
        evidence: {
          file: fileName,
          row_number: 0,
          columns: [],
          details: `File error: ${error.message}`
        }
      });
    }
    
    if (fileAudit.errors.length > 0) {
      report.files.push(fileAudit);
      report.summary.total_errors += fileAudit.errors.length;
    }
  }

  // Generate recommendations
  const errorTypes = new Set();
  report.files.forEach(file => {
    file.errors.forEach(error => errorTypes.add(error.type));
  });

  if (errorTypes.has('invalid_type')) {
    report.recommendations.push('Implement strict type validation with zero tolerance for non-conforming values');
  }
  if (errorTypes.has('missing_required')) {
    report.recommendations.push('Add NOT NULL constraints for all required fields');
  }
  if (errorTypes.has('duplicate_pk')) {
    report.recommendations.push('Enforce unique constraints on primary key columns');
  }
  if (errorTypes.has('broken_fk')) {
    report.recommendations.push('Implement foreign key constraints to maintain referential integrity');
  }
  if (errorTypes.has('row_length_mismatch')) {
    report.recommendations.push('Validate CSV structure before parsing to ensure column consistency');
  }
  if (errorTypes.has('invalid_domain')) {
    report.recommendations.push('Add domain validation rules for business constraints');
  }

  return report;
}

// Run the audit
auditCSVFiles().then(report => {
  console.log(JSON.stringify(report, null, 2));
}).catch(err => {
  console.error('Audit failed:', err);
});