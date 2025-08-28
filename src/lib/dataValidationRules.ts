/**
 * Data validation rules to prevent invalid type errors
 * Implements strict validation with clear rules for each field type
 */

import { logger } from './utils/logger';

/**
 * VALIDATION RULES FOR FANTASY FOOTBALL DATA
 * 
 * These rules ensure data quality and prevent invalid values from entering the system
 */

export interface ValidationRule {
  field: string;
  type: 'number' | 'string' | 'enum' | 'date';
  required: boolean;
  nullable: boolean;
  validators: Array<(value: any, row?: any) => ValidationResult>;
  transform?: (value: any) => any;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  suggestion?: any;
}

/**
 * AUCTION VALUE VALIDATION
 * - Must be numeric (integer or float)
 * - Range: 0-200 (reasonable auction budget)
 * - Can be 0 for low-value players
 * - Cannot be negative
 * - N/A should be pre-processed to 0 or interpolated value
 */
export const auctionValueRule: ValidationRule = {
  field: 'Auction Value',
  type: 'number',
  required: true,
  nullable: false,
  description: 'Player auction draft value in dollars',
  validators: [
    // Check if it's a valid number
    (value) => {
      if (value === 'N/A' || value === 'NA' || value === 'null') {
        return {
          valid: false,
          error: `Invalid value "${value}" - must be numeric`,
          suggestion: 0
        };
      }
      
      const num = parseFloat(String(value));
      if (isNaN(num)) {
        return {
          valid: false,
          error: `Non-numeric value "${value}"`,
          suggestion: 0
        };
      }
      
      return { valid: true };
    },
    
    // Check range
    (value) => {
      const num = parseFloat(String(value));
      if (!isNaN(num)) {
        if (num < 0) {
          return {
            valid: false,
            error: `Negative auction value: ${num}`,
            suggestion: 0
          };
        }
        if (num > 200) {
          return {
            valid: false,
            error: `Auction value too high: ${num} (max: 200)`,
            suggestion: 200
          };
        }
      }
      return { valid: true };
    },
    
    // Context-based validation
    (value, row) => {
      const num = parseFloat(String(value));
      if (!isNaN(num) && row) {
        const rank = parseInt(row['Overall Rank']);
        
        // High-ranked players should have auction value
        if (rank <= 50 && num === 0) {
          return {
            valid: false,
            error: `Top 50 player with $0 auction value`,
            warning: `Player ranked ${rank} should have auction value > 0`,
            suggestion: Math.max(1, 60 - rank) // Simple formula
          };
        }
        
        // Low-ranked players can have 0 value
        if (rank > 200 && num > 10) {
          return {
            valid: true,
            warning: `Player ranked ${rank} has surprisingly high value: $${num}`
          };
        }
      }
      return { valid: true };
    }
  ],
  transform: (value) => {
    // Clean and standardize the value
    if (value === 'N/A' || value === 'NA' || value === 'null' || value === '') {
      return 0; // Default for missing auction values
    }
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : Math.round(num * 100) / 100; // Round to 2 decimal places
  }
};

/**
 * ADP (Average Draft Position) VALIDATION
 * - Must be numeric
 * - Range: 1-999 (999 = undrafted convention)
 * - Cannot be 0 or negative
 * - null should be converted to 999
 */
export const adpRule: ValidationRule = {
  field: 'ADP',
  type: 'number',
  required: true,
  nullable: false,
  description: 'Average Draft Position across fantasy leagues',
  validators: [
    // Check if it's a valid number or null
    (value) => {
      if (value === 'null' || value === 'NULL' || value === '') {
        return {
          valid: false,
          error: `Invalid ADP value "${value}"`,
          suggestion: 999 // Undrafted convention
        };
      }
      
      if (value === 'N/A' || value === 'NA') {
        return {
          valid: false,
          error: `Invalid ADP value "${value}"`,
          suggestion: 999
        };
      }
      
      const num = parseFloat(String(value));
      if (isNaN(num)) {
        return {
          valid: false,
          error: `Non-numeric ADP value "${value}"`,
          suggestion: 999
        };
      }
      
      return { valid: true };
    },
    
    // Check range
    (value) => {
      const num = parseFloat(String(value));
      if (!isNaN(num)) {
        if (num < 0) {
          return {
            valid: false,
            error: `Negative ADP: ${num}`,
            suggestion: 1
          };
        }
        if (num === 0) {
          return {
            valid: false,
            error: `ADP cannot be 0 (use 1 for first pick, 999 for undrafted)`,
            suggestion: 1
          };
        }
        if (num > 999) {
          return {
            valid: false,
            error: `ADP too high: ${num} (max: 999)`,
            suggestion: 999
          };
        }
      }
      return { valid: true };
    },
    
    // Context validation
    (value, row) => {
      const adp = parseFloat(String(value));
      if (!isNaN(adp) && row) {
        const rank = parseInt(row['Overall Rank']);
        
        // ADP should roughly correlate with overall rank
        if (rank <= 100 && adp === 999) {
          return {
            valid: false,
            error: `Top 100 player marked as undrafted (ADP=999)`,
            suggestion: rank * 1.2 // Rough approximation
          };
        }
        
        // Large discrepancy warning
        if (Math.abs(rank - adp) > 50 && adp !== 999) {
          return {
            valid: true,
            warning: `Large discrepancy: Rank=${rank}, ADP=${adp}`
          };
        }
      }
      return { valid: true };
    }
  ],
  transform: (value) => {
    // Clean and standardize the value
    if (value === 'null' || value === 'NULL' || value === 'N/A' || value === 'NA' || value === '') {
      return 999; // Undrafted convention
    }
    const num = parseFloat(String(value));
    if (isNaN(num) || num <= 0) {
      return 999;
    }
    return Math.round(num * 10) / 10; // Round to 1 decimal place
  }
};

/**
 * Validate a single row of data
 */
export function validateRow(
  row: Record<string, any>,
  rules: ValidationRule[]
): { valid: boolean; errors: string[]; warnings: string[]; fixes: Record<string, any> } {
  const result = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
    fixes: {} as Record<string, any>
  };

  for (const rule of rules) {
    const value = row[rule.field];
    
    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      result.valid = false;
      result.errors.push(`Missing required field: ${rule.field}`);
      continue;
    }
    
    // Run validators
    for (const validator of rule.validators) {
      const validation = validator(value, row);
      
      if (!validation.valid) {
        result.valid = false;
        if (validation.error) {
          result.errors.push(`${rule.field}: ${validation.error}`);
        }
        if (validation.suggestion !== undefined) {
          result.fixes[rule.field] = validation.suggestion;
        }
      }
      
      if (validation.warning) {
        result.warnings.push(`${rule.field}: ${validation.warning}`);
      }
    }
  }
  
  return result;
}

/**
 * Create validation report
 */
export function createValidationReport(
  data: any[],
  rules: ValidationRule[]
): {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalErrors: number;
  totalWarnings: number;
  errorsByType: Record<string, number>;
  suggestedFixes: number;
  samples: any[];
} {
  const report = {
    totalRows: data.length,
    validRows: 0,
    invalidRows: 0,
    totalErrors: 0,
    totalWarnings: 0,
    errorsByType: {} as Record<string, number>,
    suggestedFixes: 0,
    samples: [] as any[]
  };

  data.forEach((row, index) => {
    const validation = validateRow(row, rules);
    
    if (validation.valid) {
      report.validRows++;
    } else {
      report.invalidRows++;
      
      // Track first 5 invalid rows as samples
      if (report.samples.length < 5) {
        report.samples.push({
          rowIndex: index + 2, // +1 for 0-index, +1 for header
          row,
          errors: validation.errors,
          warnings: validation.warnings,
          fixes: validation.fixes
        });
      }
    }
    
    report.totalErrors += validation.errors.length;
    report.totalWarnings += validation.warnings.length;
    
    if (Object.keys(validation.fixes).length > 0) {
      report.suggestedFixes++;
    }
    
    // Count errors by type
    validation.errors.forEach(error => {
      const type = error.split(':')[0];
      report.errorsByType[type] = (report.errorsByType[type] || 0) + 1;
    });
  });
  
  return report;
}

/**
 * COMPREHENSIVE VALIDATION RULES FOR ADP DATA
 */
export const ADP_VALIDATION_RULES: ValidationRule[] = [
  auctionValueRule,
  adpRule,
  {
    field: 'Overall Rank',
    type: 'number',
    required: true,
    nullable: false,
    description: 'Overall player ranking',
    validators: [
      (value) => {
        const num = parseInt(String(value));
        if (isNaN(num) || num < 1) {
          return { valid: false, error: 'Rank must be positive integer' };
        }
        return { valid: true };
      }
    ],
    transform: (value) => parseInt(String(value))
  },
  {
    field: 'Position',
    type: 'enum',
    required: true,
    nullable: false,
    description: 'Player position',
    validators: [
      (value) => {
        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'D/ST'];
        if (!validPositions.includes(String(value).toUpperCase())) {
          return {
            valid: false,
            error: `Invalid position: ${value}`,
            suggestion: 'WR' // Default fallback
          };
        }
        return { valid: true };
      }
    ],
    transform: (value) => String(value).toUpperCase()
  }
];

// Export for browser
if (typeof window !== 'undefined') {
  (window as any).validateADPData = (data: any[]) => {
    const report = createValidationReport(data, ADP_VALIDATION_RULES);
    console.log('Validation Report:', report);
    return report;
  };
  logger.info('Validation rules loaded. Use window.validateADPData(data) to validate.');
}