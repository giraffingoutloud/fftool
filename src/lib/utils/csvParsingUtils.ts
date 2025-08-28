/**
 * Robust CSV Parsing Utilities
 * Provides safe parsing functions that preserve null values and prevent data corruption
 */

import Papa from 'papaparse';

/**
 * Standard null value tokens that should be treated as missing data
 */
export const NULL_TOKENS = new Set([
  '', 'NA', 'N/A', 'n/a', 'null', 'NULL', 'None', 'NONE',
  'nan', 'NaN', '#N/A', '#NULL!', '--', '-', 'undefined',
  '#VALUE!', '#ERROR!', 'nil', 'NIL', 'missing', 'MISSING'
]);

/**
 * Standard Papa Parse configuration for consistent CSV parsing
 */
export const STANDARD_PAPA_CONFIG: Papa.ParseConfig = {
  header: true,
  dynamicTyping: false, // We'll handle typing ourselves to prevent corruption
  skipEmptyLines: 'greedy', // Skip all empty lines
  transformHeader: (header: string) => header.trim(),
  transform: (value: string) => value.trim(),
  delimiter: '', // Auto-detect
  encoding: 'UTF-8',
  comments: false,
  fastMode: false,
  delimitersToGuess: [',', '\t', '|', ';']
};

/**
 * Safely parse a numeric value, preserving nulls
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails (defaults to null)
 * @returns Parsed number or null
 */
export function safeParseNumber(value: any, defaultValue: number | null = null): number | null {
  // Handle undefined or null
  if (value === undefined || value === null) {
    return defaultValue;
  }

  // Convert to string for consistent processing
  const strValue = String(value).trim();

  // Check if it's a known null token
  if (NULL_TOKENS.has(strValue)) {
    return null;
  }

  // Remove currency symbols and thousands separators
  const cleaned = strValue
    .replace(/[$£€¥]/g, '')
    .replace(/,/g, '')
    .replace(/%$/g, ''); // Remove trailing percentage

  // Try to parse as number
  const parsed = Number(cleaned);

  // Check if parsing succeeded
  if (!isNaN(parsed) && isFinite(parsed)) {
    // If original had %, divide by 100
    if (strValue.endsWith('%')) {
      return parsed / 100;
    }
    return parsed;
  }

  // Return default if parsing failed
  return defaultValue;
}

/**
 * Safely parse an integer value, preserving nulls
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails (defaults to null)
 * @returns Parsed integer or null
 */
export function safeParseInt(value: any, defaultValue: number | null = null): number | null {
  const parsed = safeParseNumber(value, defaultValue);
  return parsed !== null ? Math.round(parsed) : null;
}

/**
 * Safely parse a float value, preserving nulls
 * @param value - The value to parse
 * @param precision - Number of decimal places to round to
 * @param defaultValue - Default value if parsing fails (defaults to null)
 * @returns Parsed float or null
 */
export function safeParseFloat(
  value: any, 
  precision: number | null = null, 
  defaultValue: number | null = null
): number | null {
  const parsed = safeParseNumber(value, defaultValue);
  if (parsed !== null && precision !== null) {
    return Math.round(parsed * Math.pow(10, precision)) / Math.pow(10, precision);
  }
  return parsed;
}

/**
 * Check if a value should be treated as null/missing
 * @param value - The value to check
 * @returns True if the value is null/missing
 */
export function isNullValue(value: any): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  const strValue = String(value).trim();
  return NULL_TOKENS.has(strValue);
}

/**
 * Parse a boolean value with null preservation
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed boolean or null
 */
export function safeParseBoolean(value: any, defaultValue: boolean | null = null): boolean | null {
  if (isNullValue(value)) {
    return defaultValue;
  }

  const strValue = String(value).trim().toLowerCase();
  
  // True values
  if (['true', '1', 'yes', 'y', 'on', 'enabled'].includes(strValue)) {
    return true;
  }
  
  // False values
  if (['false', '0', 'no', 'n', 'off', 'disabled'].includes(strValue)) {
    return false;
  }
  
  return defaultValue;
}

/**
 * Parse a string value with null preservation
 * @param value - The value to parse
 * @param defaultValue - Default value if null
 * @returns Parsed string or null
 */
export function safeParseString(value: any, defaultValue: string | null = null): string | null {
  if (isNullValue(value)) {
    return defaultValue;
  }
  return String(value).trim();
}

/**
 * Parse CSV content with standardized configuration
 * @param content - CSV content as string
 * @param config - Optional Papa Parse config overrides
 * @returns Parsed result with data and errors
 */
export function parseCSV<T = any>(
  content: string,
  config?: Partial<Papa.ParseConfig>
): Papa.ParseResult<T> {
  const mergedConfig = {
    ...STANDARD_PAPA_CONFIG,
    ...config
  };
  
  return Papa.parse<T>(content, mergedConfig);
}

/**
 * Parse CSV file with standardized configuration
 * @param file - File object to parse
 * @param config - Optional Papa Parse config overrides
 * @returns Promise with parsed result
 */
export function parseCSVFile<T = any>(
  file: File,
  config?: Partial<Papa.ParseConfig>
): Promise<Papa.ParseResult<T>> {
  return new Promise((resolve, reject) => {
    const mergedConfig = {
      ...STANDARD_PAPA_CONFIG,
      ...config,
      complete: (results: Papa.ParseResult<T>) => resolve(results),
      error: (error: Error) => reject(error)
    };
    
    Papa.parse(file, mergedConfig);
  });
}

/**
 * Validate row data against expected schema
 * @param row - Data row to validate
 * @param schema - Expected schema
 * @returns Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: any[];
}

export function validateRow(
  row: Record<string, any>,
  schema: ColumnSchema[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const column of schema) {
    const value = row[column.name];
    const isNull = isNullValue(value);

    // Check required fields
    if (column.required && isNull) {
      errors.push(`Required field '${column.name}' is missing`);
      continue;
    }

    // Skip validation for null values in optional fields
    if (isNull && !column.required) {
      continue;
    }

    // Type validation
    switch (column.type) {
      case 'number':
        const numValue = safeParseNumber(value);
        if (numValue === null && !isNull) {
          errors.push(`Field '${column.name}' is not a valid number: ${value}`);
        } else if (numValue !== null) {
          if (column.min !== undefined && numValue < column.min) {
            warnings.push(`Field '${column.name}' value ${numValue} is below minimum ${column.min}`);
          }
          if (column.max !== undefined && numValue > column.max) {
            warnings.push(`Field '${column.name}' value ${numValue} is above maximum ${column.max}`);
          }
        }
        break;

      case 'string':
        const strValue = safeParseString(value);
        if (strValue && column.pattern && !column.pattern.test(strValue)) {
          warnings.push(`Field '${column.name}' value doesn't match expected pattern`);
        }
        if (strValue && column.allowedValues && !column.allowedValues.includes(strValue)) {
          errors.push(`Field '${column.name}' value '${strValue}' is not in allowed values`);
        }
        break;

      case 'boolean':
        const boolValue = safeParseBoolean(value);
        if (boolValue === null && !isNull) {
          errors.push(`Field '${column.name}' is not a valid boolean: ${value}`);
        }
        break;

      case 'date':
        const dateValue = Date.parse(String(value));
        if (isNaN(dateValue) && !isNull) {
          errors.push(`Field '${column.name}' is not a valid date: ${value}`);
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Count null values in a dataset
 * @param data - Array of data rows
 * @returns Object with null counts per column
 */
export function countNullValues(data: Record<string, any>[]): Record<string, number> {
  const nullCounts: Record<string, number> = {};

  if (data.length === 0) return nullCounts;

  // Initialize counts
  const columns = Object.keys(data[0]);
  columns.forEach(col => nullCounts[col] = 0);

  // Count nulls
  data.forEach(row => {
    columns.forEach(col => {
      if (isNullValue(row[col])) {
        nullCounts[col]++;
      }
    });
  });

  return nullCounts;
}

/**
 * Get data completeness statistics
 * @param data - Array of data rows
 * @returns Completeness statistics
 */
export interface CompletenessStats {
  totalRows: number;
  totalColumns: number;
  totalCells: number;
  nullCells: number;
  completenessPercentage: number;
  columnCompleteness: Record<string, number>;
}

export function getCompletenessStats(data: Record<string, any>[]): CompletenessStats {
  if (data.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      totalCells: 0,
      nullCells: 0,
      completenessPercentage: 100,
      columnCompleteness: {}
    };
  }

  const columns = Object.keys(data[0]);
  const totalRows = data.length;
  const totalColumns = columns.length;
  const totalCells = totalRows * totalColumns;
  
  const nullCounts = countNullValues(data);
  const nullCells = Object.values(nullCounts).reduce((sum, count) => sum + count, 0);
  
  const columnCompleteness: Record<string, number> = {};
  columns.forEach(col => {
    const nonNullCount = totalRows - nullCounts[col];
    columnCompleteness[col] = (nonNullCount / totalRows) * 100;
  });

  return {
    totalRows,
    totalColumns,
    totalCells,
    nullCells,
    completenessPercentage: ((totalCells - nullCells) / totalCells) * 100,
    columnCompleteness
  };
}

/**
 * Clean and normalize CSV data
 * @param data - Raw CSV data
 * @param options - Cleaning options
 * @returns Cleaned data
 */
export interface CleaningOptions {
  trimStrings?: boolean;
  removeEmptyRows?: boolean;
  normalizeHeaders?: boolean;
  deduplicateRows?: boolean;
  keyColumns?: string[];
}

export function cleanCSVData<T extends Record<string, any>>(
  data: T[],
  options: CleaningOptions = {}
): T[] {
  let cleaned = [...data];

  // Remove empty rows
  if (options.removeEmptyRows !== false) {
    cleaned = cleaned.filter(row => {
      const values = Object.values(row);
      return values.some(v => !isNullValue(v));
    });
  }

  // Trim string values
  if (options.trimStrings !== false) {
    cleaned = cleaned.map(row => {
      const trimmedRow: any = {};
      Object.entries(row).forEach(([key, value]) => {
        if (typeof value === 'string') {
          trimmedRow[key] = value.trim();
        } else {
          trimmedRow[key] = value;
        }
      });
      return trimmedRow;
    });
  }

  // Deduplicate rows
  if (options.deduplicateRows && options.keyColumns) {
    const seen = new Set<string>();
    cleaned = cleaned.filter(row => {
      const key = options.keyColumns!
        .map(col => String(row[col] || '').toLowerCase())
        .join('|');
      
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return cleaned;
}