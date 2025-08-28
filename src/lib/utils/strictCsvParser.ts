/**
 * Strict CSV Parser with Schema Enforcement
 * Implements explicit dtypes, validation, referential integrity, and comprehensive logging
 */

import Papa from 'papaparse';
import {
  CSVSchema,
  ColumnSchema,
  ColumnType,
  ParseConfig,
  DataLineage,
  StrictParseResult,
  ParseError,
  ParseWarning,
  ReferentialIntegrityRule,
  TYPE_COERCERS
} from './csvSchema';
import { removeBOM } from './csvParser';
import { logger } from './logger';

export class StrictCSVParser {
  private dataStore: Map<string, any[]> = new Map(); // For referential integrity checks
  private quarantine: Array<{ row: any; reason: string; lineNumber: number }> = [];
  private coercions: Array<{ row: number; column: string; originalValue: any; coercedValue: any; reason: string }> = [];

  /**
   * Parse CSV with strict schema enforcement
   */
  public parseWithSchema<T extends Record<string, any>>(
    content: string,
    config: ParseConfig
  ): StrictParseResult<T> {
    const startTime = performance.now();
    const schema = config.schema;
    const lineage: DataLineage = {
      sourceFile: schema.name,
      parsedAt: new Date(),
      rowCountOriginal: 0,
      rowCountAfterHeaders: 0,
      rowCountAfterEmpty: 0,
      rowCountAfterDuplicates: 0,
      rowCountAfterValidation: 0,
      rowCountFinal: 0,
      duplicatesRemoved: 0,
      validationErrors: 0,
      coercions: [],
      quarantinedRows: []
    };

    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];

    try {
      // Step 1: Handle BOM
      logger.info(`[${schema.name}] Step 1: BOM handling`);
      let processedContent = content;
      if (config.bomHandling === 'remove') {
        processedContent = removeBOM(content);
        if (processedContent !== content) {
          logger.info(`[${schema.name}] BOM detected and removed`);
        }
      } else if (config.bomHandling === 'fail' && content.startsWith('\uFEFF')) {
        throw new Error('BOM detected but bomHandling is set to "fail"');
      }

      // Step 2: Count original rows
      const originalLines = processedContent.split('\n');
      lineage.rowCountOriginal = originalLines.length;
      logger.info(`[${schema.name}] Step 2: Original row count: ${lineage.rowCountOriginal}`);

      // Step 3: Parse CSV with Papa Parse
      logger.info(`[${schema.name}] Step 3: Parsing CSV with delimiter: "${schema.delimiter}"`);
      const parseResult = Papa.parse(processedContent, {
        delimiter: schema.delimiter,
        quoteChar: schema.quoteChar,
        escapeChar: schema.escapeChar,
        header: schema.hasHeader,
        skipEmptyLines: config.skipEmptyLines,
        dynamicTyping: false, // We'll handle typing ourselves
        encoding: schema.encoding,
        comments: false,
        trimHeaders: config.trimWhitespace,
        transformHeader: (header: string) => config.trimWhitespace ? header.trim() : header
      });

      if (parseResult.errors.length > 0) {
        const criticalErrors = parseResult.errors.filter(
          e => e.type !== 'FieldMismatch' && !e.message?.includes('Too many fields')
        );
        if (criticalErrors.length > 0) {
          logger.error(`[${schema.name}] Critical parsing errors:`, { errors: criticalErrors });
          criticalErrors.forEach(e => {
            errors.push({
              row: e.row,
              message: e.message || 'Unknown parsing error',
              type: 'schema'
            });
          });
        }
      }

      let data = parseResult.data as any[];
      lineage.rowCountAfterHeaders = data.length;
      logger.info(`[${schema.name}] Step 4: Rows after header: ${lineage.rowCountAfterHeaders}`);

      // Step 4: Skip specified rows
      if (schema.skipRows > 0) {
        data = data.slice(schema.skipRows);
        logger.info(`[${schema.name}] Skipped ${schema.skipRows} rows`);
      }

      // Step 5: Remove empty rows
      const beforeEmpty = data.length;
      if (config.skipEmptyLines) {
        data = data.filter(row => {
          const values = Object.values(row);
          return values.some(v => v != null && String(v).trim() !== '');
        });
      }
      lineage.rowCountAfterEmpty = data.length;
      logger.info(`[${schema.name}] Step 5: Rows after removing empty: ${lineage.rowCountAfterEmpty} (removed ${beforeEmpty - data.length})`);

      // Step 6: Schema validation and column checking
      logger.info(`[${schema.name}] Step 6: Schema validation`);
      const schemaColumns = new Set(schema.columns.map(c => c.name));
      const actualColumns = new Set(Object.keys(data[0] || {}));

      // Check for unexpected columns
      if (!schema.allowExtraColumns) {
        const extraColumns = Array.from(actualColumns).filter(c => !schemaColumns.has(c));
        if (extraColumns.length > 0) {
          const error: ParseError = {
            message: `Unexpected columns found: ${extraColumns.join(', ')}`,
            type: 'schema'
          };
          if (schema.validationMode === 'strict') {
            errors.push(error);
            throw new Error(error.message);
          } else {
            warnings.push(error as ParseWarning);
          }
        }
      }

      // Check for missing required columns
      const missingColumns = schema.columns
        .filter(c => c.required && !actualColumns.has(c.name))
        .map(c => c.name);
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Step 7: Type coercion and validation
      logger.info(`[${schema.name}] Step 7: Type coercion and validation`);
      const validatedData: T[] = [];
      const rowsToQuarantine: number[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const validatedRow: any = {};
        let rowValid = true;
        const rowErrors: string[] = [];

        for (const columnSchema of schema.columns) {
          const rawValue = row[columnSchema.name];
          const isNA = schema.naValues.includes(String(rawValue).trim());

          try {
            // Handle NA values
            if (isNA) {
              if (columnSchema.required) {
                rowErrors.push(`Required column "${columnSchema.name}" has NA value`);
                rowValid = false;
              } else {
                validatedRow[columnSchema.name] = columnSchema.default ?? null;
              }
              continue;
            }

            // Type coercion
            const coercer = TYPE_COERCERS[columnSchema.type];
            if (!coercer) {
              throw new Error(`No coercer for type ${columnSchema.type}`);
            }

            const coercedValue = coercer(rawValue, columnSchema);
            
            // Track coercion if value changed
            if (coercedValue !== rawValue && rawValue != null) {
              this.coercions.push({
                row: i + 1,
                column: columnSchema.name,
                originalValue: rawValue,
                coercedValue: coercedValue,
                reason: `Type coercion to ${columnSchema.type}`
              });
            }

            // Check if required field is null after coercion
            if (columnSchema.required && coercedValue == null) {
              rowErrors.push(`Required column "${columnSchema.name}" is null`);
              rowValid = false;
            }

            validatedRow[columnSchema.name] = coercedValue;

          } catch (error) {
            const errorMsg = `Column "${columnSchema.name}": ${error instanceof Error ? error.message : String(error)}`;
            rowErrors.push(errorMsg);
            rowValid = false;
            
            errors.push({
              row: i + 1,
              column: columnSchema.name,
              value: rawValue,
              message: errorMsg,
              type: 'type'
            });
          }
        }

        if (!rowValid) {
          if (schema.validationMode === 'strict') {
            rowsToQuarantine.push(i);
            this.quarantine.push({
              row: row,
              reason: rowErrors.join('; '),
              lineNumber: i + 1
            });
            lineage.validationErrors++;
          } else if (schema.validationMode === 'warning') {
            warnings.push({
              row: i + 1,
              message: rowErrors.join('; '),
              type: 'validation'
            });
            validatedData.push(validatedRow as T);
          }
        } else {
          validatedData.push(validatedRow as T);
        }
      }

      lineage.rowCountAfterValidation = validatedData.length;
      logger.info(`[${schema.name}] Step 8: Rows after validation: ${lineage.rowCountAfterValidation} (quarantined ${rowsToQuarantine.length})`);

      // Step 8: Handle duplicates
      logger.info(`[${schema.name}] Step 9: Duplicate handling with policy: ${schema.duplicatePolicy}`);
      const { deduplicated, duplicatesRemoved } = this.handleDuplicates(
        validatedData,
        schema
      );
      lineage.rowCountAfterDuplicates = deduplicated.length;
      lineage.duplicatesRemoved = duplicatesRemoved;
      
      if (duplicatesRemoved > 0) {
        logger.info(`[${schema.name}] Removed ${duplicatesRemoved} duplicate rows`);
      }

      // Step 9: Apply max rows limit if specified
      let finalData = deduplicated;
      if (schema.maxRows && finalData.length > schema.maxRows) {
        logger.warn(`[${schema.name}] Truncating to maxRows: ${schema.maxRows}`);
        finalData = finalData.slice(0, schema.maxRows);
      }

      lineage.rowCountFinal = finalData.length;
      lineage.coercions = this.coercions;
      lineage.quarantinedRows = this.quarantine;

      // Step 10: Store for referential integrity checks
      this.dataStore.set(schema.name, finalData);

      // Step 11: Log final summary
      const duration = performance.now() - startTime;
      logger.info(`[${schema.name}] ===== PARSING COMPLETE =====`);
      logger.info(`[${schema.name}] Duration: ${duration.toFixed(2)}ms`);
      logger.info(`[${schema.name}] Original rows: ${lineage.rowCountOriginal}`);
      logger.info(`[${schema.name}] After headers: ${lineage.rowCountAfterHeaders}`);
      logger.info(`[${schema.name}] After empty removal: ${lineage.rowCountAfterEmpty}`);
      logger.info(`[${schema.name}] After validation: ${lineage.rowCountAfterValidation}`);
      logger.info(`[${schema.name}] After deduplication: ${lineage.rowCountAfterDuplicates}`);
      logger.info(`[${schema.name}] Final count: ${lineage.rowCountFinal}`);
      logger.info(`[${schema.name}] Coercions: ${lineage.coercions.length}`);
      logger.info(`[${schema.name}] Quarantined: ${lineage.quarantinedRows.length}`);
      logger.info(`[${schema.name}] Errors: ${errors.length}`);
      logger.info(`[${schema.name}] Warnings: ${warnings.length}`);
      logger.info(`[${schema.name}] ===========================`);

      return {
        data: finalData,
        lineage,
        errors,
        warnings,
        success: errors.length === 0 || schema.validationMode !== 'strict'
      };

    } catch (error) {
      logger.error(`[${schema.name}] Fatal parsing error:`, error);
      return {
        data: [],
        lineage,
        errors: [...errors, {
          message: error instanceof Error ? error.message : String(error),
          type: 'schema'
        }],
        warnings,
        success: false
      };
    }
  }

  /**
   * Handle duplicate rows based on schema policy
   */
  private handleDuplicates<T extends Record<string, any>>(
    data: T[],
    schema: CSVSchema
  ): { deduplicated: T[]; duplicatesRemoved: number } {
    if (schema.duplicatePolicy === 'first' || schema.duplicatePolicy === 'last') {
      const seen = new Map<string, T>();
      let duplicatesRemoved = 0;

      for (const row of data) {
        // Generate composite key
        const keys = schema.uniqueKeys.map(keySet => 
          keySet.map(col => String(row[col] ?? '')).join('|')
        );
        
        for (const key of keys) {
          if (seen.has(key)) {
            duplicatesRemoved++;
            if (schema.duplicatePolicy === 'last') {
              seen.set(key, row); // Replace with newer
            }
            // If 'first', don't replace
          } else {
            seen.set(key, row);
          }
        }
      }

      return {
        deduplicated: Array.from(seen.values()),
        duplicatesRemoved
      };
    } else if (schema.duplicatePolicy === 'fail') {
      const seen = new Set<string>();
      const duplicateKeys: string[] = [];

      for (const row of data) {
        const keys = schema.uniqueKeys.map(keySet => 
          keySet.map(col => String(row[col] ?? '')).join('|')
        );
        
        for (const key of keys) {
          if (seen.has(key)) {
            duplicateKeys.push(key);
          }
          seen.add(key);
        }
      }

      if (duplicateKeys.length > 0) {
        throw new Error(`Duplicate keys found: ${duplicateKeys.slice(0, 10).join(', ')}${duplicateKeys.length > 10 ? '...' : ''}`);
      }
    } else if (schema.duplicatePolicy === 'quarantine') {
      const seen = new Set<string>();
      const deduplicated: T[] = [];
      let quarantinedCount = 0;

      for (const row of data) {
        const keys = schema.uniqueKeys.map(keySet => 
          keySet.map(col => String(row[col] ?? '')).join('|')
        );
        
        let isDuplicate = false;
        for (const key of keys) {
          if (seen.has(key)) {
            isDuplicate = true;
            break;
          }
          seen.add(key);
        }

        if (isDuplicate) {
          this.quarantine.push({
            row,
            reason: 'Duplicate key',
            lineNumber: -1
          });
          quarantinedCount++;
        } else {
          deduplicated.push(row);
        }
      }

      return {
        deduplicated,
        duplicatesRemoved: quarantinedCount
      };
    }

    return { deduplicated: data, duplicatesRemoved: 0 };
  }

  /**
   * Check referential integrity across datasets
   */
  public checkReferentialIntegrity(rules: ReferentialIntegrityRule[]): {
    valid: boolean;
    violations: Array<{
      rule: ReferentialIntegrityRule;
      missingValues: any[];
      count: number;
    }>;
  } {
    const violations: Array<{
      rule: ReferentialIntegrityRule;
      missingValues: any[];
      count: number;
    }> = [];

    for (const rule of rules) {
      const sourceData = this.dataStore.get(rule.sourceTable);
      const targetData = this.dataStore.get(rule.targetTable);

      if (!sourceData || !targetData) {
        logger.warn(`Cannot check referential integrity: missing data for ${rule.sourceTable} -> ${rule.targetTable}`);
        continue;
      }

      // Build lookup set from target
      const targetValues = new Set(
        targetData.map(row => String(row[rule.targetColumn] ?? '').toLowerCase())
      );

      // Check source values
      const missingValues: any[] = [];
      for (const row of sourceData) {
        const sourceValue = row[rule.sourceColumn];
        if (sourceValue == null && rule.nullable) {
          continue;
        }

        const normalizedValue = String(sourceValue ?? '').toLowerCase();
        if (!targetValues.has(normalizedValue)) {
          missingValues.push(sourceValue);
        }
      }

      if (missingValues.length > 0) {
        violations.push({
          rule,
          missingValues: [...new Set(missingValues)].slice(0, 10), // Unique, first 10
          count: missingValues.length
        });

        const logMessage = `Referential integrity violation: ${rule.sourceTable}.${rule.sourceColumn} -> ${rule.targetTable}.${rule.targetColumn}: ${missingValues.length} missing values`;
        
        if (rule.onMissing === 'fail') {
          logger.error(logMessage);
        } else if (rule.onMissing === 'warn') {
          logger.warn(logMessage);
        }
      }
    }

    logger.info(`Referential integrity check complete: ${violations.length} violations found`);
    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Get parsed data by table name
   */
  public getData(tableName: string): any[] | undefined {
    return this.dataStore.get(tableName);
  }

  /**
   * Get quarantined rows
   */
  public getQuarantinedRows(): Array<{ row: any; reason: string; lineNumber: number }> {
    return this.quarantine;
  }

  /**
   * Clear all stored data
   */
  public clearDataStore(): void {
    this.dataStore.clear();
    this.quarantine = [];
    this.coercions = [];
  }

  /**
   * Export data lineage report
   */
  public exportLineageReport(): string {
    const report: string[] = ['=== DATA LINEAGE REPORT ===\n'];
    
    for (const [tableName, data] of this.dataStore.entries()) {
      report.push(`Table: ${tableName}`);
      report.push(`  Rows: ${data.length}`);
      report.push(`  Columns: ${Object.keys(data[0] || {}).join(', ')}`);
      report.push('');
    }

    if (this.quarantine.length > 0) {
      report.push(`\n=== QUARANTINED ROWS (${this.quarantine.length} total) ===`);
      this.quarantine.slice(0, 10).forEach(q => {
        report.push(`  Line ${q.lineNumber}: ${q.reason}`);
      });
      if (this.quarantine.length > 10) {
        report.push(`  ... and ${this.quarantine.length - 10} more`);
      }
    }

    if (this.coercions.length > 0) {
      report.push(`\n=== COERCIONS (${this.coercions.length} total) ===`);
      const coercionSummary = new Map<string, number>();
      this.coercions.forEach(c => {
        const key = `${c.column}: ${c.reason}`;
        coercionSummary.set(key, (coercionSummary.get(key) || 0) + 1);
      });
      
      for (const [key, count] of coercionSummary.entries()) {
        report.push(`  ${key}: ${count} occurrences`);
      }
    }

    return report.join('\n');
  }
}

// Export singleton instance for convenience
export const strictParser = new StrictCSVParser();