/**
 * CSV Schema Definitions and Strict Enforcement
 * Provides explicit dtypes, validation rules, and referential integrity
 */

import { logger } from './logger';

// Data types for CSV columns
export enum ColumnType {
  STRING = 'string',
  INTEGER = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ENUM = 'enum',
  PERCENTAGE = 'percentage',
  CURRENCY = 'currency'
}

// Column definition with strict typing
export interface ColumnSchema {
  name: string;
  type: ColumnType;
  required: boolean;
  unique?: boolean;
  allowedValues?: any[]; // For ENUM type
  min?: number; // For numeric types
  max?: number; // For numeric types
  pattern?: RegExp; // For string validation
  foreignKey?: { // For referential integrity
    table: string;
    column: string;
  };
  transform?: (value: any) => any; // Custom transformation
  default?: any; // Default value if missing
}

// Complete schema for a CSV file
export interface CSVSchema {
  name: string; // Schema identifier
  columns: ColumnSchema[];
  uniqueKeys: string[][]; // Composite unique keys
  allowExtraColumns: boolean;
  encoding: 'UTF-8' | 'UTF-16' | 'ASCII';
  delimiter: string;
  quoteChar: string;
  escapeChar: string;
  hasHeader: boolean;
  skipRows: number;
  maxRows?: number;
  naValues: string[];
  thousandsSeparator: string;
  decimalSeparator: string;
  dateFormat?: string;
  duplicatePolicy: 'fail' | 'first' | 'last' | 'quarantine';
  validationMode: 'strict' | 'warning' | 'permissive';
}

// Parsing configuration with explicit settings
export interface ParseConfig {
  schema: CSVSchema;
  bomHandling: 'remove' | 'keep' | 'fail';
  trimWhitespace: boolean;
  skipEmptyLines: boolean;
  maxErrors: number;
  quarantinePath?: string;
  logPath?: string;
}

// Data lineage tracking
export interface DataLineage {
  sourceFile: string;
  parsedAt: Date;
  rowCountOriginal: number;
  rowCountAfterHeaders: number;
  rowCountAfterEmpty: number;
  rowCountAfterDuplicates: number;
  rowCountAfterValidation: number;
  rowCountFinal: number;
  duplicatesRemoved: number;
  validationErrors: number;
  coercions: Array<{
    row: number;
    column: string;
    originalValue: any;
    coercedValue: any;
    reason: string;
  }>;
  quarantinedRows: Array<{
    row: number;
    data: any;
    reason: string;
  }>;
}

// Referential integrity definition
export interface ReferentialIntegrityRule {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  nullable: boolean;
  onMissing: 'fail' | 'warn' | 'ignore' | 'setNull';
}

// Parse result with lineage
export interface StrictParseResult<T> {
  data: T[];
  lineage: DataLineage;
  errors: ParseError[];
  warnings: ParseWarning[];
  success: boolean;
}

export interface ParseError {
  row?: number;
  column?: string;
  value?: any;
  message: string;
  type: 'type' | 'range' | 'required' | 'unique' | 'referential' | 'schema';
}

export interface ParseWarning {
  row?: number;
  column?: string;
  value?: any;
  message: string;
  type: string;
}

/**
 * Pre-defined schemas for FFTools CSV files
 */
export const CSV_SCHEMAS = {
  // ADP Data Schema
  ADP_DATA: {
    name: 'adp_data',
    columns: [
      { name: 'Overall Rank', type: ColumnType.INTEGER, required: true, min: 1, max: 500 },
      { name: 'Full Name', type: ColumnType.STRING, required: true },
      { name: 'Team Abbreviation', type: ColumnType.STRING, required: true, pattern: /^[A-Z]{2,3}$/ },
      { name: 'Position', type: ColumnType.ENUM, required: true, allowedValues: ['QB', 'RB', 'WR', 'TE', 'DST', 'K'] },
      { name: 'Position Rank', type: ColumnType.INTEGER, required: true, min: 1, max: 100 },
      { name: 'Bye Week', type: ColumnType.INTEGER, required: false, min: 1, max: 18 },
      { name: 'ADP', type: ColumnType.FLOAT, required: true, min: 1, max: 300 },
      { name: 'Projected Points', type: ColumnType.FLOAT, required: true, min: 0, max: 500 },
      { name: 'Auction Value', type: ColumnType.CURRENCY, required: false, min: 0, max: 200 },
      { name: 'Is Rookie', type: ColumnType.ENUM, required: false, allowedValues: ['Yes', 'No'] },
      { name: 'Data Status', type: ColumnType.ENUM, required: false, allowedValues: ['Complete', 'Partial', 'Pending'] }
    ],
    uniqueKeys: [['Full Name', 'Position']],
    allowExtraColumns: false,
    encoding: 'UTF-8',
    delimiter: ',',
    quoteChar: '"',
    escapeChar: '\\',
    hasHeader: true,
    skipRows: 0,
    naValues: ['', 'N/A', '--', 'null', 'NA', 'n/a', '-'],
    thousandsSeparator: ',',
    decimalSeparator: '.',
    duplicatePolicy: 'fail',
    validationMode: 'strict'
  } as CSVSchema,

  // Player Projections Schema
  PROJECTIONS: {
    name: 'projections',
    columns: [
      { name: 'playerName', type: ColumnType.STRING, required: true },
      { name: 'teamName', type: ColumnType.STRING, required: true },
      { name: 'position', type: ColumnType.ENUM, required: true, allowedValues: ['QB', 'RB', 'WR', 'TE', 'DST', 'K'] },
      { name: 'byeWeek', type: ColumnType.INTEGER, required: false, min: 1, max: 18 },
      { name: 'games', type: ColumnType.INTEGER, required: false, min: 0, max: 17 },
      { name: 'fantasyPoints', type: ColumnType.FLOAT, required: true, min: 0, max: 600 },
      { name: 'auctionValue', type: ColumnType.CURRENCY, required: false, min: 0, max: 200 },
      { name: 'passComp', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'passAtt', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'passYds', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'passTd', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'passInt', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'rushAtt', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'rushYds', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'rushTd', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'recvTargets', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'recvReceptions', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'recvYds', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'recvTd', type: ColumnType.FLOAT, required: false, min: 0 }
    ],
    uniqueKeys: [['playerName', 'teamName', 'position']],
    allowExtraColumns: true, // Some sources have additional stats
    encoding: 'UTF-8',
    delimiter: ',',
    quoteChar: '"',
    escapeChar: '\\',
    hasHeader: true,
    skipRows: 0,
    naValues: ['', 'N/A', '--', 'null', 'NA', 'n/a', '-', '0'],
    thousandsSeparator: ',',
    decimalSeparator: '.',
    duplicatePolicy: 'last', // Keep most recent projection
    validationMode: 'strict'
  } as CSVSchema,

  // Team Metrics Schema (Tab-delimited)
  TEAM_METRICS: {
    name: 'team_metrics',
    columns: [
      { name: 'Rank', type: ColumnType.INTEGER, required: true, min: 1, max: 32 },
      { name: 'Team', type: ColumnType.STRING, required: true },
      { name: '2024', type: ColumnType.FLOAT, required: false },
      { name: 'Last 3', type: ColumnType.FLOAT, required: false },
      { name: 'Last 1', type: ColumnType.FLOAT, required: false },
      { name: 'Home', type: ColumnType.FLOAT, required: false },
      { name: 'Away', type: ColumnType.FLOAT, required: false },
      { name: '2023', type: ColumnType.FLOAT, required: false }
    ],
    uniqueKeys: [['Team']],
    allowExtraColumns: false,
    encoding: 'UTF-8',
    delimiter: '\t',
    quoteChar: '"',
    escapeChar: '\\',
    hasHeader: true,
    skipRows: 0,
    naValues: ['', '--', 'N/A'],
    thousandsSeparator: ',',
    decimalSeparator: '.',
    duplicatePolicy: 'fail',
    validationMode: 'strict'
  } as CSVSchema,

  // Fantasy Pros Advanced Stats Schema
  ADVANCED_STATS_WR: {
    name: 'advanced_stats_wr',
    columns: [
      { name: 'Player', type: ColumnType.STRING, required: true },
      { name: 'Team', type: ColumnType.STRING, required: false },
      { name: 'Targets', type: ColumnType.INTEGER, required: false, min: 0 },
      { name: 'Target Share', type: ColumnType.PERCENTAGE, required: false, min: 0, max: 100 },
      { name: 'Receptions', type: ColumnType.INTEGER, required: false, min: 0 },
      { name: 'Catch Rate', type: ColumnType.PERCENTAGE, required: false, min: 0, max: 100 },
      { name: 'Yards', type: ColumnType.INTEGER, required: false, min: 0 },
      { name: 'YAC', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'Air Yards', type: ColumnType.FLOAT, required: false, min: 0 },
      { name: 'Red Zone Targets', type: ColumnType.INTEGER, required: false, min: 0 },
      { name: 'TDs', type: ColumnType.INTEGER, required: false, min: 0 }
    ],
    uniqueKeys: [['Player']],
    allowExtraColumns: true,
    encoding: 'UTF-8',
    delimiter: ',',
    quoteChar: '"',
    escapeChar: '\\',
    hasHeader: true,
    skipRows: 0,
    naValues: ['', '--', 'N/A', '-'],
    thousandsSeparator: ',',
    decimalSeparator: '.',
    duplicatePolicy: 'last',
    validationMode: 'warning'
  } as CSVSchema
};

/**
 * Referential integrity rules for FFTools data
 */
export const REFERENTIAL_INTEGRITY_RULES: ReferentialIntegrityRule[] = [
  // Player names in projections must exist in ADP data
  {
    sourceTable: 'projections',
    sourceColumn: 'playerName',
    targetTable: 'adp_data',
    targetColumn: 'Full Name',
    nullable: false,
    onMissing: 'warn'
  },
  // Team codes must be valid
  {
    sourceTable: 'projections',
    sourceColumn: 'teamName',
    targetTable: 'team_metrics',
    targetColumn: 'Team',
    nullable: false,
    onMissing: 'fail'
  },
  // Player in advanced stats should exist in projections
  {
    sourceTable: 'advanced_stats_wr',
    sourceColumn: 'Player',
    targetTable: 'projections',
    targetColumn: 'playerName',
    nullable: false,
    onMissing: 'warn'
  }
];

/**
 * Type coercion functions for each data type
 */
export const TYPE_COERCERS = {
  [ColumnType.STRING]: (value: any, schema: ColumnSchema): string | null => {
    if (value == null) return schema.required ? null : (schema.default ?? null);
    const str = String(value).trim();
    if (schema.pattern && !schema.pattern.test(str)) {
      throw new Error(`Value "${str}" does not match pattern ${schema.pattern}`);
    }
    return str;
  },

  [ColumnType.INTEGER]: (value: any, schema: ColumnSchema): number | null => {
    if (value == null || String(value).trim() === '') {
      return schema.required ? null : (schema.default ?? null);
    }
    const num = parseInt(String(value).replace(/,/g, ''), 10);
    if (isNaN(num)) {
      throw new Error(`Cannot parse "${value}" as integer`);
    }
    if (schema.min !== undefined && num < schema.min) {
      throw new Error(`Value ${num} is below minimum ${schema.min}`);
    }
    if (schema.max !== undefined && num > schema.max) {
      throw new Error(`Value ${num} is above maximum ${schema.max}`);
    }
    return num;
  },

  [ColumnType.FLOAT]: (value: any, schema: ColumnSchema): number | null => {
    if (value == null || String(value).trim() === '') {
      return schema.required ? null : (schema.default ?? null);
    }
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(num)) {
      throw new Error(`Cannot parse "${value}" as float`);
    }
    if (schema.min !== undefined && num < schema.min) {
      throw new Error(`Value ${num} is below minimum ${schema.min}`);
    }
    if (schema.max !== undefined && num > schema.max) {
      throw new Error(`Value ${num} is above maximum ${schema.max}`);
    }
    return num;
  },

  [ColumnType.BOOLEAN]: (value: any, schema: ColumnSchema): boolean | null => {
    if (value == null) return schema.required ? null : (schema.default ?? null);
    const str = String(value).trim().toLowerCase();
    if (['true', 'yes', '1', 't', 'y'].includes(str)) return true;
    if (['false', 'no', '0', 'f', 'n'].includes(str)) return false;
    throw new Error(`Cannot parse "${value}" as boolean`);
  },

  [ColumnType.PERCENTAGE]: (value: any, schema: ColumnSchema): number | null => {
    if (value == null || String(value).trim() === '') {
      return schema.required ? null : (schema.default ?? null);
    }
    const str = String(value).replace('%', '').replace(/,/g, '');
    const num = parseFloat(str);
    if (isNaN(num)) {
      throw new Error(`Cannot parse "${value}" as percentage`);
    }
    // Convert to decimal if it's a percentage value > 1
    const decimal = num > 1 ? num / 100 : num;
    if (schema.min !== undefined && decimal < schema.min / 100) {
      throw new Error(`Value ${decimal * 100}% is below minimum ${schema.min}%`);
    }
    if (schema.max !== undefined && decimal > schema.max / 100) {
      throw new Error(`Value ${decimal * 100}% is above maximum ${schema.max}%`);
    }
    return decimal;
  },

  [ColumnType.CURRENCY]: (value: any, schema: ColumnSchema): number | null => {
    if (value == null || String(value).trim() === '') {
      return schema.required ? null : (schema.default ?? null);
    }
    const str = String(value).replace(/[$,]/g, '').trim();
    const num = parseFloat(str);
    if (isNaN(num)) {
      throw new Error(`Cannot parse "${value}" as currency`);
    }
    if (schema.min !== undefined && num < schema.min) {
      throw new Error(`Value $${num} is below minimum $${schema.min}`);
    }
    if (schema.max !== undefined && num > schema.max) {
      throw new Error(`Value $${num} is above maximum $${schema.max}`);
    }
    return num;
  },

  [ColumnType.ENUM]: (value: any, schema: ColumnSchema): any => {
    if (value == null || String(value).trim() === '') {
      return schema.required ? null : (schema.default ?? null);
    }
    const str = String(value).trim();
    if (!schema.allowedValues?.includes(str)) {
      throw new Error(`Value "${str}" is not in allowed values: ${schema.allowedValues?.join(', ')}`);
    }
    return str;
  },

  [ColumnType.DATE]: (value: any, schema: ColumnSchema): Date | null => {
    if (value == null) return schema.required ? null : (schema.default ?? null);
    const date = new Date(String(value));
    if (isNaN(date.getTime())) {
      throw new Error(`Cannot parse "${value}" as date`);
    }
    return date;
  }
};