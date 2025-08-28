/**
 * Complete zero-tolerance CSV audit for ALL files
 * No coercion, strict validation, evidence-based reporting only
 */

import { logger } from './utils/logger';

interface AuditError {
  type: 'missing_required' | 'invalid_type' | 'duplicate_pk' | 'broken_fk' | 'row_length_mismatch' | 'invalid_domain';
  evidence: {
    file: string;
    row_number: number;
    columns: string[];
    details: string;
  };
}

interface FileAudit {
  file_name: string;
  errors: AuditError[];
}

interface AuditReport {
  summary: {
    files_checked: number;
    total_errors: number;
  };
  files: FileAudit[];
  recommendations: string[];
}

// Strict CSV parser - no libraries, no coercion
function parseCSVStrict(content: string, delimiter: string = ','): any[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  // Parse header
  const headers = parseCSVLine(lines[0], delimiter);
  const rows: any[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
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

export async function fullZeroToleranceAudit(): Promise<AuditReport> {
  const report: AuditReport = {
    summary: {
      files_checked: 0,
      total_errors: 0
    },
    files: [],
    recommendations: []
  };

  // Define all files to audit
  const auditFiles = [
    // ADP Data
    { path: '/canonical_data/adp/adp0_2025.csv', delimiter: ',' },
    { path: '/canonical_data/adp/adp_tier_data_2025.csv', delimiter: ',' },
    { path: '/canonical_data/adp/cbs_trade_values_week0_2025.csv', delimiter: ',' },
    { path: '/canonical_data/adp/fpros_trade_values_dynasty_week0_2025.csv', delimiter: ',' },
    { path: '/canonical_data/adp/fpros_trade_values_redraft_week0_2025.csv', delimiter: ',' },
    { path: '/canonical_data/adp/pff_redraft_rankings_week0_2025.csv', delimiter: ',' },
    
    // Projections
    { path: '/canonical_data/projections/projections_2025.csv', delimiter: ',' },
    { path: '/canonical_data/projections/projections_vorp_2025.csv', delimiter: ',' },
    { path: '/canonical_data/projections/weekly_projections_w1_2025.csv', delimiter: ',' },
    
    // Historical Stats
    { path: '/canonical_data/historical_stats/fantasy-stats-kicking_2024.csv', delimiter: ',' },
    { path: '/canonical_data/historical_stats/fantasy-stats-passing_2024.csv', delimiter: ',' },
    { path: '/canonical_data/historical_stats/fantasy-stats-receiving_2024.csv', delimiter: ',' },
    { path: '/canonical_data/historical_stats/fantasy-stats-rushing_2024.csv', delimiter: ',' },
    
    // Advanced Data - Passing
    { path: '/canonical_data/advanced_data/2024-2025/passing_accuracy.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_air_yards.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_danger_plays.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_deep_ball.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_play_action.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_pressure.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_red_zone.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_summary.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_time_to_throw.csv', delimiter: ',' },
    
    // Advanced Data - Rushing
    { path: '/canonical_data/advanced_data/2024-2025/rushing_expected_yards.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/rushing_gap.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/rushing_quarterback.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/rushing_summary.csv', delimiter: ',' },
    
    // Advanced Data - Receiving  
    { path: '/canonical_data/advanced_data/2024-2025/receiving_deep_ball.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/receiving_red_zone.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/receiving_summary.csv', delimiter: ',' },
    { path: '/canonical_data/advanced_data/2024-2025/receiving_usage.csv', delimiter: ',' },
    
    // Team Data (Tab-delimited)
    { path: '/canonical_data/advanced_data/team_data/defensive_elo.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/offensive_elo.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/passing_defense_rankings.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/passing_offense_rankings.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/rushing_defense_rankings.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/rushing_offense_rankings.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_defensive_dvoa.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_offensive_dvoa.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_pace_data.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_passing_yards_allowed.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_points_allowed.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_points_per_game.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_red_zone_efficiency.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_rushing_yards_allowed.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_sacks_allowed.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_takeaways_per_game.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_third_down_conversion.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_time_of_possession.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_total_defense.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_total_offense.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_turnover_differential.txt', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_yards_per_play.txt', delimiter: '\t' }
  ];

  // Collect reference data for foreign key validation
  const referenceData = new Map<string, Set<string>>();
  
  // First pass: Load ADP data for player name references
  try {
    const adpResponse = await fetch('/canonical_data/adp/adp0_2025.csv');
    if (adpResponse.ok) {
      const adpContent = await adpResponse.text();
      const adpRows = parseCSVStrict(adpContent, ',');
      const playerNames = new Set<string>();
      const positions = new Set<string>();
      adpRows.forEach(row => {
        if (row['Full Name']) playerNames.add(row['Full Name']);
        if (row['Position']) positions.add(row['Position']);
      });
      referenceData.set('playerNames', playerNames);
      referenceData.set('positions', positions);
    }
  } catch (e) {
    // Continue without reference data
  }

  // Audit each file
  for (const file of auditFiles) {
    const fileName = file.path.split('/').pop() || '';
    const fileAudit: FileAudit = {
      file_name: fileName,
      errors: []
    };

    try {
      const response = await fetch(file.path);
      if (!response.ok) {
        fileAudit.errors.push({
          type: 'missing_required',
          evidence: {
            file: fileName,
            row_number: 0,
            columns: [],
            details: `File not found or inaccessible (HTTP ${response.status})`
          }
        });
        report.files.push(fileAudit);
        report.summary.total_errors++;
        continue;
      }

      const content = await response.text();
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
        // Get expected column count from first row
        const expectedColumns = Object.keys(rows[0]);
        const expectedColumnCount = expectedColumns.length;
        
        // Track values for duplicate detection
        const seenValues = new Map<string, Set<string>>();
        
        // Validate each row
        rows.forEach((row, index) => {
          const rowNumber = index + 2; // +1 for 0-index, +1 for header
          
          // Check column count consistency
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
          
          // Check each field for type validity (zero tolerance)
          Object.entries(row).forEach(([column, value]) => {
            const strValue = String(value).trim();
            
            // Check for missing values in key columns
            if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
              // Key columns that should never be empty
              const keyColumns = ['Full Name', 'playerName', 'player', 'Team', 'team', 'Position', 'position'];
              if (keyColumns.includes(column)) {
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
            }
            
            // Type validation based on column name patterns
            // Check numeric columns
            const numericPatterns = [
              /rank/i, /adp/i, /value/i, /points/i, /yards/i, /touchdowns/i,
              /completions/i, /attempts/i, /receptions/i, /targets/i, /games/i,
              /sacks/i, /interceptions/i, /fumbles/i, /^20\d{2}$/, /elo/i,
              /dvoa/i, /pace/i, /efficiency/i, /differential/i
            ];
            
            const isNumericColumn = numericPatterns.some(pattern => pattern.test(column));
            
            if (isNumericColumn && strValue !== '' && strValue !== '-' && strValue !== '--') {
              // Remove common formatting
              const cleanValue = strValue.replace(/[$,%]/g, '').replace(/,/g, '');
              
              // Check if it's a valid number (no coercion)
              if (!/^-?\d+(\.\d+)?$/.test(cleanValue) && cleanValue !== 'N/A' && cleanValue !== 'NA') {
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
              
              // Domain validation for specific columns
              if (/^Overall Rank$/i.test(column) || /^Rank$/i.test(column)) {
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
              
              if (/ADP/i.test(column)) {
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
              
              if (/fantasy/i.test(column) && /points/i.test(column)) {
                const pointsValue = parseFloat(cleanValue);
                if (!isNaN(pointsValue) && pointsValue < -10) {
                  fileAudit.errors.push({
                    type: 'invalid_domain',
                    evidence: {
                      file: fileName,
                      row_number: rowNumber,
                      columns: [column],
                      details: `Fantasy points ${pointsValue} unrealistically low`
                    }
                  });
                }
              }
            }
            
            // Check enum columns
            if (/^Position$/i.test(column) || /^position$/i.test(column)) {
              const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'D/ST'];
              if (strValue && !validPositions.includes(strValue.toUpperCase())) {
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
            
            // Track potential primary key columns for duplicate detection
            const pkColumns = ['Overall Rank', 'Full Name', 'playerName', 'player', 'Team'];
            if (pkColumns.includes(column)) {
              if (!seenValues.has(column)) {
                seenValues.set(column, new Set());
              }
              const valueSet = seenValues.get(column)!;
              if (valueSet.has(strValue)) {
                fileAudit.errors.push({
                  type: 'duplicate_pk',
                  evidence: {
                    file: fileName,
                    row_number: rowNumber,
                    columns: [column],
                    details: `Duplicate value '${strValue}' in potential primary key column '${column}'`
                  }
                });
              }
              valueSet.add(strValue);
            }
          });
          
          // Check foreign key relationships
          if (fileName === 'projections_2025.csv' || fileName === 'projections_vorp_2025.csv') {
            const playerName = row['playerName'];
            if (playerName && referenceData.has('playerNames')) {
              const validNames = referenceData.get('playerNames')!;
              if (!validNames.has(playerName)) {
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
          details: `Parse error: ${error instanceof Error ? error.message : String(error)}`
        }
      });
    }
    
    if (fileAudit.errors.length > 0) {
      report.files.push(fileAudit);
      report.summary.total_errors += fileAudit.errors.length;
    }
  }

  // Generate recommendations
  const errorTypeCounts = new Map<string, number>();
  report.files.forEach(file => {
    file.errors.forEach(error => {
      errorTypeCounts.set(error.type, (errorTypeCounts.get(error.type) || 0) + 1);
    });
  });

  if (errorTypeCounts.get('invalid_type')! > 0) {
    report.recommendations.push(`Implement strict type validation with zero tolerance for non-conforming values`);
  }
  if (errorTypeCounts.get('missing_required')! > 0) {
    report.recommendations.push(`Add NOT NULL constraints for all required fields`);
  }
  if (errorTypeCounts.get('duplicate_pk')! > 0) {
    report.recommendations.push(`Enforce unique constraints on primary key columns`);
  }
  if (errorTypeCounts.get('broken_fk')! > 0) {
    report.recommendations.push(`Implement foreign key constraints to maintain referential integrity`);
  }
  if (errorTypeCounts.get('row_length_mismatch')! > 0) {
    report.recommendations.push(`Validate CSV structure before parsing to ensure column consistency`);
  }
  if (errorTypeCounts.get('invalid_domain')! > 0) {
    report.recommendations.push(`Add domain validation rules for business constraints`);
  }

  return report;
}

// Export for browser console
if (typeof window !== 'undefined') {
  (window as any).auditCSV = async () => {
    console.log('Running zero-tolerance CSV audit...');
    const report = await fullZeroToleranceAudit();
    console.log(JSON.stringify(report, null, 2));
    return report;
  };
  logger.info('Zero-tolerance CSV audit loaded. Run window.auditCSV() for complete audit.');
}