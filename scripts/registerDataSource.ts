#!/usr/bin/env tsx

/**
 * Register New Data Source
 * Automatically analyzes new data files and creates column specifications
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { parse } from 'csv-parse/sync';
import { detectNewFiles } from './detectNewFiles';

const SPECS_DIR = '/mnt/c/Users/giraf/Documents/projects/fftool/specs/columns';
const DATA_DICT_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/specs/data_dictionary.json';

interface ColumnSpec {
  name: string;
  detectedType: string;
  nullable: boolean;
  uniqueValues?: string[];
  minValue?: number;
  maxValue?: number;
  meanValue?: number;
  sampleValues: any[];
  missingCount: number;
  distinctCount: number;
  suggestedValidation?: any;
}

interface DataSourceSpec {
  filename: string;
  filepath: string;
  source: string;
  category: string;
  registeredAt: string;
  rowCount: number;
  columnCount: number;
  columns: Record<string, ColumnSpec>;
  suggestedCompositeKey?: string[];
  detectedDuplicates?: number;
  inferredFrequency?: string;
}

function inferDataType(values: any[]): string {
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined);
  
  if (nonNull.length === 0) return 'string';
  
  // Check if all numeric
  if (nonNull.every(v => !isNaN(Number(v)))) {
    // Check if all integers
    if (nonNull.every(v => Number.isInteger(Number(v)))) {
      return 'integer';
    }
    return 'float';
  }
  
  // Check if boolean
  const boolValues = new Set(['true', 'false', '0', '1', 'yes', 'no', 'y', 'n']);
  if (nonNull.every(v => boolValues.has(String(v).toLowerCase()))) {
    return 'boolean';
  }
  
  // Check if date
  const datePattern = /^\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/;
  if (nonNull.length > 0 && nonNull.every(v => datePattern.test(String(v)))) {
    return 'date';
  }
  
  return 'string';
}

function analyzeColumn(name: string, values: any[]): ColumnSpec {
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined);
  const uniqueValues = [...new Set(nonNull)];
  const dataType = inferDataType(values);
  
  const spec: ColumnSpec = {
    name,
    detectedType: dataType,
    nullable: nonNull.length < values.length,
    sampleValues: uniqueValues.slice(0, 5),
    missingCount: values.length - nonNull.length,
    distinctCount: uniqueValues.length
  };
  
  // Add type-specific analysis
  if (dataType === 'integer' || dataType === 'float') {
    const numbers = nonNull.map(v => Number(v));
    spec.minValue = Math.min(...numbers);
    spec.maxValue = Math.max(...numbers);
    spec.meanValue = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    
    // Suggest validation rules
    spec.suggestedValidation = {
      type: 'range',
      min: spec.minValue,
      max: spec.maxValue
    };
  } else if (dataType === 'string') {
    // If low cardinality, suggest enum
    if (uniqueValues.length <= 50 && uniqueValues.length < values.length * 0.1) {
      spec.uniqueValues = uniqueValues.sort();
      spec.suggestedValidation = {
        type: 'enum',
        values: spec.uniqueValues
      };
    }
  }
  
  return spec;
}

function detectCompositeKey(data: any[]): string[] {
  if (data.length === 0) return [];
  
  const columns = Object.keys(data[0]);
  const candidates: string[] = [];
  
  // Check each column for uniqueness
  for (const col of columns) {
    const values = data.map(row => row[col]);
    const uniqueValues = new Set(values);
    
    // If column is unique, it could be a key
    if (uniqueValues.size === data.length) {
      candidates.push(col);
    }
  }
  
  // If single unique column found, use it
  if (candidates.length === 1) {
    return candidates;
  }
  
  // Try common composite keys
  const commonKeys = [
    ['player_name', 'team'],
    ['player', 'team'],
    ['name', 'team'],
    ['player_name', 'week'],
    ['player', 'week'],
    ['team', 'week']
  ];
  
  for (const keyCombo of commonKeys) {
    if (keyCombo.every(k => columns.includes(k))) {
      // Test if this combination is unique
      const keyValues = data.map(row => keyCombo.map(k => row[k]).join('|'));
      const uniqueKeys = new Set(keyValues);
      
      if (uniqueKeys.size === data.length) {
        return keyCombo;
      }
    }
  }
  
  // Default to first few columns
  return columns.slice(0, 2);
}

function inferFrequency(filename: string, category: string): string {
  const lower = filename.toLowerCase();
  
  if (lower.includes('week') || lower.includes('wk')) return 'weekly';
  if (lower.includes('daily') || lower.includes('day')) return 'daily';
  if (lower.includes('season') || lower.includes('2025') || lower.includes('2024')) return 'seasonal';
  if (category === 'injuries') return 'weekly';
  if (category === 'weather') return 'daily';
  if (category === 'projections') return 'seasonal';
  
  return 'unknown';
}

async function registerDataSource(filepath: string): Promise<DataSourceSpec> {
  console.log('='.repeat(60));
  console.log('DATA SOURCE REGISTRATION');
  console.log('='.repeat(60));
  console.log('');
  
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }
  
  console.log(`📄 Analyzing: ${filepath}`);
  
  // Read and parse file
  const content = readFileSync(filepath, 'utf-8');
  const filename = basename(filepath);
  const category = filepath.includes('canonical_data') 
    ? filepath.split('canonical_data/')[1].split('/')[0]
    : 'uncategorized';
  
  // Parse as CSV
  let data: any[];
  try {
    data = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false // Keep as strings for analysis
    });
  } catch (error) {
    console.error('Failed to parse as CSV:', error);
    throw error;
  }
  
  console.log(`  Rows: ${data.length}`);
  console.log(`  Columns: ${Object.keys(data[0] || {}).length}`);
  console.log('');
  
  // Analyze each column
  const columns: Record<string, ColumnSpec> = {};
  const columnNames = Object.keys(data[0] || {});
  
  console.log('Analyzing columns...');
  for (const colName of columnNames) {
    const values = data.map(row => row[colName]);
    columns[colName] = analyzeColumn(colName, values);
    
    const spec = columns[colName];
    console.log(`  ${colName}:`);
    console.log(`    Type: ${spec.detectedType}`);
    console.log(`    Nullable: ${spec.nullable}`);
    console.log(`    Distinct: ${spec.distinctCount}`);
    console.log(`    Missing: ${spec.missingCount}`);
    
    if (spec.uniqueValues) {
      console.log(`    Values: ${spec.uniqueValues.slice(0, 5).join(', ')}${spec.uniqueValues.length > 5 ? '...' : ''}`);
    }
  }
  console.log('');
  
  // Detect composite key
  const compositeKey = detectCompositeKey(data);
  console.log(`Suggested composite key: [${compositeKey.join(', ')}]`);
  
  // Check for duplicates based on composite key
  let duplicateCount = 0;
  if (compositeKey.length > 0) {
    const keys = data.map(row => compositeKey.map(k => row[k]).join('|'));
    const uniqueKeys = new Set(keys);
    duplicateCount = data.length - uniqueKeys.size;
    
    if (duplicateCount > 0) {
      console.log(`⚠️  Found ${duplicateCount} duplicate rows based on composite key`);
    }
  }
  
  // Create specification
  const spec: DataSourceSpec = {
    filename,
    filepath,
    source: 'registered_' + new Date().toISOString().split('T')[0],
    category,
    registeredAt: new Date().toISOString(),
    rowCount: data.length,
    columnCount: columnNames.length,
    columns,
    suggestedCompositeKey: compositeKey,
    detectedDuplicates: duplicateCount,
    inferredFrequency: inferFrequency(filename, category)
  };
  
  // Save specification
  if (!existsSync(SPECS_DIR)) {
    mkdirSync(SPECS_DIR, { recursive: true });
  }
  
  const specPath = join(SPECS_DIR, `${filename.replace(/\.[^.]+$/, '')}_spec.json`);
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  
  console.log('');
  console.log(`✅ Data source registered successfully!`);
  console.log(`📁 Specification saved to: ${specPath}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Review the generated specification');
  console.log('2. Adjust validation rules if needed');
  console.log('3. Run: npm run integrity:update');
  console.log('4. Run: npm run etl:pipeline');
  
  return spec;
}

async function registerAllNewFiles() {
  console.log('Detecting new files...');
  const newFiles = await detectNewFiles();
  
  if (newFiles.length === 0) {
    console.log('No new files to register');
    return;
  }
  
  console.log(`\nRegistering ${newFiles.length} new file(s)...\n`);
  
  const specs: DataSourceSpec[] = [];
  for (const file of newFiles) {
    try {
      const spec = await registerDataSource(file.path);
      specs.push(spec);
    } catch (error) {
      console.error(`Failed to register ${file.path}:`, error);
    }
  }
  
  // Update master registry
  const registryPath = '/mnt/c/Users/giraf/Documents/projects/fftool/reports/data_source_registry.json';
  let registry: any = { sources: [] };
  
  if (existsSync(registryPath)) {
    registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
  }
  
  registry.sources.push(...specs);
  registry.lastUpdated = new Date().toISOString();
  registry.totalSources = registry.sources.length;
  
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  
  console.log('');
  console.log(`📊 Registry updated with ${specs.length} new source(s)`);
  console.log(`📁 Registry: ${registryPath}`);
}

// Export for use in other scripts
export { registerDataSource, registerAllNewFiles };

// Run if called directly
const args = process.argv.slice(2);

if (args.length === 0) {
  // Register all new files
  registerAllNewFiles().catch(console.error);
} else {
  // Register specific file
  registerDataSource(args[0]).catch(console.error);
}