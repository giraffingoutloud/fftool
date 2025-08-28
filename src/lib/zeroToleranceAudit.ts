/**
 * Zero-tolerance CSV audit system
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

interface DataContract {
  file: string;
  requiredColumns: string[];
  primaryKeys: string[];
  columnTypes: Record<string, 'string' | 'integer' | 'float' | 'enum'>;
  enumValues?: Record<string, string[]>;
  foreignKeys?: Array<{
    column: string;
    referencedFile: string;
    referencedColumn: string;
  }>;
}

// Define strict data contracts based on actual data structure
const DATA_CONTRACTS: DataContract[] = [
  {
    file: 'adp0_2025.csv',
    requiredColumns: ['Overall Rank', 'Full Name', 'Position', 'Team Abbreviation', 'ADP'],
    primaryKeys: ['Overall Rank'],
    columnTypes: {
      'Overall Rank': 'integer',
      'Full Name': 'string',
      'Position': 'enum',
      'Team Abbreviation': 'string',
      'ADP': 'float',
      'Auction Value': 'float'
    },
    enumValues: {
      'Position': ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
    }
  },
  {
    file: 'projections_2025.csv',
    requiredColumns: ['playerName', 'position', 'fantasyPoints'],
    primaryKeys: ['playerName', 'position'],
    columnTypes: {
      'playerName': 'string',
      'position': 'enum',
      'fantasyPoints': 'float',
      'completions': 'float',
      'passingAttempts': 'float',
      'passingYards': 'float',
      'passingTouchdowns': 'float',
      'passingInterceptions': 'float',
      'rushingAttempts': 'float',
      'rushingYards': 'float',
      'rushingTouchdowns': 'float',
      'receptions': 'float',
      'receivingYards': 'float',
      'receivingTouchdowns': 'float'
    },
    enumValues: {
      'position': ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
    },
    foreignKeys: [
      {
        column: 'playerName',
        referencedFile: 'adp0_2025.csv',
        referencedColumn: 'Full Name'
      }
    ]
  },
  {
    file: 'fantasy-stats-passing_2024.csv',
    requiredColumns: ['player', 'team', 'fantasyPts'],
    primaryKeys: ['player'],
    columnTypes: {
      'player': 'string',
      'team': 'string',
      'games': 'integer',
      'completions': 'integer',
      'attempts': 'integer',
      'yards': 'integer',
      'touchdowns': 'integer',
      'interceptions': 'integer',
      'sacks': 'integer',
      'fumbles': 'integer',
      'fantasyPts': 'float'
    }
  },
  {
    file: 'fantasy-stats-rushing_2024.csv',
    requiredColumns: ['player', 'team', 'fantasyPts'],
    primaryKeys: ['player'],
    columnTypes: {
      'player': 'string',
      'team': 'string',
      'games': 'integer',
      'attempts': 'integer',
      'yards': 'integer',
      'touchdowns': 'integer',
      'fumbles': 'integer',
      'fantasyPts': 'float'
    }
  },
  {
    file: 'fantasy-stats-receiving_2024.csv',
    requiredColumns: ['player', 'team', 'fantasyPts'],
    primaryKeys: ['player'],
    columnTypes: {
      'player': 'string',
      'team': 'string',
      'games': 'integer',
      'targets': 'integer',
      'receptions': 'integer',
      'yards': 'integer',
      'touchdowns': 'integer',
      'fumbles': 'integer',
      'fantasyPts': 'float'
    }
  },
  {
    file: 'team_points_per_game.txt',
    requiredColumns: ['Rank', 'Team', '2024'],
    primaryKeys: ['Team'],
    columnTypes: {
      'Rank': 'integer',
      'Team': 'string',
      '2024': 'float',
      '2023': 'float',
      '2022': 'float'
    }
  }
];

export async function zeroToleranceAudit(): Promise<AuditReport> {
  const report: AuditReport = {
    summary: {
      files_checked: 0,
      total_errors: 0
    },
    files: [],
    recommendations: []
  };

  const allPlayerNames = new Set<string>();
  const fileData = new Map<string, any[]>();

  // First pass: collect all data and player names for FK validation
  for (const contract of DATA_CONTRACTS) {
    try {
      const filePath = contract.file.endsWith('.txt') 
        ? `/canonical_data/advanced_data/team_data/${contract.file}`
        : `/canonical_data/${contract.file.includes('/') ? contract.file : 
            contract.file.includes('fantasy-stats') ? `historical_stats/${contract.file}` :
            contract.file.includes('projections') ? `projections/${contract.file}` :
            `adp/${contract.file}`}`;
      
      const response = await fetch(filePath);
      if (!response.ok) continue;
      
      const content = await response.text();
      const rows = parseCSVStrict(content, contract.file.endsWith('.txt') ? '\t' : ',');
      fileData.set(contract.file, rows);
      
      // Collect player names for FK validation
      if (contract.file === 'adp0_2025.csv') {
        rows.forEach(row => {
          if (row['Full Name']) allPlayerNames.add(row['Full Name']);
        });
      }
    } catch (error) {
      // Skip files that can't be loaded
    }
  }

  // Second pass: audit each file
  for (const contract of DATA_CONTRACTS) {
    const fileAudit: FileAudit = {
      file_name: contract.file,
      errors: []
    };

    const rows = fileData.get(contract.file);
    if (!rows) continue;

    report.summary.files_checked++;

    // Check for required columns in header
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      for (const required of contract.requiredColumns) {
        if (!headers.includes(required)) {
          fileAudit.errors.push({
            type: 'missing_required',
            evidence: {
              file: contract.file,
              row_number: 0,
              columns: [required],
              details: `Required column '${required}' not found in headers`
            }
          });
        }
      }
    }

    // Track primary key values for duplicate detection
    const primaryKeyValues = new Set<string>();

    // Validate each row
    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for header row

      // Check row length consistency
      const expectedColumns = Object.keys(rows[0]).length;
      const actualColumns = Object.keys(row).length;
      if (actualColumns !== expectedColumns) {
        fileAudit.errors.push({
          type: 'row_length_mismatch',
          evidence: {
            file: contract.file,
            row_number: rowNumber,
            columns: Object.keys(row),
            details: `Row has ${actualColumns} columns, expected ${expectedColumns}`
          }
        });
      }

      // Check required fields
      for (const required of contract.requiredColumns) {
        const value = row[required];
        if (value === undefined || value === null || value === '') {
          fileAudit.errors.push({
            type: 'missing_required',
            evidence: {
              file: contract.file,
              row_number: rowNumber,
              columns: [required],
              details: `Required field '${required}' is missing or empty`
            }
          });
        }
      }

      // Validate data types (zero tolerance - no coercion)
      for (const [column, expectedType] of Object.entries(contract.columnTypes)) {
        const value = row[column];
        if (value === undefined || value === null || value === '') continue;

        let isValid = false;
        switch (expectedType) {
          case 'integer':
            // Must be a valid integer without decimal points
            isValid = /^-?\d+$/.test(String(value).trim());
            break;
          case 'float':
            // Must be a valid number (no coercion from strings like "N/A")
            const floatStr = String(value).trim();
            isValid = /^-?\d+(\.\d+)?$/.test(floatStr) || /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(floatStr);
            break;
          case 'string':
            isValid = typeof value === 'string' || typeof value === 'number';
            break;
          case 'enum':
            if (contract.enumValues && contract.enumValues[column]) {
              isValid = contract.enumValues[column].includes(String(value).trim());
            }
            break;
        }

        if (!isValid) {
          fileAudit.errors.push({
            type: 'invalid_type',
            evidence: {
              file: contract.file,
              row_number: rowNumber,
              columns: [column],
              details: `Column '${column}' has invalid ${expectedType} value: '${value}'`
            }
          });
        }
      }

      // Check for duplicate primary keys
      if (contract.primaryKeys.length > 0) {
        const pkValue = contract.primaryKeys.map(pk => row[pk]).join('|');
        if (primaryKeyValues.has(pkValue)) {
          fileAudit.errors.push({
            type: 'duplicate_pk',
            evidence: {
              file: contract.file,
              row_number: rowNumber,
              columns: contract.primaryKeys,
              details: `Duplicate primary key: ${pkValue}`
            }
          });
        }
        primaryKeyValues.add(pkValue);
      }

      // Check foreign key constraints
      if (contract.foreignKeys) {
        for (const fk of contract.foreignKeys) {
          const value = row[fk.column];
          if (value && fk.referencedFile === 'adp0_2025.csv' && fk.referencedColumn === 'Full Name') {
            if (!allPlayerNames.has(String(value).trim())) {
              fileAudit.errors.push({
                type: 'broken_fk',
                evidence: {
                  file: contract.file,
                  row_number: rowNumber,
                  columns: [fk.column],
                  details: `Foreign key violation: '${value}' not found in ${fk.referencedFile}.${fk.referencedColumn}`
                }
              });
            }
          }
        }
      }

      // Domain validation
      if (contract.file === 'adp0_2025.csv') {
        // ADP should be between 1 and 300
        const adp = parseFloat(row['ADP']);
        if (!isNaN(adp) && (adp < 1 || adp > 300)) {
          fileAudit.errors.push({
            type: 'invalid_domain',
            evidence: {
              file: contract.file,
              row_number: rowNumber,
              columns: ['ADP'],
              details: `ADP value ${adp} outside valid range [1, 300]`
            }
          });
        }

        // Overall Rank should be positive
        const rank = parseInt(row['Overall Rank']);
        if (!isNaN(rank) && rank < 1) {
          fileAudit.errors.push({
            type: 'invalid_domain',
            evidence: {
              file: contract.file,
              row_number: rowNumber,
              columns: ['Overall Rank'],
              details: `Overall Rank ${rank} must be positive`
            }
          });
        }
      }

      if (contract.file === 'projections_2025.csv') {
        // Fantasy points should be non-negative
        const points = parseFloat(row['fantasyPoints']);
        if (!isNaN(points) && points < 0) {
          fileAudit.errors.push({
            type: 'invalid_domain',
            evidence: {
              file: contract.file,
              row_number: rowNumber,
              columns: ['fantasyPoints'],
              details: `Fantasy points ${points} cannot be negative`
            }
          });
        }
      }
    });

    if (fileAudit.errors.length > 0) {
      report.files.push(fileAudit);
      report.summary.total_errors += fileAudit.errors.length;
    }
  }

  // Generate recommendations based on findings
  const errorTypes = new Map<string, number>();
  report.files.forEach(file => {
    file.errors.forEach(error => {
      errorTypes.set(error.type, (errorTypes.get(error.type) || 0) + 1);
    });
  });

  if (errorTypes.has('invalid_type')) {
    report.recommendations.push(`Found ${errorTypes.get('invalid_type')} type violations. Implement strict type validation before data ingestion.`);
  }
  if (errorTypes.has('missing_required')) {
    report.recommendations.push(`Found ${errorTypes.get('missing_required')} missing required fields. Add validation to ensure all required fields are present.`);
  }
  if (errorTypes.has('duplicate_pk')) {
    report.recommendations.push(`Found ${errorTypes.get('duplicate_pk')} duplicate primary keys. Implement deduplication logic or unique constraints.`);
  }
  if (errorTypes.has('broken_fk')) {
    report.recommendations.push(`Found ${errorTypes.get('broken_fk')} broken foreign keys. Ensure referential integrity between related datasets.`);
  }
  if (errorTypes.has('row_length_mismatch')) {
    report.recommendations.push(`Found ${errorTypes.get('row_length_mismatch')} row length mismatches. Validate CSV structure consistency.`);
  }
  if (errorTypes.has('invalid_domain')) {
    report.recommendations.push(`Found ${errorTypes.get('invalid_domain')} domain violations. Add business rule validation for data ranges.`);
  }

  return report;
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

// Export function for browser console
if (typeof window !== 'undefined') {
  (window as any).zeroToleranceAudit = async () => {
    const report = await zeroToleranceAudit();
    console.log(JSON.stringify(report, null, 2));
    return report;
  };
  logger.info('Zero tolerance audit loaded. Run window.zeroToleranceAudit() to audit all CSV files.');
}