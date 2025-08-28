/**
 * Recomputation Validation System
 * 
 * Loads app table data, samples across dimensions, recomputes all derived fields
 * from canonical sources, and produces detailed diff reports.
 */

import { dataService } from './dataService';
import { AuctionValuationModel } from './auctionValuationModel';
import type { PlayerValuation, PlayerProjection, PlayerADP } from '@/types';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

interface SampledPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  appData: {
    projectedPoints: number;
    vorp: number;
    intrinsicValue: number;
    marketPrice: number;
    edge: number;
    confidence: number;
    maxBid: number;
    minBid: number;
    replacementLevel: number;
    adp?: number;
  };
  recomputed: {
    projectedPoints: number;
    vorp: number;
    intrinsicValue: number;
    marketPrice: number;
    edge: number;
    confidence: number;
    maxBid: number;
    minBid: number;
    replacementLevel: number;
    adp?: number;
  };
  diffs: {
    projectedPoints: { abs: number; rel: number; match: boolean };
    vorp: { abs: number; rel: number; match: boolean };
    intrinsicValue: { abs: number; rel: number; match: boolean };
    marketPrice: { abs: number; rel: number; match: boolean };
    edge: { abs: number; rel: number; match: boolean };
    confidence: { abs: number; rel: number; match: boolean };
    maxBid: { abs: number; rel: number; match: boolean };
    minBid: { abs: number; rel: number; match: boolean };
    replacementLevel: { abs: number; rel: number; match: boolean };
  };
}

interface ValidationReport {
  timestamp: string;
  rowsTested: number;
  totalMismatches: number;
  mismatchRate: number;
  fieldMismatches: {
    [field: string]: {
      count: number;
      rate: number;
      avgAbsDiff: number;
      avgRelDiff: number;
      maxAbsDiff: number;
      maxRelDiff: number;
      examples: Array<{
        player: string;
        appValue: number;
        recomputedValue: number;
        diff: number;
      }>;
    };
  };
  positionBreakdown: {
    [position: string]: {
      tested: number;
      mismatches: number;
      rate: number;
    };
  };
  vorpDistribution: {
    negative: { tested: number; mismatches: number };
    low: { tested: number; mismatches: number };      // 0-50
    medium: { tested: number; mismatches: number };   // 50-150
    high: { tested: number; mismatches: number };     // 150+
  };
  suspectedCauses: string[];
  samples: SampledPlayer[];
}

export class RecomputeValidation {
  private valuationModel: AuctionValuationModel;
  private readonly TOLERANCE = 0.01; // 1% tolerance for floating point comparisons
  
  constructor() {
    this.valuationModel = new AuctionValuationModel();
  }
  
  /**
   * Create a stratified sample of players
   */
  private createStratifiedSample(players: PlayerValuation[], targetSize: number = 100): PlayerValuation[] {
    const sample: PlayerValuation[] = [];
    
    // Position stratification
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    const perPosition = Math.floor(targetSize / positions.length);
    
    positions.forEach(pos => {
      const positionPlayers = players.filter(p => p.position === pos);
      const sorted = positionPlayers.sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
      
      // Sample across VORP range for this position
      if (sorted.length > 0) {
        // Top tier
        if (sorted.length > 0) sample.push(sorted[0]);
        
        // Middle tier
        const midIndex = Math.floor(sorted.length / 2);
        if (midIndex < sorted.length) sample.push(sorted[midIndex]);
        
        // Lower tier
        if (sorted.length > 2) sample.push(sorted[sorted.length - 1]);
        
        // Random samples to fill quota
        for (let i = sample.filter(p => p.position === pos).length; i < perPosition && i < sorted.length; i++) {
          const randomIndex = Math.floor(Math.random() * sorted.length);
          if (!sample.includes(sorted[randomIndex])) {
            sample.push(sorted[randomIndex]);
          }
        }
      }
    });
    
    // Add edge cases
    // Highest projected points overall
    const highestPoints = players.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))[0];
    if (highestPoints && !sample.includes(highestPoints)) sample.push(highestPoints);
    
    // Lowest positive VORP
    const lowestPositiveVorp = players
      .filter(p => (p.vorp || 0) > 0)
      .sort((a, b) => (a.vorp || 0) - (b.vorp || 0))[0];
    if (lowestPositiveVorp && !sample.includes(lowestPositiveVorp)) sample.push(lowestPositiveVorp);
    
    // Highest market price
    const highestPrice = players.sort((a, b) => (b.marketPrice || 0) - (a.marketPrice || 0))[0];
    if (highestPrice && !sample.includes(highestPrice)) sample.push(highestPrice);
    
    return sample.slice(0, targetSize);
  }
  
  /**
   * Load canonical data for a specific player
   */
  private async loadCanonicalDataForPlayer(player: PlayerValuation): Promise<{
    projection: PlayerProjection | null;
    adp: PlayerADP | null;
  }> {
    try {
      // In a browser environment, we need to use the already loaded data
      const data = await dataService.getData();
      
      // Find matching projection
      const projection = data.projections.find(p => 
        p.name.toLowerCase() === player.name.toLowerCase() &&
        p.position === player.position
      ) || null;
      
      // Find matching ADP
      const adp = data.adpData.find(a => 
        a.name.toLowerCase() === player.name.toLowerCase() &&
        a.position === player.position
      ) || null;
      
      return { projection, adp };
    } catch (error) {
      logger.error(`Failed to load canonical data for ${player.name}:`, error);
      return { projection: null, adp: null };
    }
  }
  
  /**
   * Recompute all derived fields for a player
   */
  private recomputePlayerValues(
    projection: PlayerProjection | null,
    adp: PlayerADP | null
  ): SampledPlayer['recomputed'] {
    if (!projection) {
      return {
        projectedPoints: 0,
        vorp: 0,
        intrinsicValue: 0,
        marketPrice: 0,
        edge: 0,
        confidence: 0,
        maxBid: 0,
        minBid: 0,
        replacementLevel: 0,
        adp: 0
      };
    }
    
    // Get replacement level for position
    const replacementLevel = this.getReplacementLevel(projection.position);
    
    // Calculate VORP
    const projectedPoints = projection.projectedPoints || 0;
    const vorp = Math.max(0, projectedPoints - replacementLevel);
    
    // Use valuation model to calculate values
    const valuation = this.valuationModel.calculateValue({
      projection,
      adp: adp?.adp || 250,
      auctionValue: adp?.auctionValue,
      leagueSettings: {
        budget: 200,
        teams: 12,
        rosterSize: 15,
        starters: {
          QB: 1,
          RB: 2,
          WR: 3,
          TE: 1,
          FLEX: 1,
          DST: 1,
          K: 1
        }
      }
    });
    
    return {
      projectedPoints,
      vorp,
      intrinsicValue: valuation.intrinsicValue,
      marketPrice: valuation.marketPrice,
      edge: valuation.edge,
      confidence: valuation.confidence,
      maxBid: Math.max(1, Math.round(valuation.intrinsicValue * 1.2)),
      minBid: Math.max(1, Math.round(valuation.intrinsicValue * 0.8)),
      replacementLevel,
      adp: adp?.adp
    };
  }
  
  /**
   * Get replacement level for a position
   */
  private getReplacementLevel(position: string): number {
    const replacementLevels: Record<string, number> = {
      QB: 220,  // QB12 in 12-team league
      RB: 100,  // RB30 (with flex)
      WR: 95,   // WR42 (with flex)
      TE: 80,   // TE14
      DST: 70,  // DST12
      K: 110    // K12
    };
    return replacementLevels[position] || 90;
  }
  
  /**
   * Calculate differences between app and recomputed values
   */
  private calculateDiffs(
    appValue: number,
    recomputedValue: number,
    tolerance: number = this.TOLERANCE
  ): { abs: number; rel: number; match: boolean } {
    const abs = Math.abs(appValue - recomputedValue);
    const rel = appValue !== 0 ? abs / Math.abs(appValue) : (recomputedValue !== 0 ? Infinity : 0);
    const match = rel <= tolerance;
    
    return { abs, rel, match };
  }
  
  /**
   * Run the full validation
   */
  public async runValidation(): Promise<ValidationReport> {
    logger.info('Starting recomputation validation...');
    
    // Load app data
    const appData = await dataService.getData();
    const players = appData.projections.map(proj => {
      // Find matching ADP
      const adpEntry = appData.adpData.find(a => 
        a.name.toLowerCase() === proj.name.toLowerCase() &&
        a.position === proj.position
      );
      
      // Create PlayerValuation object
      const valuation: PlayerValuation = {
        ...proj,
        vorp: proj.vorp || 0,
        intrinsicValue: proj.intrinsicValue || 0,
        marketPrice: proj.marketPrice || 0,
        edge: proj.edge || 0,
        confidence: proj.confidence || 0.5,
        recommendation: proj.recommendation || 'FAIR',
        maxBid: proj.maxBid || 1,
        minBid: proj.minBid || 1,
        replacementLevel: this.getReplacementLevel(proj.position)
      };
      
      return valuation;
    });
    
    // Create stratified sample
    const sample = this.createStratifiedSample(players, 100);
    logger.info(`Created sample of ${sample.length} players`);
    
    // Process each sampled player
    const samples: SampledPlayer[] = [];
    const fieldMismatches: Record<string, any[]> = {
      projectedPoints: [],
      vorp: [],
      intrinsicValue: [],
      marketPrice: [],
      edge: [],
      confidence: [],
      maxBid: [],
      minBid: [],
      replacementLevel: []
    };
    
    for (const player of sample) {
      // Load canonical data
      const { projection, adp } = await this.loadCanonicalDataForPlayer(player);
      
      // Recompute values
      const recomputed = this.recomputePlayerValues(projection, adp);
      
      // Calculate diffs
      const sampledPlayer: SampledPlayer = {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team,
        appData: {
          projectedPoints: player.projectedPoints,
          vorp: player.vorp,
          intrinsicValue: player.intrinsicValue,
          marketPrice: player.marketPrice,
          edge: player.edge,
          confidence: player.confidence,
          maxBid: player.maxBid,
          minBid: player.minBid,
          replacementLevel: player.replacementLevel,
          adp: adp?.adp
        },
        recomputed,
        diffs: {
          projectedPoints: this.calculateDiffs(player.projectedPoints, recomputed.projectedPoints),
          vorp: this.calculateDiffs(player.vorp, recomputed.vorp),
          intrinsicValue: this.calculateDiffs(player.intrinsicValue, recomputed.intrinsicValue),
          marketPrice: this.calculateDiffs(player.marketPrice, recomputed.marketPrice),
          edge: this.calculateDiffs(player.edge, recomputed.edge),
          confidence: this.calculateDiffs(player.confidence, recomputed.confidence),
          maxBid: this.calculateDiffs(player.maxBid, recomputed.maxBid),
          minBid: this.calculateDiffs(player.minBid, recomputed.minBid),
          replacementLevel: this.calculateDiffs(player.replacementLevel, recomputed.replacementLevel)
        }
      };
      
      samples.push(sampledPlayer);
      
      // Track mismatches
      Object.keys(sampledPlayer.diffs).forEach(field => {
        if (!sampledPlayer.diffs[field as keyof typeof sampledPlayer.diffs].match) {
          fieldMismatches[field].push({
            player: player.name,
            appValue: sampledPlayer.appData[field as keyof typeof sampledPlayer.appData],
            recomputedValue: sampledPlayer.recomputed[field as keyof typeof sampledPlayer.recomputed],
            diff: sampledPlayer.diffs[field as keyof typeof sampledPlayer.diffs].abs
          });
        }
      });
    }
    
    // Calculate statistics
    const report: ValidationReport = {
      timestamp: new Date().toISOString(),
      rowsTested: samples.length,
      totalMismatches: samples.filter(s => 
        Object.values(s.diffs).some(d => !d.match)
      ).length,
      mismatchRate: 0,
      fieldMismatches: {},
      positionBreakdown: {},
      vorpDistribution: {
        negative: { tested: 0, mismatches: 0 },
        low: { tested: 0, mismatches: 0 },
        medium: { tested: 0, mismatches: 0 },
        high: { tested: 0, mismatches: 0 }
      },
      suspectedCauses: [],
      samples
    };
    
    // Calculate mismatch rate
    report.mismatchRate = report.totalMismatches / report.rowsTested;
    
    // Analyze field mismatches
    Object.keys(fieldMismatches).forEach(field => {
      const mismatches = fieldMismatches[field];
      if (mismatches.length > 0) {
        const absDiffs = mismatches.map(m => m.diff);
        const relDiffs = mismatches.map(m => 
          m.appValue !== 0 ? m.diff / Math.abs(m.appValue) : Infinity
        );
        
        report.fieldMismatches[field] = {
          count: mismatches.length,
          rate: mismatches.length / samples.length,
          avgAbsDiff: absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length,
          avgRelDiff: relDiffs.filter(d => d !== Infinity).reduce((a, b) => a + b, 0) / relDiffs.filter(d => d !== Infinity).length,
          maxAbsDiff: Math.max(...absDiffs),
          maxRelDiff: Math.max(...relDiffs.filter(d => d !== Infinity)),
          examples: mismatches.slice(0, 3)
        };
      }
    });
    
    // Position breakdown
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    positions.forEach(pos => {
      const posSamples = samples.filter(s => s.position === pos);
      const posMismatches = posSamples.filter(s => 
        Object.values(s.diffs).some(d => !d.match)
      );
      
      report.positionBreakdown[pos] = {
        tested: posSamples.length,
        mismatches: posMismatches.length,
        rate: posSamples.length > 0 ? posMismatches.length / posSamples.length : 0
      };
    });
    
    // VORP distribution analysis
    samples.forEach(s => {
      const vorp = s.appData.vorp;
      const hasMismatch = Object.values(s.diffs).some(d => !d.match);
      
      if (vorp < 0) {
        report.vorpDistribution.negative.tested++;
        if (hasMismatch) report.vorpDistribution.negative.mismatches++;
      } else if (vorp <= 50) {
        report.vorpDistribution.low.tested++;
        if (hasMismatch) report.vorpDistribution.low.mismatches++;
      } else if (vorp <= 150) {
        report.vorpDistribution.medium.tested++;
        if (hasMismatch) report.vorpDistribution.medium.mismatches++;
      } else {
        report.vorpDistribution.high.tested++;
        if (hasMismatch) report.vorpDistribution.high.mismatches++;
      }
    });
    
    // Identify suspected causes
    report.suspectedCauses = this.identifySuspectedCauses(report);
    
    return report;
  }
  
  /**
   * Identify suspected causes of mismatches
   */
  private identifySuspectedCauses(report: ValidationReport): string[] {
    const causes: string[] = [];
    
    // Check if projection points are consistently off
    if (report.fieldMismatches.projectedPoints?.rate > 0.1) {
      causes.push('Projection aggregation weights may differ between app and recomputation');
    }
    
    // Check if VORP calculations are off
    if (report.fieldMismatches.vorp?.rate > 0.1) {
      causes.push('Replacement level values may be inconsistent');
    }
    
    // Check if valuation model outputs differ
    if (report.fieldMismatches.intrinsicValue?.rate > 0.1 || 
        report.fieldMismatches.marketPrice?.rate > 0.1) {
      causes.push('Valuation model parameters or formulas may have changed');
    }
    
    // Check for position-specific issues
    Object.entries(report.positionBreakdown).forEach(([pos, data]) => {
      if (data.rate > 0.2) {
        causes.push(`High mismatch rate for ${pos} position suggests position-specific calculation issues`);
      }
    });
    
    // Check for VORP-range specific issues
    if (report.vorpDistribution.negative.mismatches / Math.max(1, report.vorpDistribution.negative.tested) > 0.3) {
      causes.push('Negative VORP handling may be incorrect');
    }
    
    return causes;
  }
  
  /**
   * Save report to JSON and CSV files
   */
  public async saveReports(report: ValidationReport): Promise<{ json: string; csv: string }> {
    const reportsDir = './reports';
    
    // Create reports directory if it doesn't exist
    if (typeof window === 'undefined') {
      // Node.js environment
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      // Save JSON report
      const jsonPath = path.join(reportsDir, 'recompute_diff.json');
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
      
      // Save CSV report
      const csvPath = path.join(reportsDir, 'recompute_diff.csv');
      const csvContent = this.generateCSV(report);
      fs.writeFileSync(csvPath, csvContent);
      
      return { json: jsonPath, csv: csvPath };
    } else {
      // Browser environment - return as data URIs
      const jsonContent = JSON.stringify(report, null, 2);
      const csvContent = this.generateCSV(report);
      
      const jsonDataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent);
      const csvDataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      
      return { json: jsonDataUri, csv: csvDataUri };
    }
  }
  
  /**
   * Generate CSV content from report
   */
  private generateCSV(report: ValidationReport): string {
    const headers = [
      'Player Name',
      'Position',
      'Team',
      'Field',
      'App Value',
      'Recomputed Value',
      'Abs Diff',
      'Rel Diff',
      'Match'
    ];
    
    const rows: string[][] = [headers];
    
    report.samples.forEach(sample => {
      Object.keys(sample.diffs).forEach(field => {
        const appValue = sample.appData[field as keyof typeof sample.appData];
        const recomputedValue = sample.recomputed[field as keyof typeof sample.recomputed];
        const diff = sample.diffs[field as keyof typeof sample.diffs];
        
        rows.push([
          sample.name,
          sample.position,
          sample.team,
          field,
          String(appValue || 0),
          String(recomputedValue || 0),
          diff.abs.toFixed(4),
          diff.rel.toFixed(4),
          diff.match ? 'TRUE' : 'FALSE'
        ]);
      });
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }
  
  /**
   * Print summary to console
   */
  public printSummary(report: ValidationReport, paths: { json: string; csv: string }): void {
    const summary = {
      timestamp: report.timestamp,
      rows_tested: report.rowsTested,
      total_mismatches: report.totalMismatches,
      mismatch_rate: `${(report.mismatchRate * 100).toFixed(2)}%`,
      top_failing_fields: Object.entries(report.fieldMismatches)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([field, data]) => ({
          field,
          mismatches: data.count,
          rate: `${(data.rate * 100).toFixed(2)}%`,
          avg_diff: data.avgAbsDiff.toFixed(2)
        })),
      suspected_causes: report.suspectedCauses,
      artifact_paths: paths
    };
    
    console.log('\n=== RECOMPUTATION VALIDATION SUMMARY ===\n');
    console.log(JSON.stringify(summary, null, 2));
  }
}

// Export singleton instance
export const recomputeValidation = new RecomputeValidation();