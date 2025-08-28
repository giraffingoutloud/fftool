import { logger } from '@/lib/utils';
import type { Position } from '@/types';

interface ValidationSchema {
  projectedPoints?: { min: number; max: number };
  auctionValue?: { min: number; max: number };
  age?: { min: number; max: number };
  byeWeek?: { min: number; max: number };
  [key: string]: { min: number; max: number } | undefined;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class DataValidator {
  private readonly playerSchema: ValidationSchema = {
    projectedPoints: { min: 0, max: 500 },
    auctionValue: { min: 0, max: 200 },
    age: { min: 18, max: 45 },
    byeWeek: { min: 1, max: 18 }
  };
  validateDataSource(sourcePath: string): boolean {
    if (!sourcePath.startsWith('/canonical_data/')) {
      throw new Error(`Invalid data source: ${sourcePath}. All data must come from canonical_data/`);
    }
    return true;
  }
  
  validatePlayerData(player: any): string[] {
    const errors: string[] = [];
    
    // Required fields
    if (!player.name) errors.push('Player name is required');
    if (!player.position) errors.push('Player position is required');
    if (!['QB', 'RB', 'WR', 'TE', 'DST', 'K'].includes(player.position)) {
      errors.push(`Invalid position: ${player.position}`);
    }
    
    // Validate against schema
    for (const [field, range] of Object.entries(this.playerSchema)) {
      if (player[field] !== undefined && range) {
        const value = Number(player[field]);
        if (!isNaN(value)) {
          if (value < range.min || value > range.max) {
            errors.push(`${field} must be between ${range.min} and ${range.max}, got ${value}`);
          }
        }
      }
    }
    
    // Additional specific validations
    if (typeof player.projectedPoints === 'number' && player.projectedPoints < 0) {
      errors.push('Projected points cannot be negative');
    }
    
    return errors;
  }
  
  validatePlayerDataStrict(player: any): boolean {
    const errors = this.validatePlayerData(player);
    if (errors.length > 0) {
      logger.warn(`Player validation errors for ${player.name}:`, { errors });
      return false;
    }
    return true;
  }
  
  /**
   * Enhanced validation with warnings and errors
   */
  validatePlayerEnhanced(player: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Required fields
    if (!player.name) {
      result.errors.push('Player name is required');
      result.isValid = false;
    }
    if (!player.position) {
      result.errors.push('Player position is required');
      result.isValid = false;
    } else if (!['QB', 'RB', 'WR', 'TE', 'DST', 'K'].includes(player.position)) {
      result.errors.push(`Invalid position: ${player.position}`);
      result.isValid = false;
    }
    
    // Check team code validity
    if (player.team && !this.isValidTeamCode(player.team)) {
      result.warnings.push(`Unusual team code: ${player.team}`);
    }
    
    // Validate numeric ranges
    for (const [field, range] of Object.entries(this.playerSchema)) {
      if (player[field] !== undefined && range) {
        const value = Number(player[field]);
        if (!isNaN(value)) {
          if (value < range.min || value > range.max) {
            result.warnings.push(`${field} is outside expected range (${range.min}-${range.max}): ${value}`);
          }
        }
      }
    }
    
    // Check for suspicious patterns
    if (player.projectedPoints && player.projectedPoints > 400) {
      result.warnings.push(`Unusually high projected points: ${player.projectedPoints}`);
    }
    
    if (player.auctionValue && player.projectedPoints) {
      const valueRatio = player.auctionValue / player.projectedPoints;
      if (valueRatio > 0.5) {
        result.warnings.push(`High auction value to points ratio: ${valueRatio.toFixed(2)}`);
      }
    }
    
    return result;
  }
  
  private isValidTeamCode(team: string): boolean {
    const validTeams = [
      'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
      'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAC', 'KC',
      'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
      'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
    ];
    return validTeams.includes(team);
  }
  
  /**
   * Validate CSV data integrity
   */
  validateCSVData<T extends Record<string, any>>(
    data: T[],
    requiredColumns: string[],
    entityType: string
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    if (!data || data.length === 0) {
      result.errors.push(`No data found for ${entityType}`);
      result.isValid = false;
      return result;
    }
    
    // Check for required columns
    const firstRow = data[0];
    for (const col of requiredColumns) {
      if (!(col in firstRow)) {
        result.errors.push(`Missing required column: ${col}`);
        result.isValid = false;
      }
    }
    
    // Check for duplicate entries (based on name/id)
    const seen = new Set<string>();
    let duplicateCount = 0;
    
    for (const row of data) {
      const key = row.name || row.id || JSON.stringify(row);
      if (seen.has(key)) {
        duplicateCount++;
      }
      seen.add(key);
    }
    
    if (duplicateCount > 0) {
      result.warnings.push(`Found ${duplicateCount} duplicate entries`);
    }
    
    // Check for missing values in critical fields
    let missingCriticalData = 0;
    for (const row of data) {
      if (!row.name && !row.id) {
        missingCriticalData++;
      }
    }
    
    if (missingCriticalData > 0) {
      result.warnings.push(`${missingCriticalData} rows missing critical identifiers`);
    }
    
    // Log validation results
    logger.logValidation(entityType, data.length - result.errors.length, result.errors.length);
    
    return result;
  }
  
  validateLeagueSettings(settings: any): string[] {
    const errors: string[] = [];
    
    if (!settings.teams || settings.teams !== 12) {
      errors.push('Must be 12-team league');
    }
    if (!settings.budget || settings.budget !== 200) {
      errors.push('Must have $200 budget');
    }
    if (!settings.scoring || settings.scoring !== 'PPR') {
      errors.push('Must be PPR scoring');
    }
    
    const requiredPositions = [
      { pos: 'QB', required: 1 },
      { pos: 'RB', required: 2 },
      { pos: 'WR', required: 2 },
      { pos: 'TE', required: 1 },
      { pos: 'FLEX', required: 1 },
      { pos: 'DST', required: 1 },
      { pos: 'K', required: 1 },
      { pos: 'BE', required: 7 }
    ];
    
    for (const req of requiredPositions) {
      const slot = settings.rosterPositions?.find((s: any) => s.position === req.pos);
      if (!slot || slot.required !== req.required) {
        errors.push(`Invalid roster position: ${req.pos} must have ${req.required} slots`);
      }
    }
    
    return errors;
  }
  
  validateAuctionValue(value: number, playerName: string): boolean {
    if (value < 0) {
      throw new Error(`Negative auction value for ${playerName}: $${value}`);
    }
    if (value > 200) {
      throw new Error(`Auction value exceeds budget for ${playerName}: $${value}`);
    }
    return true;
  }
  
  validateBudgetConstraint(team: any, price: number): string[] {
    const errors: string[] = [];
    const remainingBudget = team.budget - team.spent;
    const remainingSlots = 16 - team.roster.length;
    const minRequired = remainingSlots - 1; // $1 for each other slot
    
    if (price > remainingBudget) {
      errors.push(`Price $${price} exceeds remaining budget $${remainingBudget}`);
    }
    if (price > remainingBudget - minRequired) {
      errors.push(`Price $${price} would leave insufficient funds for remaining roster spots`);
    }
    if (price < 1) {
      errors.push('Minimum bid is $1');
    }
    
    return errors;
  }
}