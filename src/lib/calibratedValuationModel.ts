/**
 * PRODUCTION VALUATION MODEL V2.2
 * 
 * Market-aligned calibration with position caps:
 * - Reduced RB inflation (capped at $65)
 * - Increased market value blending (40%)
 * - Position-specific maximum values
 * - Better WR/QB valuation balance
 * 
 * League Settings:
 * - 12 teams, Full PPR, $200 budget
 * - Starters: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 DST, 1 K
 * - Bench: 7 spots
 * - Total roster: 16 players per team
 * 
 * VERSION HISTORY:
 * - V1: Original VORP model, poor market matching
 * - V2.0: Aggressive tier multipliers, broke invariants
 * - V2.1: Balanced but RBs overvalued by $10-25
 * - V2.2 (THIS): Market-aligned with position caps
 */

import { logger } from './utils/logger';

export interface LeagueSettings {
  teams: number;
  budget: number;
  rosterSize: number;
  starters: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number; // RB/WR/TE
    DST: number;
    K: number;
  };
  bench: number;
  scoring: 'PPR' | 'HALF_PPR' | 'STANDARD';
  season: {
    year: string;
    weeks: number;
    playoffWeeks: number;
  };
}

export interface PlayerData {
  id: string;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
  weeklyPoints?: number[];
  adp?: number;
  marketValue?: number; // NEW: Real auction value from market
  positionRank?: number;
  overallRank?: number;
  age?: number;
  byeWeek?: number;
}

export interface ValuationResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  projectedPoints: number;
  positionRank: number;
  replacementPoints: number;
  vbd: number;
  baseValue: number;
  marketAdjustment: number;
  tierAdjustment: number;
  auctionValue: number;
  confidence: number;
  maxBid: number;
  targetBid: number;
  minBid: number;
  adp?: number;
  marketValue?: number;
}

export class CalibratedValuationModel {
  private readonly leagueSettings: LeagueSettings = {
    teams: 12,
    budget: 200,
    rosterSize: 16,
    starters: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      DST: 1,
      K: 1
    },
    bench: 7,
    scoring: 'PPR',
    season: {
      year: '2025-2026',
      weeks: 18,
      playoffWeeks: 3
    }
  };

  // Replacement levels based on worst starter (V2.2: tighter for RB/WR)
  private readonly replacementRanks = {
    QB: 12,    // Streaming QBs more viable
    RB: 36,    // Tighter replacement (was 48)
    WR: 48,    // Tighter replacement (was 60)
    TE: 12,    // Streaming TEs more viable
    DST: 14,
    K: 13
  };

  // Base market adjustments by position (V2.2: reduced RB, increased WR)
  private readonly baseMarketAdjustments = {
    QB: 0.90,   // Up from 0.85
    RB: 1.05,   // DOWN from 1.15 - key fix for RB inflation
    WR: 1.05,   // Up from 1.00 - boost WR values
    TE: 0.95,   // Up from 0.90
    DST: 0.40,  // Down from 0.50
    K: 0.35     // Down from 0.45
  };

  // V2.2 CONSERVATIVE tier multipliers (prevent compound inflation)
  private readonly tierMultipliers = {
    elite: { ranks: [1, 3], multiplier: 1.05 },    // Down from 1.15
    tier1: { ranks: [4, 8], multiplier: 1.02 },    // Down from 1.08
    tier2: { ranks: [9, 16], multiplier: 1.00 },   // No change
    tier3: { ranks: [17, 24], multiplier: 0.95 },  // Up from 0.92
    tier4: { ranks: [25, 36], multiplier: 0.90 },  // Up from 0.85
    replacement: { ranks: [37, 999], multiplier: 0.80 } // Up from 0.75
  };

  // V2.2 Position-specific tier adjustments (RB reduced, WR boosted)
  private readonly positionTierAdjustments = {
    QB: {
      elite: 1.0,    // No extra boost
      tier1: 1.0,    // No extra boost
      tier2: 0.95,   // Slight reduction
      tier3: 0.90,   // More reduction
    },
    RB: {
      elite: 1.00,   // DOWN from 1.10 - no extra boost
      tier1: 0.98,   // DOWN from 1.05 - minimal boost
      tier2: 0.90,   // UP from 0.85
      tier3: 0.80,   // UP from 0.70
    },
    WR: {
      elite: 1.10,   // UP from 1.05 - boost elite WRs
      tier1: 1.05,   // UP from 1.00
      tier2: 1.00,   // UP from 0.95
      tier3: 0.90,   // UP from 0.85
    },
    TE: {
      elite: 1.10,   // Down from 1.15
      tier1: 1.00,   // Down from 1.05
      tier2: 0.80,   // No change
      tier3: 0.60,   // No change
    },
    DST: {
      all: 0.40,     // No change
    },
    K: {
      all: 0.35,     // No change
    }
  };

  // V2.2 Position-specific value caps
  private readonly positionCaps = {
    QB: 35,   // No QB should exceed $35
    RB: 65,   // No RB should exceed $65 (key constraint)
    WR: 60,   // No WR should exceed $60
    TE: 40,   // No TE should exceed $40
    DST: 8,   // No DST should exceed $8
    K: 5      // No K should exceed $5
  };

  // Target budget allocation percentages
  private readonly targetAllocation = {
    QB: { min: 0.05, max: 0.10, target: 0.07 },
    RB: { min: 0.45, max: 0.50, target: 0.48 },
    WR: { min: 0.35, max: 0.40, target: 0.37 },
    TE: { min: 0.05, max: 0.10, target: 0.07 },
    DST: { min: 0.005, max: 0.015, target: 0.01 },
    K: { min: 0.005, max: 0.01, target: 0.005 }
  };

  /**
   * Calculate auction value for a player using V2.1 balanced formula
   */
  public calculateAuctionValue(
    player: PlayerData,
    allPlayers: PlayerData[]
  ): ValuationResult {
    // Step 1: Get position rank
    const positionRank = this.getPositionRank(player, allPlayers);
    
    // Step 2: Get replacement level points
    const replacementPoints = this.getReplacementPoints(player.position, allPlayers);
    
    // Step 3: Calculate VBD
    const vbd = Math.max(0, player.projectedPoints - replacementPoints);
    
    // Step 4: Calculate base auction value
    const baseValue = this.calculateBaseValue(vbd, allPlayers);
    
    // Step 5: Apply base market adjustment
    const baseMarketAdjustment = this.baseMarketAdjustments[player.position] || 1.0;
    
    // Step 6: Apply tier multiplier
    const tierMultiplier = this.getTierMultiplier(positionRank);
    
    // Step 7: Apply position-specific tier adjustment
    const positionTierAdjustment = this.getPositionTierAdjustment(player.position, positionRank);
    
    // Step 8: Calculate final value
    const rawValue = baseValue * baseMarketAdjustment * tierMultiplier * positionTierAdjustment;
    let auctionValue = Math.max(1, Math.round(rawValue));
    
    // Step 9: Blend with market value if available
    if (player.marketValue && player.marketValue > 0) {
      auctionValue = this.blendWithMarket(auctionValue, player.marketValue);
    }
    
    // Step 10: Apply specific corrections for known issues
    auctionValue = this.applySpecificCorrections(player, auctionValue);
    
    // Step 11: Apply position caps (V2.2)
    const positionCap = this.positionCaps[player.position];
    if (positionCap && auctionValue > positionCap) {
      logger.debug(`${player.position} ${player.name} exceeded cap: $${auctionValue} → $${positionCap}`);
      auctionValue = positionCap;
    }
    
    // Step 12: Calculate confidence
    const confidence = this.calculateConfidence(player, positionRank);
    
    // Step 13: Calculate bid ranges
    const maxBid = Math.max(1, Math.round(auctionValue * 1.15));
    const targetBid = auctionValue;
    const minBid = Math.max(1, Math.round(auctionValue * 0.85));
    
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      projectedPoints: player.projectedPoints,
      positionRank,
      replacementPoints,
      vbd,
      baseValue,
      marketAdjustment: baseMarketAdjustment * positionTierAdjustment,
      tierAdjustment: tierMultiplier,
      auctionValue,
      confidence,
      maxBid,
      targetBid,
      minBid,
      adp: player.adp,
      marketValue: player.marketValue
    };
  }

  /**
   * Get position-specific tier adjustment (V2.1 balanced)
   */
  private getPositionTierAdjustment(position: string, rank: number): number {
    const adjustments = this.positionTierAdjustments[position];
    
    if (!adjustments) return 1.0;
    
    // DST and K have a single adjustment
    if ('all' in adjustments) {
      return adjustments.all;
    }
    
    // Determine tier
    if (rank <= 3) return adjustments.elite || 1.0;
    if (rank <= 8) return adjustments.tier1 || 1.0;
    if (rank <= 16) return adjustments.tier2 || 1.0;
    return adjustments.tier3 || 0.85;
  }

  /**
   * Blend calculated value with market consensus (V2.2: increased market weight)
   */
  private blendWithMarket(calculatedValue: number, marketValue: number): number {
    // If values are very close (within 10%), use calculated
    const difference = Math.abs(calculatedValue - marketValue) / marketValue;
    if (difference < 0.10) {
      return calculatedValue;
    }
    
    // For larger differences, blend with more market influence
    // V2.2: 60% our calculation, 40% market (was 80/20)
    const blended = calculatedValue * 0.6 + marketValue * 0.4;
    
    return Math.max(1, Math.round(blended));
  }

  /**
   * Apply corrections for specific known issues
   */
  private applySpecificCorrections(player: PlayerData, value: number): number {
    // V2.2: All corrections removed - CSV now has correct values
    // Breece Hall: CSV updated from 166.7 to 220 pts
    // Tyreek Hill: CSV updated from 219.1 to correct value
    const corrections: { [key: string]: number } = {
      // All player-specific corrections removed
      // Data should be fixed in the CSV files, not hardcoded here
    };
    
    const correction = corrections[player.name];
    if (correction) {
      logger.debug(`Applying correction for ${player.name}: $${value} → $${correction} (flawed CSV data)`);
      return correction;
    }
    
    return value;
  }

  /**
   * Calculate base value using discretionary dollar method
   */
  private calculateBaseValue(vbd: number, allPlayers: PlayerData[]): number {
    const totalBudget = this.leagueSettings.teams * this.leagueSettings.budget;
    const totalRosterSpots = this.leagueSettings.teams * this.leagueSettings.rosterSize;
    const discretionaryBudget = totalBudget - totalRosterSpots;
    
    const rosterablePlayers = this.getRosterablePlayers(allPlayers);
    const totalLeagueVBD = rosterablePlayers.reduce((sum, p) => {
      const pReplacement = this.getReplacementPoints(p.position, allPlayers);
      const pVBD = Math.max(0, p.projectedPoints - pReplacement);
      return sum + pVBD;
    }, 0);
    
    const dollarsPerVBD = totalLeagueVBD > 0 ? discretionaryBudget / totalLeagueVBD : 0;
    
    return 1 + (vbd * dollarsPerVBD);
  }

  /**
   * Get replacement level points for a position
   */
  private getReplacementPoints(position: string, allPlayers: PlayerData[]): number {
    const replacementRank = this.replacementRanks[position];
    const positionPlayers = allPlayers
      .filter(p => p.position === position)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    if (positionPlayers.length >= replacementRank) {
      return positionPlayers[replacementRank - 1].projectedPoints;
    }
    
    return positionPlayers[positionPlayers.length - 1]?.projectedPoints || 0;
  }

  /**
   * Get rosterable players (top N at each position)
   */
  private getRosterablePlayers(allPlayers: PlayerData[]): PlayerData[] {
    const rosterable: PlayerData[] = [];
    
    const rosterLimits = {
      QB: 24,
      RB: 60,
      WR: 72,
      TE: 24,
      DST: 16,
      K: 14
    };
    
    Object.entries(rosterLimits).forEach(([position, limit]) => {
      const positionPlayers = allPlayers
        .filter(p => p.position === position)
        .sort((a, b) => b.projectedPoints - a.projectedPoints)
        .slice(0, limit);
      rosterable.push(...positionPlayers);
    });
    
    return rosterable;
  }

  /**
   * Get position rank for a player
   */
  private getPositionRank(player: PlayerData, allPlayers: PlayerData[]): number {
    const positionPlayers = allPlayers
      .filter(p => p.position === player.position)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    const rank = positionPlayers.findIndex(p => p.id === player.id) + 1;
    return rank || 999;
  }

  /**
   * Get tier multiplier based on position rank
   */
  private getTierMultiplier(positionRank: number): number {
    for (const tier of Object.values(this.tierMultipliers)) {
      if (positionRank >= tier.ranks[0] && positionRank <= tier.ranks[1]) {
        return tier.multiplier;
      }
    }
    return 0.70;
  }

  /**
   * Calculate confidence score for a valuation
   */
  private calculateConfidence(player: PlayerData, positionRank: number): number {
    let confidence = 0.75;
    
    if (positionRank <= 5) confidence += 0.15;
    else if (positionRank <= 12) confidence += 0.10;
    else if (positionRank <= 24) confidence += 0.05;
    
    if (player.age && player.age > 30) confidence -= 0.10;
    if (player.age && player.age > 32) confidence -= 0.05;
    
    // Boost confidence if we have market data
    if (player.marketValue && player.marketValue > 0) {
      confidence += 0.10;
    }
    
    return Math.max(0.5, Math.min(1.0, confidence));
  }

  /**
   * Validate that valuations meet budget conservation invariant
   */
  public validateBudgetConservation(valuations: ValuationResult[]): {
    passed: boolean;
    totalValue: number;
    expectedValue: number;
    percentageOfBudget: number;
  } {
    const draftedPlayers = valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, this.leagueSettings.teams * this.leagueSettings.rosterSize);
    
    const totalValue = draftedPlayers.reduce((sum, p) => sum + p.auctionValue, 0);
    const expectedValue = this.leagueSettings.teams * this.leagueSettings.budget;
    const percentageOfBudget = (totalValue / expectedValue) * 100;
    
    // Should be within 95-105% of total budget
    const passed = percentageOfBudget >= 95 && percentageOfBudget <= 105;
    
    return {
      passed,
      totalValue,
      expectedValue,
      percentageOfBudget
    };
  }

  /**
   * Validate positional value distribution
   */
  public validatePositionalDistribution(valuations: ValuationResult[]): {
    passed: boolean;
    distribution: Record<string, number>;
    targets: Record<string, { min: number; max: number; actual: number }>;
  } {
    const positionTotals: Record<string, number> = {};
    const starterCounts = this.getStarterCounts();
    
    Object.keys(starterCounts).forEach(position => {
      const topAtPosition = valuations
        .filter(v => v.position === position)
        .sort((a, b) => b.auctionValue - a.auctionValue)
        .slice(0, starterCounts[position]);
      
      positionTotals[position] = topAtPosition.reduce((sum, p) => sum + p.auctionValue, 0);
    });
    
    const totalStarterValue = Object.values(positionTotals).reduce((a, b) => a + b, 0);
    
    const distribution: Record<string, number> = {};
    const targets: Record<string, { min: number; max: number; actual: number }> = {};
    let allPassed = true;
    
    Object.keys(positionTotals).forEach(position => {
      const percentage = (positionTotals[position] / totalStarterValue);
      distribution[position] = percentage;
      
      const target = this.targetAllocation[position];
      targets[position] = {
        min: target.min,
        max: target.max,
        actual: percentage
      };
      
      if (percentage < target.min || percentage > target.max) {
        allPassed = false;
      }
    });
    
    return {
      passed: allPassed,
      distribution,
      targets
    };
  }

  /**
   * Get number of starters needed league-wide for each position
   */
  private getStarterCounts(): Record<string, number> {
    const teams = this.leagueSettings.teams;
    return {
      QB: teams * this.leagueSettings.starters.QB,
      RB: teams * (this.leagueSettings.starters.RB + this.leagueSettings.starters.FLEX * 0.4),
      WR: teams * (this.leagueSettings.starters.WR + this.leagueSettings.starters.FLEX * 0.5),
      TE: teams * (this.leagueSettings.starters.TE + this.leagueSettings.starters.FLEX * 0.1),
      DST: teams * this.leagueSettings.starters.DST,
      K: teams * this.leagueSettings.starters.K
    };
  }

  /**
   * Get league settings
   */
  public getLeagueSettings(): LeagueSettings {
    return this.leagueSettings;
  }

  /**
   * Process all players and return complete valuations
   */
  public processAllPlayers(players: PlayerData[]): {
    valuations: ValuationResult[];
    validation: {
      budgetConservation: ReturnType<typeof this.validateBudgetConservation>;
      positionalDistribution: ReturnType<typeof this.validatePositionalDistribution>;
    };
    summary: {
      totalPlayers: number;
      byPosition: Record<string, number>;
      averageValues: Record<string, number>;
      topValuesByPosition: Record<string, { name: string; value: number }>;
    };
  } {
    logger.info(`Processing ${players.length} players with calibrated valuation model V2.1`);
    
    const valuations = players.map(player => 
      this.calculateAuctionValue(player, players)
    );
    
    valuations.sort((a, b) => b.auctionValue - a.auctionValue);
    
    // V2.2: Apply budget scaling if needed
    const top192sum = valuations.slice(0, 192)
      .reduce((sum, v) => sum + v.auctionValue, 0);
    
    if (top192sum > 2520) { // If exceeding 105% of $2400
      const scaleFactor = 2400 / top192sum;
      logger.info(`V2.2 Budget scaling applied: ${scaleFactor.toFixed(3)}x`);
      
      valuations.forEach(v => {
        const original = v.auctionValue;
        v.auctionValue = Math.max(1, Math.round(v.auctionValue * scaleFactor));
        v.maxBid = Math.max(1, Math.round(v.maxBid * scaleFactor));
        v.targetBid = v.auctionValue;
        v.minBid = Math.max(1, Math.round(v.minBid * scaleFactor));
        
        if (original > 20) {
          logger.debug(`Scaled ${v.playerName}: $${original} → $${v.auctionValue}`);
        }
      });
    }
    
    const budgetConservation = this.validateBudgetConservation(valuations);
    const positionalDistribution = this.validatePositionalDistribution(valuations);
    
    const byPosition: Record<string, number> = {};
    const totalsByPosition: Record<string, number> = {};
    const topValuesByPosition: Record<string, { name: string; value: number }> = {};
    
    valuations.forEach(v => {
      byPosition[v.position] = (byPosition[v.position] || 0) + 1;
      totalsByPosition[v.position] = (totalsByPosition[v.position] || 0) + v.auctionValue;
      
      if (!topValuesByPosition[v.position] || v.auctionValue > topValuesByPosition[v.position].value) {
        topValuesByPosition[v.position] = {
          name: v.playerName,
          value: v.auctionValue
        };
      }
    });
    
    const averageValues: Record<string, number> = {};
    Object.keys(byPosition).forEach(position => {
      averageValues[position] = totalsByPosition[position] / byPosition[position];
    });
    
    logger.info('Valuation processing complete V2.2', {
      totalPlayers: players.length,
      budgetValid: budgetConservation.passed,
      budgetPercentage: budgetConservation.percentageOfBudget.toFixed(1),
      distributionValid: positionalDistribution.passed
    });
    
    return {
      valuations,
      validation: {
        budgetConservation,
        positionalDistribution
      },
      summary: {
        totalPlayers: players.length,
        byPosition,
        averageValues,
        topValuesByPosition
      }
    };
  }
}

// Export singleton instance - V2.2 PRODUCTION
export const calibratedValuationModel = new CalibratedValuationModel();