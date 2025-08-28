/**
 * Dynamic Valuation Service
 * Adjusts player values in real-time based on draft conditions
 * Can be toggled between static and dynamic modes
 */

import { logger } from './utils/logger';
import type { ValuationResult } from './calibratedValuationService';

export interface DraftContext {
  totalBudget: number;           // Total league budget
  moneySpent: number;             // Money already spent
  moneyRemaining: number;         // Money left in the draft
  playersPickedCount: number;     // Number of players drafted
  playersRemainingCount: number;  // Number of roster spots remaining
  positionsFilled: Record<string, number>; // How many of each position drafted
  positionsNeeded: Record<string, number>; // How many of each position still needed
  recentPicks: Array<{           // Last 5-10 picks for trend analysis
    playerId: string;
    actualPrice: number;
    expectedPrice: number;
    position: string;
  }>;
  teamBudgets: Map<string, number>; // Remaining budget per team
}

export interface DynamicAdjustmentFactors {
  inflationMultiplier: number;      // Base inflation adjustment (money remaining / value remaining)
  positionScarcityMultiplier: Record<string, number>; // Position-specific scarcity
  tierPremiumMultiplier: number;    // Premium for last players in a tier
  trendAdjustment: number;          // Based on recent picks (hot/cold market)
  budgetPressureMultiplier: number; // Adjustment based on teams running low on budget
  rosterNeedMultiplier: Record<string, number>; // Based on league-wide roster needs
}

export class DynamicValuationService {
  private static instance: DynamicValuationService;
  private isDynamicMode: boolean = true; // Toggle for dynamic adjustments
  private baseValuations: ValuationResult[] = []; // Original static valuations
  private adjustmentHistory: Array<{
    timestamp: number;
    factors: DynamicAdjustmentFactors;
    context: DraftContext;
  }> = [];
  
  private constructor() {}
  
  public static getInstance(): DynamicValuationService {
    if (!DynamicValuationService.instance) {
      DynamicValuationService.instance = new DynamicValuationService();
    }
    return DynamicValuationService.instance;
  }
  
  /**
   * Toggle between static and dynamic valuation modes
   */
  public setDynamicMode(enabled: boolean): void {
    this.isDynamicMode = enabled;
    logger.info(`Dynamic valuation mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get current mode status
   */
  public isDynamic(): boolean {
    return this.isDynamicMode;
  }
  
  /**
   * Set base valuations (static values)
   */
  public setBaseValuations(valuations: ValuationResult[]): void {
    this.baseValuations = [...valuations];
    logger.info(`Base valuations set for ${valuations.length} players`);
  }
  
  /**
   * Calculate dynamic adjustments based on draft context
   */
  public calculateAdjustments(
    context: DraftContext,
    availablePlayers: ValuationResult[]
  ): DynamicAdjustmentFactors {
    
    // 1. Calculate base inflation multiplier
    // At draft start, we should use exactly the budget amount
    let inflationMultiplier = 1.0;
    
    if (context.playersPickedCount === 0) {
      // At draft start, no inflation adjustment needed
      inflationMultiplier = 1.0;
      console.log('[Inflation] Draft start - using 1.0 multiplier');
    } else {
      // After draft starts, calculate based on remaining values
      const totalValueRemaining = availablePlayers
        .slice(0, context.playersRemainingCount)
        .reduce((sum, p) => sum + p.auctionValue, 0);
      
      inflationMultiplier = totalValueRemaining > 0 
        ? context.moneyRemaining / totalValueRemaining 
        : 1.0;
        
      console.log('[Inflation Calculation]', {
        availablePlayersCount: availablePlayers.length,
        playersRemainingCount: context.playersRemainingCount,
        totalValueRemaining,
        moneyRemaining: context.moneyRemaining,
        calculatedMultiplier: inflationMultiplier
      });
    }
    
    // 2. Calculate position scarcity multipliers
    const positionScarcityMultiplier = this.calculatePositionScarcity(
      context,
      availablePlayers
    );
    
    // 3. Calculate tier premium (last players in tier get boost)
    const tierPremiumMultiplier = this.calculateTierPremium(
      context,
      availablePlayers
    );
    
    // 4. Calculate trend adjustment based on recent picks
    const trendAdjustment = this.calculateTrendAdjustment(context.recentPicks);
    
    // 5. Calculate budget pressure (teams running low on money)
    const budgetPressureMultiplier = this.calculateBudgetPressure(
      context.teamBudgets
    );
    
    // 6. Calculate roster need multipliers
    const rosterNeedMultiplier = this.calculateRosterNeedMultipliers(
      context
    );
    
    const factors: DynamicAdjustmentFactors = {
      inflationMultiplier,
      positionScarcityMultiplier,
      tierPremiumMultiplier,
      trendAdjustment,
      budgetPressureMultiplier,
      rosterNeedMultiplier
    };
    
    // Debug logging when no players drafted
    if (context.playersPickedCount === 0) {
      console.log('[DynamicValuationService] Factors at draft start:', {
        inflationMultiplier,
        positionScarcityMultiplier,
        tierPremiumMultiplier,
        trendAdjustment,
        budgetPressureMultiplier,
        rosterNeedMultiplier,
        moneyRemaining: context.moneyRemaining,
        playersRemainingCount: context.playersRemainingCount
      });
    }
    
    // Store adjustment history
    this.adjustmentHistory.push({
      timestamp: Date.now(),
      factors,
      context
    });
    
    return factors;
  }
  
  /**
   * Apply dynamic adjustments to player valuations
   */
  public getDynamicValuations(
    context: DraftContext,
    draftedPlayerIds: Set<string>
  ): ValuationResult[] {
    console.log('[getDynamicValuations called]', {
      isDynamicMode: this.isDynamicMode,
      playersPickedCount: context.playersPickedCount,
      moneyRemaining: context.moneyRemaining,
      baseValuationsCount: this.baseValuations.length
    });
    
    // If in static mode, return ALL base valuations unchanged
    if (!this.isDynamicMode) {
      logger.info('Returning static valuations');
      return this.baseValuations;
    }
    
    // Get available players for calculating adjustments
    const availablePlayers = this.baseValuations.filter(
      v => !draftedPlayerIds.has(v.playerId)
    );
    
    // Calculate adjustment factors based on available players
    const factors = this.calculateAdjustments(context, availablePlayers);
    
    console.log('[DynamicValuationService] Adjustments calculated', {
      inflationMultiplier: factors.inflationMultiplier.toFixed(2),
      playersRemaining: availablePlayers.length,
      moneyRemaining: context.moneyRemaining,
      draftedCount: draftedPlayerIds.size,
      allFactors: factors
    });
    
    // Apply adjustments to ALL players (both drafted and undrafted)
    // This ensures consistency in the display
    return this.baseValuations.map(player => {
      // If player is drafted, return original values
      if (draftedPlayerIds.has(player.playerId)) {
        return player;
      }
      
      // Apply dynamic adjustments to available players
      const adjustedValue = this.applyAdjustments(player, factors, context);
      
      // Log what we're changing for first few players
      if (player.playerName === 'Bijan Robinson' || player.playerName === 'CeeDee Lamb' || player.playerName === 'Christian McCaffrey') {
        console.log(`[Dynamic Adjustment for ${player.playerName}]`, {
          originalValue: player.value,
          originalIntrinsicValue: player.intrinsicValue,
          originalMarketValue: player.marketValue,
          adjustedValue: adjustedValue.value,
          factors: adjustedValue.factors,
          inflationMultiplier: factors.inflationMultiplier
        });
      }
      
      // When no adjustments are made (multiplier = 1.0), keep original values
      const noAdjustments = context.playersPickedCount === 0 && 
                           adjustedValue.value === (player.value || player.auctionValue);
      
      const updatedPlayer = {
        ...player,
        // Update value fields based on whether adjustments were made
        auctionValue: adjustedValue.value,
        value: adjustedValue.value, // Max Bid column
        // Keep intrinsicValue unchanged if no adjustments, otherwise update
        intrinsicValue: noAdjustments ? player.intrinsicValue : adjustedValue.value,
        // Keep marketValue as original for comparison
        // marketValue: player.marketValue, // Market column - keep original
        // Update edge based on new value vs market
        edge: adjustedValue.value - (player.marketValue || 0),
        dynamicValue: adjustedValue.value,
        adjustmentFactors: adjustedValue.factors,
        // Update bid ranges
        maxBid: Math.max(1, Math.round(adjustedValue.value * 1.15)),
        targetBid: Math.max(1, Math.round(adjustedValue.value)),
        minBid: Math.max(1, Math.round(adjustedValue.value * 0.85))
      };
      
      // Extra logging to confirm values are set
      if (player.playerName === 'Bijan Robinson') {
        console.log('[Updated Bijan Object]', {
          value: updatedPlayer.value,
          intrinsicValue: updatedPlayer.intrinsicValue,
          marketValue: updatedPlayer.marketValue,
          edge: updatedPlayer.edge,
          originalEdge: player.edge,
          dynamicValue: updatedPlayer.dynamicValue
        });
      }
      
      return updatedPlayer;
    });
  }
  
  /**
   * Apply all adjustment factors to a single player
   */
  private applyAdjustments(
    player: ValuationResult,
    factors: DynamicAdjustmentFactors,
    context: DraftContext
  ): { value: number; factors: string[] } {
    // Use 'value' field as the base, not 'auctionValue'
    let value = player.value || player.auctionValue;
    const originalValue = value;
    const appliedFactors: string[] = [];
    
    // Debug log for first player
    if (player.playerName === 'Bijan Robinson' && context.playersPickedCount === 0) {
      console.log('[applyAdjustments START for Bijan]', {
        originalValue,
        inflationMultiplier: factors.inflationMultiplier,
        allFactors: factors
      });
    }
    
    // 1. Apply base inflation
    value *= factors.inflationMultiplier;
    if (factors.inflationMultiplier !== 1.0) {
      appliedFactors.push(`Inflation: ${(factors.inflationMultiplier * 100 - 100).toFixed(1)}%`);
    }
    
    // 2. Apply position scarcity
    const posScarcity = factors.positionScarcityMultiplier[player.position] || 1.0;
    if (posScarcity !== 1.0) {
      value *= posScarcity;
      appliedFactors.push(`${player.position} Scarcity: ${(posScarcity * 100 - 100).toFixed(1)}%`);
    }
    
    // 3. Apply tier premium if player is in top tier
    if (player.tier === 'elite' || player.tier === 'tier1') {
      // For simplicity, always apply tier premium to elite/tier1 players
      // In a more sophisticated system, we'd check remaining players in tier
      value *= factors.tierPremiumMultiplier;
      if (factors.tierPremiumMultiplier !== 1.0) {
        appliedFactors.push(`Tier Premium: ${(factors.tierPremiumMultiplier * 100 - 100).toFixed(1)}%`);
      }
    }
    
    // 4. Apply trend adjustment
    if (Math.abs(factors.trendAdjustment) > 0.02) {
      value *= (1 + factors.trendAdjustment);
      appliedFactors.push(`Market Trend: ${(factors.trendAdjustment * 100).toFixed(1)}%`);
    }
    
    // 5. Apply budget pressure (reduce values if many teams are low on budget)
    if (factors.budgetPressureMultiplier !== 1.0) {
      value *= factors.budgetPressureMultiplier;
      appliedFactors.push(`Budget Pressure: ${(factors.budgetPressureMultiplier * 100 - 100).toFixed(1)}%`);
    }
    
    // 6. Apply roster need multiplier
    const rosterNeed = factors.rosterNeedMultiplier[player.position] || 1.0;
    if (rosterNeed !== 1.0) {
      value *= rosterNeed;
      appliedFactors.push(`Roster Need: ${(rosterNeed * 100 - 100).toFixed(1)}%`);
    }
    
    // Ensure minimum value of $1
    value = Math.max(1, Math.round(value));
    
    return { value, factors: appliedFactors };
  }
  
  /**
   * Calculate position scarcity multipliers
   */
  private calculatePositionScarcity(
    context: DraftContext,
    availablePlayers: ValuationResult[]
  ): Record<string, number> {
    const multipliers: Record<string, number> = {};
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    
    // No scarcity at draft start
    if (context.playersPickedCount === 0) {
      positions.forEach(pos => {
        multipliers[pos] = 1.0;
      });
      return multipliers;
    }
    
    positions.forEach(pos => {
      const available = availablePlayers.filter(p => p.position === pos);
      const eliteAvailable = available.filter(
        p => p.tier === 'elite' || p.tier === 'tier1'
      );
      const needed = context.positionsNeeded[pos] || 0;
      
      // Calculate scarcity based on elite players remaining vs need
      if (needed > 0 && eliteAvailable.length > 0) {
        const scarcityRatio = eliteAvailable.length / needed;
        
        if (scarcityRatio < 0.5) {
          // Very scarce - significant premium
          multipliers[pos] = 1.25;
        } else if (scarcityRatio < 1.0) {
          // Scarce - moderate premium
          multipliers[pos] = 1.15;
        } else if (scarcityRatio < 2.0) {
          // Balanced
          multipliers[pos] = 1.05;
        } else {
          // Abundant - slight discount
          multipliers[pos] = 0.95;
        }
      } else {
        multipliers[pos] = 1.0;
      }
    });
    
    return multipliers;
  }
  
  /**
   * Calculate tier premium for last players in tier
   */
  private calculateTierPremium(
    context: DraftContext,
    availablePlayers: ValuationResult[]
  ): number {
    // Only apply tier premium after draft has started
    if (context.playersPickedCount === 0) {
      return 1.0;
    }
    
    // Count elite/tier1 players remaining
    const elitePlayers = availablePlayers.filter(
      p => p.tier === 'elite' || p.tier === 'tier1'
    );
    
    if (elitePlayers.length <= 5) {
      return 1.20; // 20% premium for last elite players
    } else if (elitePlayers.length <= 10) {
      return 1.10; // 10% premium
    }
    
    return 1.0;
  }
  
  /**
   * Calculate trend adjustment based on recent picks
   */
  private calculateTrendAdjustment(
    recentPicks: DraftContext['recentPicks']
  ): number {
    if (recentPicks.length < 3) return 0;
    
    // Calculate average over/under payment
    const avgDiff = recentPicks.reduce((sum, pick) => {
      const diff = (pick.actualPrice - pick.expectedPrice) / pick.expectedPrice;
      return sum + diff;
    }, 0) / recentPicks.length;
    
    // Cap adjustment at +/- 15%
    return Math.max(-0.15, Math.min(0.15, avgDiff));
  }
  
  /**
   * Calculate budget pressure multiplier
   */
  private calculateBudgetPressure(
    teamBudgets: Map<string, number>
  ): number {
    const budgetArray = Array.from(teamBudgets.values());
    const avgBudget = budgetArray.reduce((a, b) => a + b, 0) / budgetArray.length;
    
    // At draft start, all teams have full budget - no adjustment
    const maxBudget = 200;
    if (avgBudget === maxBudget) {
      return 1.0;
    }
    
    // Count teams with very low budgets
    const lowBudgetTeams = budgetArray.filter(b => b < 20).length;
    const percentLow = lowBudgetTeams / budgetArray.length;
    
    if (percentLow > 0.5) {
      // Many teams low on budget - values decrease
      return 0.85;
    } else if (percentLow > 0.25) {
      return 0.93;
    } else if (avgBudget > 100) {
      // Lots of money left - values increase slightly
      return 1.05;
    }
    
    return 1.0;
  }
  
  /**
   * Calculate roster need multipliers
   */
  private calculateRosterNeedMultipliers(
    context: DraftContext
  ): Record<string, number> {
    const multipliers: Record<string, number> = {};
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    
    // No roster need adjustments at draft start
    if (context.playersPickedCount === 0) {
      positions.forEach(pos => {
        multipliers[pos] = 1.0;
      });
      return multipliers;
    }
    
    positions.forEach(pos => {
      const filled = context.positionsFilled[pos] || 0;
      const needed = context.positionsNeeded[pos] || 0;
      const totalNeed = filled + needed;
      
      if (totalNeed > 0) {
        const fillRate = filled / totalNeed;
        
        if (fillRate < 0.3 && needed > 0) {
          // Position heavily needed league-wide
          multipliers[pos] = 1.10;
        } else if (fillRate > 0.7) {
          // Position mostly filled
          multipliers[pos] = 0.90;
        } else {
          multipliers[pos] = 1.0;
        }
      } else {
        multipliers[pos] = 1.0;
      }
    });
    
    return multipliers;
  }
  
  /**
   * Get adjustment history for debugging/analysis
   */
  public getAdjustmentHistory(): typeof this.adjustmentHistory {
    return this.adjustmentHistory;
  }
  
  /**
   * Clear adjustment history
   */
  public clearHistory(): void {
    this.adjustmentHistory = [];
  }
}

export const dynamicValuationService = DynamicValuationService.getInstance();