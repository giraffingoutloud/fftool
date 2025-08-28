/**
 * Comprehensive Data Validation Layer
 * Pre and post computation validation with outlier detection
 */

import { logger } from './utils/logger';
import type { PlayerProjection, PlayerADP, Position } from '@/types';

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  player?: string;
  message: string;
  value?: any;
  expectedRange?: { min: number; max: number };
}

interface ValidationReport {
  timestamp: Date;
  totalIssues: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  passedChecks: number;
  failedChecks: number;
  summary: string;
}

interface PositionLimits {
  minProjection: number;
  maxProjection: number;
  minVORP: number;
  maxVORP: number;
  minValue: number;
  maxValue: number;
  expectedCount: { min: number; max: number };
}

export class DataValidationLayer {
  private static instance: DataValidationLayer;
  
  // Position-specific reasonable ranges
  private readonly POSITION_LIMITS: Record<Position, PositionLimits> = {
    QB: {
      minProjection: 0,
      maxProjection: 450,
      minVORP: -50,
      maxVORP: 200,
      minValue: 1,
      maxValue: 80,
      expectedCount: { min: 25, max: 60 }
    },
    RB: {
      minProjection: 0,
      maxProjection: 400,
      minVORP: -50,
      maxVORP: 250,
      minValue: 1,
      maxValue: 75,
      expectedCount: { min: 60, max: 120 }
    },
    WR: {
      minProjection: 0,
      maxProjection: 400,
      minVORP: -50,
      maxVORP: 250,
      minValue: 1,
      maxValue: 75,
      expectedCount: { min: 80, max: 150 }
    },
    TE: {
      minProjection: 0,
      maxProjection: 300,
      minVORP: -50,
      maxVORP: 150,
      minValue: 1,
      maxValue: 50,
      expectedCount: { min: 30, max: 80 }
    },
    DST: {
      minProjection: 0,
      maxProjection: 200,
      minVORP: -30,
      maxVORP: 80,
      minValue: 1,
      maxValue: 20,
      expectedCount: { min: 32, max: 32 }
    },
    K: {
      minProjection: 0,
      maxProjection: 200,
      minVORP: -30,
      maxVORP: 60,
      minValue: 1,
      maxValue: 15,
      expectedCount: { min: 25, max: 40 }
    }
  };
  
  // Replacement levels for VORP validation
  private readonly REPLACEMENT_LEVELS: Record<Position, number> = {
    QB: 220,
    RB: 100,
    WR: 95,
    TE: 80,
    DST: 70,
    K: 110
  };
  
  private validationLog: ValidationIssue[] = [];
  
  private constructor() {}
  
  public static getInstance(): DataValidationLayer {
    if (!DataValidationLayer.instance) {
      DataValidationLayer.instance = new DataValidationLayer();
    }
    return DataValidationLayer.instance;
  }
  
  /**
   * Validate projection sources before aggregation
   */
  public validateProjectionSources(
    sources: { name: string; projections: PlayerProjection[] }[]
  ): ValidationReport {
    const report: ValidationReport = {
      timestamp: new Date(),
      totalIssues: 0,
      errors: [],
      warnings: [],
      info: [],
      passedChecks: 0,
      failedChecks: 0,
      summary: ''
    };
    
    sources.forEach(source => {
      // Check source has data
      if (!source.projections || source.projections.length === 0) {
        this.addIssue(report, 'error', 'source', undefined, 
          `Source ${source.name} has no projections`);
        return;
      }
      
      // Check position distribution
      const positionCounts = this.getPositionCounts(source.projections);
      Object.entries(positionCounts).forEach(([position, count]) => {
        const limits = this.POSITION_LIMITS[position as Position];
        if (limits) {
          if (count < limits.expectedCount.min) {
            this.addIssue(report, 'warning', 'position_count', undefined,
              `Source ${source.name} has only ${count} ${position} players (expected min: ${limits.expectedCount.min})`);
          } else if (count > limits.expectedCount.max) {
            this.addIssue(report, 'warning', 'position_count', undefined,
              `Source ${source.name} has ${count} ${position} players (expected max: ${limits.expectedCount.max})`);
          } else {
            report.passedChecks++;
          }
        }
      });
      
      // Validate individual projections
      source.projections.forEach(proj => {
        this.validateProjection(proj, report, source.name);
      });
    });
    
    // Check for TE-specific issues (90% error rate in validation)
    const teProjections = sources.flatMap(s => 
      s.projections.filter(p => p.position === 'TE')
    );
    
    if (teProjections.length < 20) {
      this.addIssue(report, 'error', 'te_data', undefined,
        `Critical: Only ${teProjections.length} TE projections found across all sources`);
    }
    
    report.totalIssues = report.errors.length + report.warnings.length;
    report.summary = this.generateSummary(report);
    
    return report;
  }
  
  /**
   * Validate individual projection
   */
  private validateProjection(
    projection: PlayerProjection,
    report: ValidationReport,
    sourceName: string
  ): void {
    const limits = this.POSITION_LIMITS[projection.position];
    if (!limits) {
      this.addIssue(report, 'error', 'position', projection.name,
        `Invalid position: ${projection.position}`);
      return;
    }
    
    // Check projection points range
    const points = projection.projectedPoints || 0;
    if (points < limits.minProjection || points > limits.maxProjection) {
      this.addIssue(report, 'warning', 'projectedPoints', projection.name,
        `${sourceName}: Projection ${points} outside expected range`,
        points, { min: limits.minProjection, max: limits.maxProjection });
    } else {
      report.passedChecks++;
    }
    
    // Check for required fields
    if (!projection.name || projection.name.trim() === '') {
      this.addIssue(report, 'error', 'name', projection.name,
        `${sourceName}: Missing player name`);
    }
    
    if (!projection.team || projection.team.trim() === '') {
      this.addIssue(report, 'warning', 'team', projection.name,
        `${sourceName}: Missing team for ${projection.name}`);
    }
    
    // Check for duplicate entries (same player, different values)
    // This will be handled in post-aggregation validation
  }
  
  /**
   * Validate computed values (VORP, valuations)
   */
  public validateComputedValues(
    players: Array<{
      name: string;
      position: Position;
      projectedPoints: number;
      vorp: number;
      intrinsicValue: number;
      marketPrice: number;
      edge: number;
    }>
  ): ValidationReport {
    const report: ValidationReport = {
      timestamp: new Date(),
      totalIssues: 0,
      errors: [],
      warnings: [],
      info: [],
      passedChecks: 0,
      failedChecks: 0,
      summary: ''
    };
    
    players.forEach(player => {
      const limits = this.POSITION_LIMITS[player.position];
      if (!limits) return;
      
      // Validate VORP
      const expectedVORP = player.projectedPoints - this.REPLACEMENT_LEVELS[player.position];
      const vorpDiff = Math.abs(player.vorp - expectedVORP);
      
      if (vorpDiff > 5) {
        this.addIssue(report, 'error', 'vorp', player.name,
          `VORP mismatch: calculated ${player.vorp}, expected ${expectedVORP.toFixed(2)}`,
          player.vorp, { min: expectedVORP - 1, max: expectedVORP + 1 });
      } else {
        report.passedChecks++;
      }
      
      // Validate VORP range
      if (player.vorp < limits.minVORP || player.vorp > limits.maxVORP) {
        this.addIssue(report, 'warning', 'vorp_range', player.name,
          `VORP ${player.vorp} outside expected range`,
          player.vorp, { min: limits.minVORP, max: limits.maxVORP });
      }
      
      // Validate intrinsic value
      if (player.intrinsicValue < limits.minValue || player.intrinsicValue > limits.maxValue) {
        this.addIssue(report, 'warning', 'intrinsicValue', player.name,
          `Intrinsic value $${player.intrinsicValue} outside expected range`,
          player.intrinsicValue, { min: limits.minValue, max: limits.maxValue });
      } else {
        report.passedChecks++;
      }
      
      // Validate market price
      if (player.marketPrice < 0 || player.marketPrice > 100) {
        this.addIssue(report, 'error', 'marketPrice', player.name,
          `Invalid market price: $${player.marketPrice}`,
          player.marketPrice, { min: 0, max: 100 });
      }
      
      // Validate edge calculation
      const expectedEdge = player.intrinsicValue - player.marketPrice;
      const edgeDiff = Math.abs(player.edge - expectedEdge);
      
      if (edgeDiff > 0.5) {
        this.addIssue(report, 'warning', 'edge', player.name,
          `Edge calculation mismatch: ${player.edge} vs expected ${expectedEdge.toFixed(2)}`);
      } else {
        report.passedChecks++;
      }
    });
    
    // Check for position-level issues
    this.validatePositionDistribution(players, report);
    
    report.totalIssues = report.errors.length + report.warnings.length;
    report.summary = this.generateSummary(report);
    
    return report;
  }
  
  /**
   * Detect outliers using statistical methods
   */
  public detectOutliers(
    players: Array<{
      name: string;
      position: Position;
      projectedPoints: number;
      vorp: number;
      intrinsicValue: number;
    }>
  ): Array<{
    player: string;
    field: string;
    value: number;
    zScore: number;
    percentile: number;
  }> {
    const outliers: any[] = [];
    
    // Group by position
    const byPosition = new Map<Position, typeof players>();
    players.forEach(player => {
      if (!byPosition.has(player.position)) {
        byPosition.set(player.position, []);
      }
      byPosition.get(player.position)!.push(player);
    });
    
    // Detect outliers for each position
    byPosition.forEach((posPlayers, position) => {
      if (posPlayers.length < 5) return; // Need minimum sample size
      
      // Check projected points
      const points = posPlayers.map(p => p.projectedPoints);
      const pointsOutliers = this.findStatisticalOutliers(points);
      pointsOutliers.forEach(index => {
        const player = posPlayers[index];
        outliers.push({
          player: player.name,
          field: 'projectedPoints',
          value: player.projectedPoints,
          zScore: this.calculateZScore(player.projectedPoints, points),
          percentile: this.calculatePercentile(player.projectedPoints, points)
        });
      });
      
      // Check VORP
      const vorps = posPlayers.map(p => p.vorp);
      const vorpOutliers = this.findStatisticalOutliers(vorps);
      vorpOutliers.forEach(index => {
        const player = posPlayers[index];
        outliers.push({
          player: player.name,
          field: 'vorp',
          value: player.vorp,
          zScore: this.calculateZScore(player.vorp, vorps),
          percentile: this.calculatePercentile(player.vorp, vorps)
        });
      });
      
      // Check intrinsic value
      const values = posPlayers.map(p => p.intrinsicValue);
      const valueOutliers = this.findStatisticalOutliers(values);
      valueOutliers.forEach(index => {
        const player = posPlayers[index];
        outliers.push({
          player: player.name,
          field: 'intrinsicValue',
          value: player.intrinsicValue,
          zScore: this.calculateZScore(player.intrinsicValue, values),
          percentile: this.calculatePercentile(player.intrinsicValue, values)
        });
      });
    });
    
    return outliers;
  }
  
  /**
   * Validate ADP data consistency
   */
  public validateADPData(adpData: PlayerADP[]): ValidationReport {
    const report: ValidationReport = {
      timestamp: new Date(),
      totalIssues: 0,
      errors: [],
      warnings: [],
      info: [],
      passedChecks: 0,
      failedChecks: 0,
      summary: ''
    };
    
    // Check for duplicates
    const seen = new Set<string>();
    adpData.forEach(player => {
      const key = `${player.name}_${player.position}`;
      if (seen.has(key)) {
        this.addIssue(report, 'error', 'duplicate', player.name,
          `Duplicate ADP entry for ${player.name} (${player.position})`);
      } else {
        seen.add(key);
        report.passedChecks++;
      }
      
      // Validate ADP value
      const adp = player.adp || 999;
      if (adp < 1 || adp > 500) {
        this.addIssue(report, 'warning', 'adp', player.name,
          `ADP value ${adp} outside expected range (1-500)`);
      }
      
      // Validate auction value if present
      if (player.auctionValue !== undefined) {
        if (player.auctionValue < 0 || player.auctionValue > 200) {
          this.addIssue(report, 'warning', 'auctionValue', player.name,
            `Auction value $${player.auctionValue} outside expected range`);
        }
      }
    });
    
    report.totalIssues = report.errors.length + report.warnings.length;
    report.summary = this.generateSummary(report);
    
    return report;
  }
  
  /**
   * Helper: Add issue to report
   */
  private addIssue(
    report: ValidationReport,
    severity: 'error' | 'warning' | 'info',
    field: string,
    player: string | undefined,
    message: string,
    value?: any,
    expectedRange?: { min: number; max: number }
  ): void {
    const issue: ValidationIssue = {
      severity,
      field,
      player,
      message,
      value,
      expectedRange
    };
    
    switch (severity) {
      case 'error':
        report.errors.push(issue);
        report.failedChecks++;
        break;
      case 'warning':
        report.warnings.push(issue);
        report.failedChecks++;
        break;
      case 'info':
        report.info.push(issue);
        break;
    }
    
    this.validationLog.push(issue);
  }
  
  /**
   * Helper: Get position counts
   */
  private getPositionCounts(projections: PlayerProjection[]): Record<string, number> {
    const counts: Record<string, number> = {};
    projections.forEach(p => {
      counts[p.position] = (counts[p.position] || 0) + 1;
    });
    return counts;
  }
  
  /**
   * Helper: Validate position distribution
   */
  private validatePositionDistribution(players: any[], report: ValidationReport): void {
    const counts = this.getPositionCounts(players);
    
    Object.entries(this.POSITION_LIMITS).forEach(([position, limits]) => {
      const count = counts[position] || 0;
      if (count < limits.expectedCount.min) {
        this.addIssue(report, 'error', 'distribution', undefined,
          `Too few ${position} players: ${count} (min: ${limits.expectedCount.min})`);
      } else if (count > limits.expectedCount.max) {
        this.addIssue(report, 'warning', 'distribution', undefined,
          `Too many ${position} players: ${count} (max: ${limits.expectedCount.max})`);
      }
    });
  }
  
  /**
   * Helper: Find statistical outliers using IQR method
   */
  private findStatisticalOutliers(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outlierIndices: number[] = [];
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outlierIndices.push(index);
      }
    });
    
    return outlierIndices;
  }
  
  /**
   * Helper: Calculate Z-score
   */
  private calculateZScore(value: number, values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? (value - mean) / stdDev : 0;
  }
  
  /**
   * Helper: Calculate percentile
   */
  private calculatePercentile(value: number, values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return (index / sorted.length) * 100;
  }
  
  /**
   * Generate validation summary
   */
  private generateSummary(report: ValidationReport): string {
    const total = report.passedChecks + report.failedChecks;
    const passRate = total > 0 ? (report.passedChecks / total * 100).toFixed(1) : '0';
    
    return `Validation complete: ${passRate}% pass rate. ` +
           `${report.errors.length} errors, ${report.warnings.length} warnings. ` +
           `${report.passedChecks}/${total} checks passed.`;
  }
  
  /**
   * Get validation log
   */
  public getValidationLog(): ValidationIssue[] {
    return [...this.validationLog];
  }
  
  /**
   * Clear validation log
   */
  public clearValidationLog(): void {
    this.validationLog = [];
  }
}

export const dataValidationLayer = DataValidationLayer.getInstance();