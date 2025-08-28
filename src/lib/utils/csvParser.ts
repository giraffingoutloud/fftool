import Papa from 'papaparse';
import { logger } from './logger';

/**
 * Centralized CSV parsing configuration and utilities
 * Handles UTF-8 BOM, encoding issues, and provides consistent parsing across the application
 */

// Null value patterns that should be treated as undefined/null
export const NULL_VALUES = ['', '--', 'N/A', 'null', 'undefined', 'NA', 'n/a', '-'];

// Standard CSV parsing configuration
export const CSV_CONFIG = {
  NULL_VALUES,
  ENCODING: 'UTF-8',
  DEFAULT_OPTIONS: {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimitersToGuess: [',', '\t', '|', ';'],
    trimHeaders: true,
    transformHeader: (header: string) => header.trim()
  } as Papa.ParseConfig
};

/**
 * Remove UTF-8 BOM (Byte Order Mark) from content
 * BOM can cause issues with parsing the first column
 */
export function removeBOM(content: string): string {
  // Remove UTF-8 BOM if present (EF BB BF in hex, FEFF in Unicode)
  return content.replace(/^\uFEFF/, '').replace(/^\xEF\xBB\xBF/, '');
}

/**
 * Parse a number value handling various null patterns and formatting
 * @param value - The value to parse
 * @returns Parsed number or undefined if invalid/null
 */
export function parseNumber(value: any): number | undefined {
  // Check for null/undefined
  if (value == null) {
    return undefined;
  }

  // Convert to string and trim
  const strValue = String(value).trim();

  // Check against null value patterns
  if (NULL_VALUES.includes(strValue) || strValue.toLowerCase() === 'null' || strValue.toLowerCase() === 'undefined') {
    return undefined;
  }

  // Remove common formatting characters (commas, dollar signs, percentages)
  const cleanedValue = strValue
    .replace(/,/g, '')
    .replace(/\$/g, '')
    .replace(/%$/g, '');

  // Parse the number
  const num = parseFloat(cleanedValue);

  // Return undefined if parsing failed or resulted in NaN
  return isNaN(num) ? undefined : num;
}

/**
 * Parse an integer value
 */
export function parseInteger(value: any): number | undefined {
  const num = parseNumber(value);
  return num !== undefined ? Math.round(num) : undefined;
}

/**
 * Parse a boolean value
 */
export function parseBoolean(value: any): boolean | undefined {
  if (value == null || NULL_VALUES.includes(String(value).trim())) {
    return undefined;
  }
  
  const strValue = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 't', 'y'].includes(strValue)) {
    return true;
  }
  if (['false', 'no', '0', 'f', 'n'].includes(strValue)) {
    return false;
  }
  
  return undefined;
}

/**
 * Validate a CSV row for basic data integrity
 */
export function validateRow<T extends Record<string, any>>(row: T, requiredFields?: string[]): boolean {
  // Check if row is null or not an object
  if (!row || typeof row !== 'object') {
    return false;
  }

  // Check for required fields if specified
  if (requiredFields) {
    for (const field of requiredFields) {
      if (!(field in row) || row[field] == null || NULL_VALUES.includes(String(row[field]).trim())) {
        logger.warn(`Missing required field: ${field}`, { row });
        return false;
      }
    }
  }

  // Check if row has at least one non-null value
  const hasValue = Object.values(row).some(
    value => value != null && !NULL_VALUES.includes(String(value).trim())
  );

  return hasValue;
}

/**
 * Safe CSV parsing with BOM handling, validation, and error recovery
 * @param content - The CSV content to parse
 * @param options - Optional Papa.parse configuration
 * @param requiredFields - Optional list of required fields for validation
 * @returns Parsed and validated data array
 */
export function parseCSVSafe<T extends Record<string, any>>(
  content: string,
  options?: Papa.ParseConfig,
  requiredFields?: string[]
): T[] {
  try {
    // Remove BOM from content
    const cleanContent = removeBOM(content);

    // Check if content is empty
    if (!cleanContent || cleanContent.trim().length === 0) {
      logger.warn('Empty CSV content provided');
      return [];
    }

    // Parse CSV with merged options
    const result = Papa.parse<T>(cleanContent, {
      ...CSV_CONFIG.DEFAULT_OPTIONS,
      ...options,
      beforeFirstChunk: (chunk) => removeBOM(chunk)
    });

    // Filter critical errors (ignore field mismatch warnings)
    const criticalErrors = result.errors.filter(
      error => 
        error.type !== 'FieldMismatch' && 
        !error.message?.includes('Duplicate headers found') &&
        !error.message?.includes('Too many fields') &&
        !error.message?.includes('Too few fields')
    );

    if (criticalErrors.length > 0) {
      logger.error('Critical CSV parsing errors', { errors: criticalErrors });
      // Continue processing but log the errors
    }

    // Validate and filter rows
    const validData = result.data.filter(row => {
      const isValid = validateRow(row, requiredFields);
      if (!isValid) {
        logger.debug('Invalid row filtered', { row });
      }
      return isValid;
    });

    logger.info(`CSV parsed successfully: ${validData.length} valid rows out of ${result.data.length} total`);
    return validData;

  } catch (error) {
    logger.error('Failed to parse CSV', { error });
    return [];
  }
}

/**
 * Parse CSV with specific column mappings
 * Useful when CSV headers don't match expected property names
 */
export function parseCSVWithMapping<T extends Record<string, any>>(
  content: string,
  columnMapping: Record<string, string | string[]>,
  options?: Papa.ParseConfig
): T[] {
  const data = parseCSVSafe<Record<string, any>>(content, options);
  
  return data.map(row => {
    const mappedRow: any = {};
    
    for (const [targetField, sourceFields] of Object.entries(columnMapping)) {
      const sources = Array.isArray(sourceFields) ? sourceFields : [sourceFields];
      
      // Try each source field until we find a non-null value
      for (const sourceField of sources) {
        const value = row[sourceField];
        if (value != null && !NULL_VALUES.includes(String(value).trim())) {
          mappedRow[targetField] = value;
          break;
        }
      }
    }
    
    return mappedRow as T;
  });
}

/**
 * Parse tab-delimited content (common in some data sources)
 */
export function parseTabDelimited<T extends Record<string, any>>(
  content: string,
  headers?: string[],
  requiredFields?: string[]
): T[] {
  return parseCSVSafe<T>(
    content,
    {
      delimiter: '\t',
      header: headers ? false : true
    },
    requiredFields
  );
}

/**
 * Parse CSV with duplicate column handling (like FantasyPros format)
 */
export function parseCSVWithDuplicateColumns(
  content: string,
  duplicateRenaming: Record<string, { count: number; names: string[] }>
): any[] {
  // Remove BOM
  const cleanContent = removeBOM(content);
  
  const lines = cleanContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return [];
  }

  // Process headers to handle duplicates
  const headers = lines[0].split(',');
  const counters: Record<string, number> = {};
  
  const newHeaders = headers.map(h => {
    const cleaned = h.replace(/"/g, '').trim();
    
    if (duplicateRenaming[cleaned]) {
      counters[cleaned] = (counters[cleaned] || 0) + 1;
      const index = counters[cleaned] - 1;
      const newName = duplicateRenaming[cleaned].names[index] || cleaned;
      return `"${newName}"`;
    }
    
    return h;
  });

  // Reconstruct CSV with new headers
  const fixedContent = [newHeaders.join(','), ...lines.slice(1)].join('\n');
  
  return parseCSVSafe(fixedContent);
}

/**
 * Detect the delimiter used in a CSV file
 */
export function detectDelimiter(content: string): string {
  const delimiters = [',', '\t', ';', '|'];
  const counts: Record<string, number> = {};
  
  // Count occurrences of each delimiter in first few lines
  const lines = content.split('\n').slice(0, 5);
  
  for (const delimiter of delimiters) {
    counts[delimiter] = lines.reduce((sum, line) => 
      sum + (line.split(delimiter).length - 1), 0
    );
  }
  
  // Return delimiter with highest count
  return Object.entries(counts).reduce((a, b) => 
    counts[a[0]] > counts[b[0]] ? a : b
  )[0];
}

/**
 * Stream parse large CSV files (for memory efficiency)
 */
export function streamParseCSV<T extends Record<string, any>>(
  content: string,
  onRow: (row: T, index: number) => void,
  options?: Papa.ParseConfig
): Promise<void> {
  return new Promise((resolve, reject) => {
    let rowIndex = 0;
    
    Papa.parse(removeBOM(content), {
      ...CSV_CONFIG.DEFAULT_OPTIONS,
      ...options,
      step: (results: any) => {
        if (validateRow(results.data)) {
          onRow(results.data as T, rowIndex++);
        }
      },
      complete: () => resolve(),
      error: (error: any) => {
        logger.error('Stream parsing error', { error });
        reject(error);
      }
    });
  });
}