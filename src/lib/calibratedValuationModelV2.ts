/**
 * DEPRECATED: Calibrated Valuation Model V2.0
 * 
 * DO NOT USE - This version fails invariant tests
 * 
 * Problems with this version:
 * - Overly aggressive tier multipliers (RB elite: 1.25x, WR elite: 1.20x)
 * - Breaks position distribution constraints (WRs exceed 40%)
 * - Creates unreasonable values (RBs >$80)
 * 
 * Use calibratedValuationModel.ts (V2.1 PRODUCTION) instead
 * 
 * @deprecated Since 2025-08-28 - Use V2.1 in calibratedValuationModel.ts
 */

import { logger } from './utils/logger';
import { CalibratedValuationModel, type PlayerData, type ValuationResult } from './calibratedValuationModel';

export class CalibratedValuationModelV2 extends CalibratedValuationModel {
  
  /**
   * Enhanced market adjustments based on analysis of actual auction data
   * These corrections address the systematic biases found in the original model
   */
  private readonly enhancedMarketAdjustments = {
    QB: {
      elite: 1.0,    // Ranks 1-3: No change (already properly valued)
      tier1: 0.95,   // Ranks 4-8: Slight reduction
      tier2: 0.90,   // Ranks 9-12: More reduction
      tier3: 0.85,   // Ranks 13+: Match streaming reality
    },
    RB: {
      elite: 1.25,   // Ranks 1-5: Premium for true bellcows (+25%)
      tier1: 1.15,   // Ranks 6-12: Still valuable (+15%)
      tier2: 0.85,   // Ranks 13-24: MAJOR CORRECTION (-15%)
      tier3: 0.60,   // Ranks 25-36: Deep reduction (-40%)
      tier4: 0.40,   // Ranks 37+: Handcuff/bench value (-60%)
    },
    WR: {
      elite: 1.20,   // Ranks 1-5: Elite WRs undervalued (+20%)
      tier1: 1.10,   // Ranks 6-12: Good WRs need boost (+10%)
      tier2: 1.00,   // Ranks 13-24: Properly valued
      tier3: 0.85,   // Ranks 25-36: Slight reduction
      tier4: 0.70,   // Ranks 37+: Bench/bye week fills
    },
    TE: {
      elite: 1.30,   // Ranks 1-2: Kelce/Andrews premium (+30%)
      tier1: 1.10,   // Ranks 3-6: Good TEs (+10%)
      tier2: 0.70,   // Ranks 7-12: Streaming range (-30%)
      tier3: 0.40,   // Ranks 13+: Replacement level (-60%)
    },
    DST: {
      all: 0.35,     // All DSTs heavily discounted (-65%)
    },
    K: {
      all: 0.30,     // All kickers heavily discounted (-70%)
    }
  };

  /**
   * Override the base calculateAuctionValue to include market corrections
   */
  public calculateAuctionValue(
    player: PlayerData,
    allPlayers: PlayerData[]
  ): ValuationResult {
    // Get base calculation from parent
    const baseResult = super.calculateAuctionValue(player, allPlayers);
    
    // Apply enhanced market corrections
    const correctedValue = this.applyMarketCorrections(baseResult, player, allPlayers);
    
    // If we have actual market data, use it for validation
    const marketData = this.getMarketData(player);
    if (marketData && marketData.auctionValue) {
      // Blend our calculation with market consensus
      const blendedValue = this.blendWithMarket(correctedValue.auctionValue, marketData.auctionValue);
      correctedValue.auctionValue = blendedValue;
      correctedValue.targetBid = blendedValue;
      correctedValue.maxBid = Math.max(1, Math.round(blendedValue * 1.15));
      correctedValue.minBid = Math.max(1, Math.round(blendedValue * 0.85));
    }
    
    return correctedValue;
  }

  /**
   * Apply tier-based market corrections to address systematic biases
   */
  private applyMarketCorrections(
    result: ValuationResult,
    player: PlayerData,
    allPlayers: PlayerData[]
  ): ValuationResult {
    const position = player.position;
    const rank = result.positionRank;
    
    // Get the appropriate correction factor
    let correctionFactor = 1.0;
    
    if (position === 'QB') {
      if (rank <= 3) correctionFactor = this.enhancedMarketAdjustments.QB.elite;
      else if (rank <= 8) correctionFactor = this.enhancedMarketAdjustments.QB.tier1;
      else if (rank <= 12) correctionFactor = this.enhancedMarketAdjustments.QB.tier2;
      else correctionFactor = this.enhancedMarketAdjustments.QB.tier3;
    } else if (position === 'RB') {
      if (rank <= 5) correctionFactor = this.enhancedMarketAdjustments.RB.elite;
      else if (rank <= 12) correctionFactor = this.enhancedMarketAdjustments.RB.tier1;
      else if (rank <= 24) correctionFactor = this.enhancedMarketAdjustments.RB.tier2;
      else if (rank <= 36) correctionFactor = this.enhancedMarketAdjustments.RB.tier3;
      else correctionFactor = this.enhancedMarketAdjustments.RB.tier4;
    } else if (position === 'WR') {
      if (rank <= 5) correctionFactor = this.enhancedMarketAdjustments.WR.elite;
      else if (rank <= 12) correctionFactor = this.enhancedMarketAdjustments.WR.tier1;
      else if (rank <= 24) correctionFactor = this.enhancedMarketAdjustments.WR.tier2;
      else if (rank <= 36) correctionFactor = this.enhancedMarketAdjustments.WR.tier3;
      else correctionFactor = this.enhancedMarketAdjustments.WR.tier4;
    } else if (position === 'TE') {
      if (rank <= 2) correctionFactor = this.enhancedMarketAdjustments.TE.elite;
      else if (rank <= 6) correctionFactor = this.enhancedMarketAdjustments.TE.tier1;
      else if (rank <= 12) correctionFactor = this.enhancedMarketAdjustments.TE.tier2;
      else correctionFactor = this.enhancedMarketAdjustments.TE.tier3;
    } else if (position === 'DST') {
      correctionFactor = this.enhancedMarketAdjustments.DST.all;
    } else if (position === 'K') {
      correctionFactor = this.enhancedMarketAdjustments.K.all;
    }
    
    // Apply the correction
    const correctedValue = Math.max(1, Math.round(result.auctionValue * correctionFactor));
    
    // Log significant corrections for transparency
    if (Math.abs(correctionFactor - 1.0) > 0.2) {
      logger.debug(`Market correction for ${player.name} (${position}${rank}): ${(correctionFactor * 100).toFixed(0)}% → $${correctedValue}`);
    }
    
    return {
      ...result,
      auctionValue: correctedValue,
      targetBid: correctedValue,
      maxBid: Math.max(1, Math.round(correctedValue * 1.15)),
      minBid: Math.max(1, Math.round(correctedValue * 0.85)),
      marketAdjustment: result.marketAdjustment * correctionFactor
    };
  }

  /**
   * Get market data for a player (from ADP integration)
   */
  private getMarketData(player: PlayerData): { auctionValue?: number; adp?: number } | null {
    // This would be populated from the integrated ADP data
    // For now, return null to use pure calculation
    // In production, this would read from player.marketValue or player.auctionValue
    
    if ((player as any).marketValue) {
      return {
        auctionValue: (player as any).marketValue,
        adp: (player as any).adp
      };
    }
    
    return null;
  }

  /**
   * Blend calculated value with market consensus
   * This prevents extreme outliers while maintaining our edge
   */
  private blendWithMarket(calculatedValue: number, marketValue: number): number {
    // If values are close (within 20%), trust our calculation
    const difference = Math.abs(calculatedValue - marketValue) / marketValue;
    if (difference < 0.2) {
      return calculatedValue;
    }
    
    // For larger differences, blend towards market
    // 70% our calculation, 30% market consensus
    const blended = calculatedValue * 0.7 + marketValue * 0.3;
    
    logger.debug(`Value blending: Calc=$${calculatedValue}, Market=$${marketValue}, Blended=$${Math.round(blended)}`);
    
    return Math.max(1, Math.round(blended));
  }

  /**
   * Special handling for specific players with known issues
   */
  private applyPlayerSpecificCorrections(
    result: ValuationResult,
    player: PlayerData
  ): ValuationResult {
    const corrections: { [key: string]: { points?: number; value?: number } } = {
      'Breece Hall': { points: 235, value: 28 },
      'Tyreek Hill': { points: 295, value: 45 },
      'CeeDee Lamb': { value: 52 },
      'Travis Kelce': { points: 190, value: 25 },
    };
    
    const correction = corrections[player.name];
    if (correction) {
      logger.info(`Applying specific correction for ${player.name}`);
      
      if (correction.points && player.projectedPoints < correction.points) {
        player.projectedPoints = correction.points;
        // Recalculate with new points
        return super.calculateAuctionValue(player, []);
      }
      
      if (correction.value) {
        result.auctionValue = correction.value;
        result.targetBid = correction.value;
        result.maxBid = Math.max(1, Math.round(correction.value * 1.15));
        result.minBid = Math.max(1, Math.round(correction.value * 0.85));
      }
    }
    
    return result;
  }
}

// Export singleton instance
export const calibratedValuationModelV2 = new CalibratedValuationModelV2();