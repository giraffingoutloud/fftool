/**
 * Valuation Invariant Checker
 * Evaluates critical mathematical invariants that must hold for a valid auction valuation model
 */

import { logger } from './utils/logger';
import type { Position } from '@/types';

interface PlayerData {
  id: string;
  name: string;
  position: Position;
  team: string;
  projectedPoints: number;
  vorp: number;
  intrinsicValue: number;
  marketPrice: number;
  edge: number;
  maxBid?: number;
  replacementLevel?: number;
}

interface InvariantResult {
  passed: boolean;
  message: string;
  details: any;
  counterexamples?: any[];
}

interface InvariantsReport {
  timestamp: Date;
  datasetSize: number;
  leagueSettings: {
    teams: number;
    budget: number;
    rosterSize: number;
    starters: Record<Position | 'FLEX', number>;
  };
  invariants: {
    budgetConservation: InvariantResult;
    replacementLevelZeroing: InvariantResult;
    nonNegativity: InvariantResult;
    monotonicity: InvariantResult;
    positionalScarcity: InvariantResult;
    maxBudgetShareCap: InvariantResult;
  };
  summary: {
    totalChecked: number;
    totalPassed: number;
    passRate: number;
    criticalFailures: string[];
  };
}

export class ValuationInvariantChecker {
  private static instance: ValuationInvariantChecker;
  
  // League settings (standard 12-team)
  private readonly LEAGUE_SETTINGS = {
    teams: 12,
    budget: 200,
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
  };
  
  // Replacement levels by position
  private readonly REPLACEMENT_LEVELS: Record<Position, number> = {
    QB: 220,  // QB12
    RB: 100,  // RB30 (2.5 per team)
    WR: 95,   // WR42 (3.5 per team)
    TE: 80,   // TE14
    DST: 70,  // DST12
    K: 110    // K12
  };
  
  // Tolerance levels for floating point comparisons
  private readonly TOLERANCE = {
    budget: 0.05,      // 5% tolerance for budget conservation
    vorp: 5.0,         // 5 point tolerance for VORP
    price: 0.01,       // 1% tolerance for prices
    monotonicity: 0.1  // 10% tolerance for monotonicity
  };
  
  private constructor() {}
  
  public static getInstance(): ValuationInvariantChecker {
    if (!ValuationInvariantChecker.instance) {
      ValuationInvariantChecker.instance = new ValuationInvariantChecker();
    }
    return ValuationInvariantChecker.instance;
  }
  
  /**
   * Check all invariants on the dataset
   */
  public async checkAllInvariants(players: PlayerData[]): Promise<InvariantsReport> {
    logger.info(`Checking invariants on ${players.length} players`);
    
    const report: InvariantsReport = {
      timestamp: new Date(),
      datasetSize: players.length,
      leagueSettings: this.LEAGUE_SETTINGS,
      invariants: {
        budgetConservation: this.checkBudgetConservation(players),
        replacementLevelZeroing: this.checkReplacementLevelZeroing(players),
        nonNegativity: this.checkNonNegativity(players),
        monotonicity: this.checkMonotonicity(players),
        positionalScarcity: this.checkPositionalScarcity(players),
        maxBudgetShareCap: this.checkMaxBudgetShareCap(players)
      },
      summary: {
        totalChecked: 0,
        totalPassed: 0,
        passRate: 0,
        criticalFailures: []
      }
    };
    
    // Calculate summary
    const invariantResults = Object.values(report.invariants);
    report.summary.totalChecked = invariantResults.length;
    report.summary.totalPassed = invariantResults.filter(r => r.passed).length;
    report.summary.passRate = (report.summary.totalPassed / report.summary.totalChecked) * 100;
    
    // Identify critical failures
    Object.entries(report.invariants).forEach(([name, result]) => {
      if (!result.passed) {
        report.summary.criticalFailures.push(name);
      }
    });
    
    return report;
  }
  
  /**
   * Invariant 1: Budget Conservation
   * The sum of recommended prices should approximately equal total league budget
   */
  private checkBudgetConservation(players: PlayerData[]): InvariantResult {
    const totalBudget = this.LEAGUE_SETTINGS.teams * this.LEAGUE_SETTINGS.budget;
    const totalRosterSpots = this.LEAGUE_SETTINGS.teams * this.LEAGUE_SETTINGS.rosterSize;
    
    // Get top N players by intrinsic value (where N = total roster spots)
    const topPlayers = [...players]
      .sort((a, b) => b.intrinsicValue - a.intrinsicValue)
      .slice(0, totalRosterSpots);
    
    // Calculate sum of intrinsic values (recommended prices)
    const sumIntrinsicValues = topPlayers.reduce((sum, p) => sum + p.intrinsicValue, 0);
    
    // Calculate sum of market prices for comparison
    const sumMarketPrices = topPlayers.reduce((sum, p) => sum + p.marketPrice, 0);
    
    // Check if within tolerance
    const intrinsicRatio = sumIntrinsicValues / totalBudget;
    const marketRatio = sumMarketPrices / totalBudget;
    const intrinsicDiff = Math.abs(1 - intrinsicRatio);
    const marketDiff = Math.abs(1 - marketRatio);
    
    const passed = intrinsicDiff <= this.TOLERANCE.budget;
    
    return {
      passed,
      message: passed 
        ? `Budget conservation holds: Sum of top ${totalRosterSpots} intrinsic values = $${sumIntrinsicValues.toFixed(2)} (${(intrinsicRatio * 100).toFixed(1)}% of total budget)`
        : `Budget conservation violated: Sum = $${sumIntrinsicValues.toFixed(2)} (${(intrinsicRatio * 100).toFixed(1)}% of total budget, expected ~100%)`,
      details: {
        totalBudget,
        totalRosterSpots,
        sumIntrinsicValues,
        sumMarketPrices,
        intrinsicRatio,
        marketRatio,
        intrinsicDiff,
        marketDiff,
        tolerance: this.TOLERANCE.budget
      }
    };
  }
  
  /**
   * Invariant 2: Replacement-Level Zeroing
   * Mean VORP should be ~0 at replacement level for each position
   */
  private checkReplacementLevelZeroing(players: PlayerData[]): InvariantResult {
    const results: Record<Position, any> = {} as any;
    let allPassed = true;
    const failures: any[] = [];
    
    // Check each position
    Object.entries(this.REPLACEMENT_LEVELS).forEach(([position, replacementLevel]) => {
      const posPlayers = players.filter(p => p.position === position);
      
      // Find players near replacement level (within 10 points)
      const nearReplacement = posPlayers.filter(p => 
        Math.abs(p.projectedPoints - replacementLevel) <= 10
      );
      
      if (nearReplacement.length > 0) {
        const meanVORP = nearReplacement.reduce((sum, p) => sum + p.vorp, 0) / nearReplacement.length;
        const passed = Math.abs(meanVORP) <= this.TOLERANCE.vorp;
        
        results[position as Position] = {
          replacementLevel,
          playersNearReplacement: nearReplacement.length,
          meanVORP,
          passed
        };
        
        if (!passed) {
          allPassed = false;
          failures.push({
            position,
            meanVORP,
            expected: 0,
            examples: nearReplacement.slice(0, 3).map(p => ({
              name: p.name,
              points: p.projectedPoints,
              vorp: p.vorp
            }))
          });
        }
      } else {
        results[position as Position] = {
          replacementLevel,
          playersNearReplacement: 0,
          meanVORP: null,
          passed: true // No players to check
        };
      }
    });
    
    return {
      passed: allPassed,
      message: allPassed
        ? 'Replacement-level zeroing holds for all positions'
        : `Replacement-level zeroing violated for ${failures.length} position(s)`,
      details: results,
      counterexamples: failures.slice(0, 3)
    };
  }
  
  /**
   * Invariant 3: Non-Negativity
   * All values and prices must be non-negative
   */
  private checkNonNegativity(players: PlayerData[]): InvariantResult {
    const violations: any[] = [];
    
    players.forEach(player => {
      const issues: string[] = [];
      
      if (player.intrinsicValue < 0) {
        issues.push(`intrinsicValue: ${player.intrinsicValue}`);
      }
      if (player.marketPrice < 0) {
        issues.push(`marketPrice: ${player.marketPrice}`);
      }
      if (player.maxBid !== undefined && player.maxBid < 0) {
        issues.push(`maxBid: ${player.maxBid}`);
      }
      // Note: VORP and edge can be negative, that's valid
      
      if (issues.length > 0) {
        violations.push({
          player: player.name,
          position: player.position,
          issues
        });
      }
    });
    
    const passed = violations.length === 0;
    
    return {
      passed,
      message: passed
        ? 'Non-negativity constraint satisfied for all players'
        : `Non-negativity violated for ${violations.length} player(s)`,
      details: {
        totalPlayers: players.length,
        violations: violations.length
      },
      counterexamples: violations.slice(0, 5)
    };
  }
  
  /**
   * Invariant 4: Monotonicity
   * Within each position, higher projected points should lead to higher intrinsic value
   */
  private checkMonotonicity(players: PlayerData[]): InvariantResult {
    const violations: any[] = [];
    const positionResults: Record<string, any> = {};
    
    // Check each position separately
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    
    positions.forEach(position => {
      const posPlayers = players
        .filter(p => p.position === position)
        .sort((a, b) => a.projectedPoints - b.projectedPoints);
      
      let monotonicitViolations = 0;
      
      for (let i = 1; i < posPlayers.length; i++) {
        const prev = posPlayers[i - 1];
        const curr = posPlayers[i];
        
        // If points increase but value decreases (allowing for small tolerance)
        if (curr.projectedPoints > prev.projectedPoints && 
            curr.intrinsicValue < prev.intrinsicValue * (1 - this.TOLERANCE.monotonicity)) {
          monotonicitViolations++;
          
          if (violations.length < 10) { // Limit counterexamples
            violations.push({
              position,
              player1: {
                name: prev.name,
                points: prev.projectedPoints,
                value: prev.intrinsicValue,
                vorp: prev.vorp
              },
              player2: {
                name: curr.name,
                points: curr.projectedPoints,
                value: curr.intrinsicValue,
                vorp: curr.vorp
              },
              issue: `Higher points (${curr.projectedPoints} > ${prev.projectedPoints}) but lower value ($${curr.intrinsicValue} < $${prev.intrinsicValue})`
            });
          }
        }
      }
      
      positionResults[position] = {
        totalPlayers: posPlayers.length,
        violations: monotonicitViolations,
        violationRate: posPlayers.length > 0 ? (monotonicitViolations / posPlayers.length) * 100 : 0
      };
    });
    
    const totalViolations = Object.values(positionResults).reduce((sum: number, r: any) => sum + r.violations, 0);
    const passed = totalViolations === 0;
    
    return {
      passed,
      message: passed
        ? 'Monotonicity holds for all positions'
        : `Monotonicity violated in ${totalViolations} cases`,
      details: {
        byPosition: positionResults,
        totalViolations,
        tolerance: this.TOLERANCE.monotonicity
      },
      counterexamples: violations.slice(0, 5)
    };
  }
  
  /**
   * Invariant 5: Positional Scarcity Sanity
   * Expected starters should command appropriate share of total value
   */
  private checkPositionalScarcity(players: PlayerData[]): InvariantResult {
    const results: Record<string, any> = {};
    
    // Calculate total intrinsic value
    const totalValue = players.reduce((sum, p) => sum + p.intrinsicValue, 0);
    
    // Expected shares based on typical league value distribution
    const expectedShares: Record<Position, { min: number; max: number }> = {
      QB: { min: 0.10, max: 0.20 },  // 10-20% for top QBs
      RB: { min: 0.25, max: 0.35 },  // 25-35% for top RBs
      WR: { min: 0.25, max: 0.35 },  // 25-35% for top WRs
      TE: { min: 0.08, max: 0.15 },  // 8-15% for top TEs
      DST: { min: 0.02, max: 0.08 }, // 2-8% for DSTs
      K: { min: 0.01, max: 0.05 }    // 1-5% for Ks
    };
    
    let allPassed = true;
    const issues: string[] = [];
    
    // Check each position
    Object.entries(this.LEAGUE_SETTINGS.starters).forEach(([pos, count]) => {
      if (pos === 'FLEX') return; // Skip FLEX for this check
      
      const position = pos as Position;
      const starterCount = count * this.LEAGUE_SETTINGS.teams;
      
      // Get top starters by intrinsic value
      const topStarters = players
        .filter(p => p.position === position)
        .sort((a, b) => b.intrinsicValue - a.intrinsicValue)
        .slice(0, starterCount);
      
      const starterValue = topStarters.reduce((sum, p) => sum + p.intrinsicValue, 0);
      const valueShare = totalValue > 0 ? starterValue / totalValue : 0;
      
      const expected = expectedShares[position];
      const withinRange = expected && valueShare >= expected.min && valueShare <= expected.max;
      
      results[position] = {
        starterCount,
        totalValue: starterValue,
        valueShare,
        expectedRange: expected,
        passed: withinRange || !expected
      };
      
      if (!withinRange && expected) {
        allPassed = false;
        issues.push(`${position}: ${(valueShare * 100).toFixed(1)}% (expected ${expected.min * 100}-${expected.max * 100}%)`);
      }
    });
    
    return {
      passed: allPassed,
      message: allPassed
        ? 'Positional scarcity reflects expected value distribution'
        : `Positional value shares outside expected ranges: ${issues.join(', ')}`,
      details: {
        totalValue,
        positionShares: results
      }
    };
  }
  
  /**
   * Invariant 6: Max Single-Player Budget Share Cap
   * No player should cost more than 35% of a team's budget
   */
  private checkMaxBudgetShareCap(players: PlayerData[]): InvariantResult {
    const maxBudgetShare = 0.35; // 35% cap
    const teamBudget = this.LEAGUE_SETTINGS.budget;
    const maxAllowedPrice = teamBudget * maxBudgetShare;
    
    const violations = players.filter(p => p.intrinsicValue > maxAllowedPrice);
    
    const passed = violations.length === 0;
    
    // Find the highest priced player
    const highestPriced = players.reduce((max, p) => 
      p.intrinsicValue > max.intrinsicValue ? p : max
    , players[0]);
    
    const highestShare = highestPriced ? highestPriced.intrinsicValue / teamBudget : 0;
    
    return {
      passed,
      message: passed
        ? `Max budget share cap satisfied: Highest = $${highestPriced?.intrinsicValue} (${(highestShare * 100).toFixed(1)}% of budget)`
        : `Max budget share cap violated: ${violations.length} player(s) exceed ${maxBudgetShare * 100}% of budget`,
      details: {
        maxAllowedPrice,
        maxBudgetShare,
        highestPriced: highestPriced ? {
          name: highestPriced.name,
          position: highestPriced.position,
          value: highestPriced.intrinsicValue,
          share: highestShare
        } : null,
        violationCount: violations.length
      },
      counterexamples: violations.slice(0, 5).map(p => ({
        name: p.name,
        position: p.position,
        value: p.intrinsicValue,
        share: p.intrinsicValue / teamBudget
      }))
    };
  }
  
  /**
   * Save report to JSON file
   */
  public async saveReport(report: InvariantsReport, filepath: string): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        // Node.js environment
        const fs = await import('fs');
        const path = await import('path');
        
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        logger.info(`Invariants report saved to ${filepath}`);
      } else {
        // Browser environment - download as file
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'invariants.json';
        a.click();
        URL.revokeObjectURL(url);
        logger.info('Invariants report downloaded');
      }
    } catch (error) {
      logger.error('Failed to save invariants report:', error);
      throw error;
    }
  }
  
  /**
   * Print summary to console
   */
  public printSummary(report: InvariantsReport): void {
    const summary = {
      timestamp: report.timestamp.toISOString(),
      dataset_size: report.datasetSize,
      invariants: {} as Record<string, { pass: boolean; message: string }>,
      summary: {
        pass_rate: `${report.summary.passRate.toFixed(1)}%`,
        failures: report.summary.criticalFailures
      }
    };
    
    // Add each invariant result
    Object.entries(report.invariants).forEach(([name, result]) => {
      summary.invariants[name] = {
        pass: result.passed,
        message: result.message
      };
    });
    
    console.log('\n=== VALUATION INVARIANTS CHECK ===\n');
    console.log(JSON.stringify(summary, null, 2));
  }
}

export const valuationInvariantChecker = ValuationInvariantChecker.getInstance();