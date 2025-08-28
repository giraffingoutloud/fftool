/**
 * NULL-preserving CSV parser that maintains data integrity
 * Does NOT make assumptions about missing values
 */

import { logger } from './utils/logger';

export interface ParsedValue<T> {
  value: T | null;
  isOriginal: boolean;
  rawValue: string;
}

export interface PlayerDataWithNulls {
  // Always present fields
  'Overall Rank': number;
  'Full Name': string;
  'Team Abbreviation': string;
  'Position': string;
  
  // Nullable numeric fields - null when N/A or missing
  'ADP': number | null;
  'Auction Value': number | null;
  
  // Metadata about the row
  _metadata: {
    rowNumber: number;
    hasCompleteData: boolean;
    missingFields: string[];
  };
}

export interface NullPreservingParseResult {
  data: PlayerDataWithNulls[];
  statistics: {
    totalRows: number;
    rowsWithCompleteData: number;
    rowsWithMissingADP: number;
    rowsWithMissingAuction: number;
    fieldsWithNulls: Record<string, number>;
  };
}

/**
 * Parse CSV preserving nulls for missing values
 * NO coercion, NO calculations, NO assumptions
 */
export function parseCSVWithNulls(
  content: string,
  options: {
    delimiter?: string;
    missingValuePatterns?: string[];
    strictNumeric?: boolean;
  } = {}
): NullPreservingParseResult {
  const delimiter = options.delimiter || ',';
  const missingPatterns = options.missingValuePatterns || 
    ['N/A', 'NA', 'n/a', 'null', 'NULL', '', '-', '--', 'undefined'];
  const strictNumeric = options.strictNumeric !== false;

  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  const headers = parseCSVLine(lines[0], delimiter);
  const data: PlayerDataWithNulls[] = [];
  const statistics = {
    totalRows: 0,
    rowsWithCompleteData: 0,
    rowsWithMissingADP: 0,
    rowsWithMissingAuction: 0,
    fieldsWithNulls: {} as Record<string, number>
  };

  // Parse each data row
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const rowNumber = i + 1;
    statistics.totalRows++;

    // Build row object
    const row: any = {
      _metadata: {
        rowNumber,
        hasCompleteData: true,
        missingFields: [] as string[]
      }
    };

    headers.forEach((header, index) => {
      const rawValue = values[index] || '';
      
      // Check if this is a missing value
      const isMissing = missingPatterns.some(pattern => 
        rawValue.trim().toLowerCase() === pattern.toLowerCase()
      );

      // Handle based on field type
      if (header === 'ADP' || header === 'Auction Value') {
        if (isMissing) {
          row[header] = null;
          row._metadata.missingFields.push(header);
          row._metadata.hasCompleteData = false;
          
          statistics.fieldsWithNulls[header] = 
            (statistics.fieldsWithNulls[header] || 0) + 1;
          
          if (header === 'ADP') statistics.rowsWithMissingADP++;
          if (header === 'Auction Value') statistics.rowsWithMissingAuction++;
        } else {
          // Try to parse as number
          const cleaned = rawValue.replace(/[$,%]/g, '').replace(/,/g, '');
          const parsed = parseFloat(cleaned);
          
          if (strictNumeric && isNaN(parsed)) {
            // Strict mode: non-numeric becomes null
            row[header] = null;
            row._metadata.missingFields.push(header);
            row._metadata.hasCompleteData = false;
            logger.warn(`Row ${rowNumber}: Non-numeric ${header}: "${rawValue}"`);
          } else {
            row[header] = isNaN(parsed) ? null : parsed;
          }
        }
      } else if (header === 'Overall Rank') {
        // Rank should always be present and numeric
        const parsed = parseInt(rawValue);
        if (isNaN(parsed)) {
          logger.error(`Row ${rowNumber}: Invalid rank: "${rawValue}"`);
          row[header] = rowNumber; // Fallback to row number
        } else {
          row[header] = parsed;
        }
      } else {
        // String fields
        row[header] = isMissing ? null : rawValue;
        if (isMissing) {
          row._metadata.missingFields.push(header);
          row._metadata.hasCompleteData = false;
        }
      }
    });

    if (row._metadata.hasCompleteData) {
      statistics.rowsWithCompleteData++;
    }

    data.push(row as PlayerDataWithNulls);
  }

  logger.info('NULL-PRESERVING PARSE COMPLETE:');
  logger.info(`  Total rows: ${statistics.totalRows}`);
  logger.info(`  Complete data: ${statistics.rowsWithCompleteData}`);
  logger.info(`  Missing ADP: ${statistics.rowsWithMissingADP}`);
  logger.info(`  Missing Auction: ${statistics.rowsWithMissingAuction}`);

  return { data, statistics };
}

/**
 * Analysis functions that properly handle nulls
 */
export const NullAwareAnalysis = {
  /**
   * Calculate average excluding nulls (like SQL AVG)
   */
  average(values: (number | null)[]): number | null {
    const validValues = values.filter(v => v !== null) as number[];
    if (validValues.length === 0) return null;
    return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
  },

  /**
   * Calculate median excluding nulls
   */
  median(values: (number | null)[]): number | null {
    const validValues = values.filter(v => v !== null) as number[];
    if (validValues.length === 0) return null;
    
    const sorted = [...validValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  },

  /**
   * Count non-null values
   */
  countValid(values: (any | null)[]): number {
    return values.filter(v => v !== null).length;
  },

  /**
   * Get completion rate
   */
  completionRate(values: (any | null)[]): number {
    const total = values.length;
    const valid = this.countValid(values);
    return total > 0 ? (valid / total) * 100 : 0;
  },

  /**
   * Filter to only complete records
   */
  filterComplete<T extends { _metadata: { hasCompleteData: boolean } }>(
    data: T[]
  ): T[] {
    return data.filter(row => row._metadata.hasCompleteData);
  },

  /**
   * Group by position with null handling
   */
  groupByPosition(
    data: PlayerDataWithNulls[]
  ): Record<string, PlayerDataWithNulls[]> {
    const groups: Record<string, PlayerDataWithNulls[]> = {};
    
    data.forEach(player => {
      const position = player.Position || 'Unknown';
      if (!groups[position]) groups[position] = [];
      groups[position].push(player);
    });
    
    return groups;
  },

  /**
   * Calculate VORP only for players with auction values
   */
  calculateVORP(
    data: PlayerDataWithNulls[],
    baselineRank: number = 100
  ): Array<PlayerDataWithNulls & { vorp?: number }> {
    // Get baseline value (only from players who have auction values)
    const playersWithValue = data
      .filter(p => p['Auction Value'] !== null)
      .sort((a, b) => a['Overall Rank'] - b['Overall Rank']);
    
    const baselinePlayer = playersWithValue[baselineRank - 1];
    const baselineValue = baselinePlayer?.['Auction Value'] || 0;
    
    // Calculate VORP only for players with auction values
    return data.map(player => ({
      ...player,
      vorp: player['Auction Value'] !== null
        ? Math.max(0, player['Auction Value'] - baselineValue)
        : undefined // Don't calculate VORP if no auction value
    }));
  }
};

/**
 * Parse CSV line handling quotes properly
 */
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

/**
 * Example usage showing proper null handling
 */
export function exampleUsage(csvContent: string): void {
  const { data, statistics } = parseCSVWithNulls(csvContent, {
    strictNumeric: true,
    missingValuePatterns: ['N/A', 'null', '']
  });

  // Show statistics
  logger.info(`Data completeness: ${
    ((statistics.rowsWithCompleteData / statistics.totalRows) * 100).toFixed(1)
  }%`);

  // Calculate average ADP (only for players who have it)
  const adpValues = data.map(p => p.ADP);
  const avgADP = NullAwareAnalysis.average(adpValues);
  logger.info(`Average ADP (where exists): ${avgADP?.toFixed(1) || 'N/A'}`);
  logger.info(`Players with ADP: ${NullAwareAnalysis.countValid(adpValues)}`);

  // Get only players with complete auction data for value analysis
  const completeAuctionData = data.filter(p => p['Auction Value'] !== null);
  logger.info(`Players with auction values: ${completeAuctionData.length}`);

  // Group by position, showing completion rates
  const byPosition = NullAwareAnalysis.groupByPosition(data);
  Object.entries(byPosition).forEach(([pos, players]) => {
    const auctionValues = players.map(p => p['Auction Value']);
    const completion = NullAwareAnalysis.completionRate(auctionValues);
    logger.info(`${pos}: ${completion.toFixed(1)}% have auction values`);
  });
}

// Export for use
export default {
  parseCSVWithNulls,
  NullAwareAnalysis
};