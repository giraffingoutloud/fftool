/**
 * Real-Time Bid Advisor Service
 * Provides dynamic bidding recommendations during auction drafts
 */

import type { ValuationResult } from './calibratedValuationService';
import type { DraftPick, Team } from '@/store/draftStore';

export interface BidRecommendation {
  // Core recommendation
  action: 'strong-buy' | 'consider' | 'avoid' | 'pass';
  maxBid: number;
  confidence: number; // 0-100
  
  // Detailed scoring
  valueScore: number; // 0-100 - How good is the price vs intrinsic value
  needScore: number;  // 0-100 - How much do you need this player
  scarcityScore: number; // 0-100 - How scarce is this position/tier
  budgetScore: number; // 0-100 - How well does this fit your budget
  
  // Context and reasoning
  primaryReason: string;
  warnings: string[];
  opportunities: string[];
  
  // Market dynamics
  marketInflation: number; // Current market inflation percentage
  expectedFinalPrice: number; // Predicted final bid price
  likelyCompetitors: string[]; // Teams likely to bid
  competitorAnalysis?: CompetitorInsight[]; // Detailed competitor info
  
  // Strategic advice
  nominationStrategy: 'nominate-early' | 'nominate-late' | 'avoid-nominating';
  biddingStrategy: 'aggressive' | 'patient' | 'price-enforce' | 'avoid';
  alternativePlayers: ValuationResult[]; // Similar players to consider
  
  // Advanced features
  byeWeekImpact?: ByeWeekAnalysis;
  teamStackBonus?: TeamStackInfo;
  smartAlternatives?: SmartAlternative[];
}

export interface CompetitorInsight {
  teamName: string;
  remainingBudget: number;
  needsPosition: boolean;
  maxPossibleBid: number;
  aggressionLevel: 'high' | 'medium' | 'low';
}

export interface ByeWeekAnalysis {
  playerByeWeek: number;
  currentByeWeekCounts: Record<number, number>;
  wouldCreateStack: boolean;
  affectedPositions: string[];
  warning?: string;
}

export interface TeamStackInfo {
  team: string;
  existingPlayers: string[];
  stackType: 'QB-WR' | 'QB-TE' | 'RB-DEF' | 'multiple' | 'none';
  synergyBonus: number; // Percentage bonus to max bid
  warning?: string;
}

export interface SmartAlternative {
  player: ValuationResult;
  reasoning: string;
  targetPrice: number;
  availability: 'immediate' | 'likely-available' | 'risky';
}

export interface DraftContext {
  myTeam: Team;
  allTeams: Team[];
  draftHistory: DraftPick[];
  availablePlayers: ValuationResult[];
  currentBid: number;
  totalBudget: number;
  rosterRequirements: RosterRequirements;
}

export interface RosterRequirements {
  QB: { min: number; max: number; optimal: number };
  RB: { min: number; max: number; optimal: number };
  WR: { min: number; max: number; optimal: number };
  TE: { min: number; max: number; optimal: number };
  DST: { min: number; max: number; optimal: number };
  K: { min: number; max: number; optimal: number };
  FLEX: { count: number; eligiblePositions: string[] };
  BENCH: number;
}

// Standard 12-team PPR roster requirements
const DEFAULT_ROSTER_REQUIREMENTS: RosterRequirements = {
  QB: { min: 1, max: 2, optimal: 1 },
  RB: { min: 2, max: 6, optimal: 4 },
  WR: { min: 2, max: 6, optimal: 4 },
  TE: { min: 1, max: 3, optimal: 2 },
  DST: { min: 1, max: 2, optimal: 1 },
  K: { min: 1, max: 2, optimal: 1 },
  FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
  BENCH: 6
};

class BidAdvisorService {
  private rosterRequirements: RosterRequirements;

  constructor() {
    this.rosterRequirements = DEFAULT_ROSTER_REQUIREMENTS;
  }

  /**
   * Generate comprehensive bid recommendation for a player
   */
  getRecommendation(
    player: ValuationResult,
    context: DraftContext,
    currentBid: number = 0
  ): BidRecommendation {
    // Detect draft patterns
    const isPositionRun = this.detectPositionRun(player.position, context);
    const panicLevel = this.calculatePanicLevel(player.position, context);
    const draftStage = this.determineDraftStage(context);
    
    // Calculate all scoring components
    const valueScore = this.calculateValueScore(player, currentBid, context);
    const needScore = this.calculateNeedScore(player, context);
    const scarcityScore = this.calculateScarcityScore(player, context);
    const budgetScore = this.calculateBudgetScore(player, currentBid, context);
    const marketInflation = this.calculateMarketInflation(context);
    
    // Calculate max profitable bid with dynamic adjustments
    const maxBid = this.calculateMaxBid(player, context, {
      valueScore,
      needScore,
      scarcityScore,
      budgetScore,
      marketInflation
    }, { isPositionRun, panicLevel, draftStage });

    // Determine action with holistic roster construction
    const action = this.determineAction(currentBid, maxBid, {
      valueScore,
      needScore,
      scarcityScore,
      budgetScore
    }, player, context);

    // Calculate confidence
    const confidence = this.calculateConfidence({
      valueScore,
      needScore,
      scarcityScore,
      budgetScore
    });

    // Generate strategic insights
    const primaryReason = this.generatePrimaryReason(player, action, {
      valueScore,
      needScore,
      scarcityScore,
      budgetScore
    }, context);

    const warnings = this.generateWarnings(player, context, currentBid);
    const opportunities = this.generateOpportunities(player, context, currentBid);

    // Predict competition
    const likelyCompetitors = this.predictCompetitors(player, context);
    const expectedFinalPrice = this.predictFinalPrice(player, context, marketInflation);

    // Strategy recommendations
    const nominationStrategy = this.determineNominationStrategy(player, context);
    const biddingStrategy = this.determineBiddingStrategy(player, context, action);

    // Find alternatives
    const alternativePlayers = this.findAlternatives(player, context);
    
    // Advanced analysis
    const competitorAnalysis = this.analyzeCompetitors(player, context);
    const byeWeekImpact = this.analyzeByeWeekImpact(player, context);
    const teamStackBonus = this.analyzeTeamStack(player, context);
    const smartAlternatives = this.generateSmartAlternatives(player, context, action);

    return {
      action,
      maxBid,
      confidence,
      valueScore,
      needScore,
      scarcityScore,
      budgetScore,
      primaryReason,
      warnings,
      opportunities,
      marketInflation,
      expectedFinalPrice,
      likelyCompetitors,
      competitorAnalysis,
      nominationStrategy,
      biddingStrategy,
      alternativePlayers,
      byeWeekImpact,
      teamStackBonus,
      smartAlternatives
    };
  }

  /**
   * Calculate value score (0-100)
   * How good is the current price vs the player's intrinsic value?
   */
  private calculateValueScore(
    player: ValuationResult,
    currentBid: number,
    context: DraftContext
  ): number {
    // Use actual valuation data from the player
    const intrinsicValue = player.auctionValue || player.value || 1;
    const marketPrice = player.marketPrice || player.marketValue || intrinsicValue;
    
    if (currentBid === 0) {
      // No bid yet, use a starting bid
      currentBid = Math.max(1, Math.floor(marketPrice * 0.5)); // Assume bidding starts at 50% of market
    }

    const discount = intrinsicValue - currentBid;
    const discountPercent = (discount / Math.max(1, intrinsicValue)) * 100;

    // Scale to 0-100 score
    // >30% discount = 100, 0% = 50, -30% overpay = 0
    const score = Math.max(0, Math.min(100, 50 + (discountPercent * 1.67)));
    
    return Math.round(score);
  }

  /**
   * Calculate need score (0-100)
   * How much does your roster need this player?
   */
  private calculateNeedScore(
    player: ValuationResult,
    context: DraftContext
  ): number {
    const position = player.position;
    const myRoster = context.myTeam.players || [];
    
    // Count current position
    const currentCount = myRoster.filter(p => p.position === position).length;
    const requirements = this.rosterRequirements[position as keyof RosterRequirements];
    
    if (!requirements || typeof requirements === 'number') {
      return 50; // Default for unknown positions
    }

    const posReq = requirements as { min: number; max: number; optimal: number };

    // Calculate base need
    let score = 50;
    
    if (currentCount < posReq.min) {
      // Critical need
      score = 100;
    } else if (currentCount < posReq.optimal) {
      // Moderate need
      score = 75 - (currentCount - posReq.min) * 10;
    } else if (currentCount < posReq.max) {
      // Low need
      score = 40 - (currentCount - posReq.optimal) * 10;
    } else {
      // No need
      score = 10;
    }

    // Adjust for tier - using actual tier data
    if (player.tier === 'elite' || player.tier === 'tier1') {
      score = Math.min(100, score + 20); // Always consider elite players
    } else if (player.tier === 'tier2') {
      score = Math.min(100, score + 10); // Boost for tier 2
    }

    // Adjust for flex eligibility
    if (this.isFlexEligible(position) && currentCount >= posReq.optimal) {
      score = Math.max(score, 40); // Still valuable for flex
    }

    return Math.round(score);
  }

  /**
   * Calculate scarcity score (0-100)
   * How scarce are players of this caliber at this position?
   */
  private calculateScarcityScore(
    player: ValuationResult,
    context: DraftContext
  ): number {
    const position = player.position;
    const tier = player.tier;
    
    // Find remaining players in same position and tier
    const remainingInTier = context.availablePlayers.filter(
      p => p.position === position && p.tier === tier
    ).length;

    // Find remaining starters at position
    const remainingStarters = context.availablePlayers.filter(
      p => p.position === position && p.projectedPoints > 0
    ).length;

    // Calculate tier scarcity
    let tierScore = 100;
    if (remainingInTier > 5) {
      tierScore = 30;
    } else if (remainingInTier > 3) {
      tierScore = 50;
    } else if (remainingInTier > 1) {
      tierScore = 75;
    } else if (remainingInTier === 1) {
      tierScore = 100; // Last one in tier!
    }

    // Calculate position scarcity
    const teamCount = context.allTeams.length;
    const positionNeeds = this.calculateTotalPositionNeeds(position, context);
    const scarcityRatio = remainingStarters / positionNeeds;

    let positionScore = 50;
    if (scarcityRatio < 0.5) {
      positionScore = 100; // Very scarce
    } else if (scarcityRatio < 1) {
      positionScore = 75;
    } else if (scarcityRatio < 1.5) {
      positionScore = 50;
    } else {
      positionScore = 25; // Abundant
    }

    // Weight tier scarcity more for top tiers
    const weight = (tier === 'elite' || tier === 1) ? 0.7 : 0.4;
    const score = tierScore * weight + positionScore * (1 - weight);

    return Math.round(score);
  }

  /**
   * Calculate budget score (0-100)
   * How well does this purchase fit your remaining budget?
   */
  private calculateBudgetScore(
    player: ValuationResult,
    currentBid: number,
    context: DraftContext
  ): number {
    const remainingBudget = context.myTeam.budget || 200;
    const remainingRosterSpots = this.calculateRemainingRosterSpots(context.myTeam);
    
    // Need to save $1 per remaining spot
    const maxSpend = remainingBudget - remainingRosterSpots + 1;
    
    if (currentBid > maxSpend) {
      return 0; // Can't afford
    }

    // Calculate budget allocation
    const percentOfBudget = (currentBid / remainingBudget) * 100;
    const spotsToFill = remainingRosterSpots;
    const avgPerSpot = remainingBudget / spotsToFill;

    // Score based on budget efficiency
    let score = 50;
    
    if (currentBid < avgPerSpot * 0.5) {
      score = 100; // Great value
    } else if (currentBid < avgPerSpot) {
      score = 75; // Good value
    } else if (currentBid < avgPerSpot * 1.5) {
      score = 50; // Fair value
    } else if (currentBid < avgPerSpot * 2) {
      score = 25; // Expensive but manageable
    } else {
      score = 10; // Very expensive
    }

    // Adjust for player quality
    if (player.tier === 'elite' || player.tier === 1) {
      score = Math.min(100, score + 15); // More willing to spend on elite
    }

    return Math.round(score);
  }

  /**
   * Calculate current market inflation
   */
  private calculateMarketInflation(context: DraftContext): number {
    const draftHistory = context.draftHistory;
    
    if (draftHistory.length === 0) {
      return 0; // No inflation yet
    }

    let totalExpectedValue = 0;
    let totalActualSpent = 0;

    draftHistory.forEach(pick => {
      if (pick.price && pick.player) {
        // Find the player's expected value
        const playerValuation = context.availablePlayers.find(
          p => p.playerId === pick.player.id
        );
        
        if (playerValuation) {
          totalExpectedValue += playerValuation.marketPrice || playerValuation.auctionValue;
          totalActualSpent += pick.price;
        }
      }
    });

    if (totalExpectedValue === 0) {
      return 0;
    }

    const inflation = ((totalActualSpent - totalExpectedValue) / totalExpectedValue) * 100;
    return Math.round(inflation);
  }

  /**
   * Calculate maximum profitable bid
   */
  private calculateMaxBid(
    player: ValuationResult,
    context: DraftContext,
    scores: {
      valueScore: number;
      needScore: number;
      scarcityScore: number;
      budgetScore: number;
      marketInflation: number;
    },
    adjustments: {
      isPositionRun: boolean;
      panicLevel: number;
      draftStage: string;
    }
  ): number {
    // Use the actual player valuation data from your system
    // auctionValue is our calculated fair value (VORP-based)
    // marketPrice/marketValue is the actual market AAV
    // intrinsicValue is the theoretical value
    // maxBid is pre-calculated max we should pay
    
    // Start with the player's actual calculated auction value
    const baseValue = player.auctionValue || player.value || 1;
    const marketPrice = player.marketPrice || player.marketValue || baseValue;
    
    // Use the player's pre-calculated maxBid as a starting point if available
    let maxBid = player.maxBid || baseValue;
    
    console.log('[MaxBid Calculation]', {
      playerName: player.playerName,
      startingMaxBid: maxBid,
      auctionValue: player.auctionValue,
      marketPrice: marketPrice,
      edge: player.edge,
      tier: player.tier
    });

    // Adjust for market inflation
    const inflationMultiplier = 1 + (scores.marketInflation / 100);
    maxBid = maxBid * inflationMultiplier;

    // Adjust for need (up to +20%)
    const needMultiplier = 1 + (scores.needScore / 100) * 0.2;
    maxBid = maxBid * needMultiplier;

    // Adjust for scarcity (up to +15%)
    const scarcityMultiplier = 1 + (scores.scarcityScore / 100) * 0.15;
    maxBid = maxBid * scarcityMultiplier;
    
    // Team stack bonus (up to +10% for QB-WR/TE stacks)
    const stackInfo = this.analyzeTeamStack(player, context);
    if (stackInfo && stackInfo.synergyBonus > 0) {
      maxBid = maxBid * (1 + stackInfo.synergyBonus / 100);
    }
    
    // Dynamic adjustments based on draft flow
    if (adjustments.isPositionRun && scores.needScore > 70) {
      // In a position run and we need this position - pay up!
      maxBid = maxBid * 1.15;
    }
    
    // Panic adjustment - if we're missing critical positions late
    if (adjustments.panicLevel > 0.5) {
      maxBid = maxBid * (1 + adjustments.panicLevel * 0.2);
    }
    
    // Stage adjustment
    if (adjustments.draftStage === 'late' && player.tier <= 2) {
      // More aggressive on remaining quality players late
      maxBid = maxBid * 1.1;
    }

    // Budget constraint
    const remainingBudget = context.myTeam.budget || 200;
    const remainingSpots = this.calculateRemainingRosterSpots(context.myTeam);
    const maxAffordable = remainingBudget - remainingSpots + 1;
    
    // Global cap based on optimal roster construction
    // No single player should exceed a reasonable percentage of total budget
    const draftStage = adjustments.draftStage;
    const globalMaxBid = this.calculateGlobalMaxBid(
      player,
      context,
      remainingBudget,
      remainingSpots,
      draftStage
    );
    
    // Apply all constraints
    maxBid = Math.min(maxBid, maxAffordable, globalMaxBid);

    // Round to nearest dollar
    return Math.round(maxBid);
  }

  /**
   * Determine recommended action
   */
  private determineAction(
    currentBid: number,
    maxBid: number,
    scores: {
      valueScore: number;
      needScore: number;
      scarcityScore: number;
      budgetScore: number;
    },
    player: ValuationResult,
    context: DraftContext
  ): 'strong-buy' | 'consider' | 'avoid' | 'pass' {
    // Can't afford
    if (currentBid > maxBid) {
      return 'pass';
    }

    // Calculate composite score
    const compositeScore = (
      scores.valueScore * 0.35 +
      scores.needScore * 0.30 +
      scores.scarcityScore * 0.20 +
      scores.budgetScore * 0.15
    );

    // Strong indicators
    const hasGreatValue = scores.valueScore >= 75;
    const hasCriticalNeed = scores.needScore >= 90;
    const isLastInTier = scores.scarcityScore >= 90;
    const goodBudgetFit = scores.budgetScore >= 60;
    
    // Holistic roster checks
    const positionCount = (context.myTeam.players || []).filter(
      p => p.position === player.position
    ).length;
    const requirements = this.rosterRequirements[player.position as keyof RosterRequirements];
    const isOverloaded = requirements && typeof requirements !== 'number' &&
      positionCount >= (requirements as any).max;
    
    // Check if we have critical needs elsewhere
    const criticalNeeds = this.identifyCriticalNeeds(context);
    const hasCriticalNeedsElsewhere = criticalNeeds.length > 0 && 
      !criticalNeeds.includes(player.position);
    
    // Override: avoid if overloaded regardless of value
    if (isOverloaded && player.tier > 2) {
      return 'pass';
    }
    
    // Override: be cautious if we have critical needs elsewhere and limited budget
    if (hasCriticalNeedsElsewhere && context.myTeam.budget < 50 && scores.needScore < 70) {
      return 'avoid';
    }

    // Decision logic
    if (compositeScore >= 75 || (hasGreatValue && hasCriticalNeed)) {
      return 'strong-buy';
    } else if (compositeScore >= 55 || (hasGreatValue && goodBudgetFit)) {
      return 'consider';
    } else if (compositeScore >= 35) {
      return 'avoid';
    } else {
      return 'pass';
    }
  }

  /**
   * Calculate confidence in recommendation
   */
  private calculateConfidence(scores: {
    valueScore: number;
    needScore: number;
    scarcityScore: number;
    budgetScore: number;
  }): number {
    // Higher confidence when all signals align
    const variance = this.calculateVariance([
      scores.valueScore,
      scores.needScore,
      scores.scarcityScore,
      scores.budgetScore
    ]);

    // Lower variance = higher confidence
    const confidence = 100 - (variance / 10);
    
    return Math.round(Math.max(0, Math.min(100, confidence)));
  }

  /**
   * Generate primary reason for recommendation
   */
  private generatePrimaryReason(
    player: ValuationResult,
    action: string,
    scores: {
      valueScore: number;
      needScore: number;
      scarcityScore: number;
      budgetScore: number;
    },
    context: DraftContext
  ): string {
    const reasons: { score: number; reason: string }[] = [];
    
    // Check for special conditions
    const isPositionRun = this.detectPositionRun(player.position, context);
    const panicLevel = this.calculatePanicLevel(player.position, context);
    const criticalNeeds = this.identifyCriticalNeeds(context);
    const positionCount = (context.myTeam.players || []).filter(
      p => p.position === player.position
    ).length;

    if (scores.valueScore >= 80) {
      reasons.push({ 
        score: scores.valueScore, 
        reason: `Exceptional value - ${Math.round(100 - scores.valueScore)}% below market` 
      });
    }

    if (scores.needScore >= 90) {
      reasons.push({ 
        score: scores.needScore, 
        reason: `Critical need - You have ${positionCount} ${player.position}s and need more` 
      });
    }

    if (scores.scarcityScore >= 85) {
      reasons.push({ 
        score: scores.scarcityScore, 
        reason: `Scarcity alert - Last quality ${player.position} available` 
      });
    }
    
    if (isPositionRun && scores.needScore > 50) {
      reasons.push({
        score: 95,
        reason: `${player.position} run happening NOW - prices inflating rapidly`
      });
    }
    
    if (panicLevel > 0.7) {
      reasons.push({
        score: 98,
        reason: `PANIC BUY - Critical ${player.position} shortage, must secure now!`
      });
    }
    
    const requirements = this.rosterRequirements[player.position as keyof RosterRequirements];
    const isOverloaded = requirements && typeof requirements !== 'number' &&
      positionCount >= (requirements as any).max;

    if (action === 'pass') {
      if (isOverloaded) {
        return `Already at max capacity with ${positionCount} ${player.position}s`;
      }
      if (criticalNeeds.length > 0 && !criticalNeeds.includes(player.position)) {
        return `Must save budget for critical needs at: ${criticalNeeds.join(', ')}`;
      }
      // Check if global cap is limiting
      const remainingSpots = this.calculateRemainingRosterSpots(context.myTeam);
      if (remainingSpots >= 10) {
        return `Too expensive - need balanced roster with ${remainingSpots} spots to fill`;
      }
      return 'Price exceeds maximum profitable bid given roster construction';
    }

    if (action === 'avoid') {
      if (context.myTeam.budget < 40 && criticalNeeds.length > 0) {
        return `Limited budget - prioritize ${criticalNeeds.join(', ')} instead`;
      }
      return 'Better value plays available for roster balance';
    }

    // Return highest scoring reason
    reasons.sort((a, b) => b.score - a.score);
    return reasons[0]?.reason || 'Balanced opportunity for roster construction';
  }

  /**
   * Generate warnings
   */
  private generateWarnings(
    player: ValuationResult,
    context: DraftContext,
    currentBid: number
  ): string[] {
    const warnings: string[] = [];
    const remainingBudget = context.myTeam.budget || 200;
    const remainingSpots = this.calculateRemainingRosterSpots(context.myTeam);
    const criticalNeeds = this.identifyCriticalNeeds(context);
    const draftStage = this.determineDraftStage(context);

    // Budget warnings
    if (currentBid > remainingBudget * 0.4) {
      warnings.push(`⚠️ Heavy spend: ${Math.round((currentBid/remainingBudget)*100)}% of budget`);
    }

    if (remainingBudget - currentBid < remainingSpots * 3) {
      warnings.push(`💰 Budget crunch: Only $${remainingBudget - currentBid} for ${remainingSpots} spots`);
    }
    
    // Critical needs warnings
    if (criticalNeeds.length > 0 && !criticalNeeds.includes(player.position)) {
      warnings.push(`🚨 Still need starters at: ${criticalNeeds.join(', ')}`);
    }

    // Position warnings
    const positionCount = (context.myTeam.players || []).filter(
      p => p.position === player.position
    ).length;
    
    const requirements = this.rosterRequirements[player.position as keyof RosterRequirements];
    if (requirements && typeof requirements !== 'number') {
      const posReq = requirements as { min: number; max: number; optimal: number };
      if (positionCount >= posReq.optimal && criticalNeeds.length > 0) {
        warnings.push(`📊 Already have ${positionCount} ${player.position}s (optimal: ${posReq.optimal})`);
      }
      if (positionCount >= posReq.max) {
        warnings.push(`🛑 At maximum ${player.position} capacity (${posReq.max})`);
      }
    }

    // Tier warnings with context
    const remainingElite = context.availablePlayers.filter(
      p => p.tier === 'elite' || p.tier === 1
    ).length;

    if (remainingElite > 5 && player.tier > 2 && draftStage === 'early') {
      warnings.push(`⭐ ${remainingElite} elite players still available`);
    }
    
    // Position run warning
    if (this.detectPositionRun(player.position, context)) {
      warnings.push(`🔥 ${player.position} run in progress - prices inflating`);
    }
    
    // Strategy pivot warnings
    if (remainingSpots >= 10 && currentBid > remainingBudget * 0.25) {
      warnings.push(`📊 Consider balanced build - ${remainingSpots} spots need filling`);
    }
    
    if (draftStage === 'early' && currentBid > 50) {
      warnings.push(`💡 High early spend - commits to stars & scrubs strategy`);
    }

    return warnings;
  }

  /**
   * Generate opportunities
   */
  private generateOpportunities(
    player: ValuationResult,
    context: DraftContext,
    currentBid: number
  ): string[] {
    const opportunities: string[] = [];

    // Value opportunity
    const discount = player.auctionValue - currentBid;
    if (discount > 10) {
      opportunities.push(`$${discount} discount from fair value`);
    }

    // Tier opportunity
    const samePositionTier = context.availablePlayers.filter(
      p => p.position === player.position && p.tier === player.tier
    );
    
    if (samePositionTier.length <= 2) {
      opportunities.push(`One of last ${samePositionTier.length} in tier`);
    }

    // Stack opportunity
    const teamPlayers = (context.myTeam.players || []).filter(
      p => p.team === player.team
    );
    
    if (teamPlayers.length > 0 && player.position === 'WR') {
      const qb = teamPlayers.find(p => p.position === 'QB');
      if (qb) {
        opportunities.push(`Stack with ${qb.name}`);
      }
    }

    // Flex opportunity
    if (this.isFlexEligible(player.position) && player.tier <= 2) {
      opportunities.push('Strong flex play potential');
    }

    return opportunities;
  }

  /**
   * Predict which teams will compete for this player
   */
  private predictCompetitors(
    player: ValuationResult,
    context: DraftContext
  ): string[] {
    const competitors: string[] = [];
    const position = player.position;

    context.allTeams.forEach(team => {
      if (team.id === context.myTeam.id) return;

      // Check if team needs this position
      const positionCount = (team.players || []).filter(p => p.position === position).length;
      const requirements = this.rosterRequirements[position as keyof RosterRequirements];
      
      if (requirements && typeof requirements !== 'number') {
        const posReq = requirements as { min: number; max: number; optimal: number };
        
        // Team needs this position
        if (positionCount < posReq.optimal) {
          // Check if they can afford
          const canAfford = team.budget >= player.marketPrice;
          
          if (canAfford) {
            competitors.push(team.name);
          }
        }
      }
    });

    return competitors.slice(0, 3); // Top 3 likely competitors
  }

  /**
   * Predict final price based on market conditions
   */
  private predictFinalPrice(
    player: ValuationResult,
    context: DraftContext,
    marketInflation: number
  ): number {
    const basePrice = player.marketPrice || player.auctionValue;
    const inflationMultiplier = 1 + (marketInflation / 100);
    
    // Adjust for tier premium
    let tierMultiplier = 1;
    if (player.tier === 'elite' || player.tier === 1) {
      tierMultiplier = 1.1; // Elite players often go 10% over
    }

    // Adjust for position scarcity
    const scarcityScore = this.calculateScarcityScore(player, context);
    const scarcityMultiplier = 1 + (scarcityScore / 100) * 0.1;

    const predictedPrice = basePrice * inflationMultiplier * tierMultiplier * scarcityMultiplier;
    
    return Math.round(predictedPrice);
  }

  /**
   * Determine nomination strategy with advanced logic
   */
  private determineNominationStrategy(
    player: ValuationResult,
    context: DraftContext
  ): 'nominate-early' | 'nominate-late' | 'avoid-nominating' {
    const myNeed = this.calculateNeedScore(player, context);
    const marketInflation = this.calculateMarketInflation(context);
    const draftStage = this.determineDraftStage(context);
    const competitors = this.analyzeCompetitors(player, context);
    
    // Advanced nomination logic
    
    // If multiple teams need this player and can afford, nominate to drain budgets
    if (competitors.length >= 3 && myNeed < 50) {
      // Price enforce - make others pay
      return 'nominate-early';
    }
    
    // If you desperately need and few competitors, nominate late
    if (myNeed >= 80 && competitors.length <= 1) {
      return 'nominate-late';
    }
    
    // Sleeper strategy - nominate your sleepers early when people save budget
    if (draftStage === 'early' && player.adp && player.adp > 100 && myNeed >= 70) {
      return 'nominate-early';
    }
    
    // Nominate expensive players you don't want early to drain budgets
    if (player.auctionValue > 40 && myNeed < 30) {
      return 'nominate-early';
    }

    // Standard logic
    if (myNeed >= 70 && marketInflation < 10) {
      return 'nominate-early';
    }

    if (player.adp && player.adp > 150 && myNeed >= 60) {
      return 'nominate-late';
    }

    if (myNeed < 40) {
      return 'avoid-nominating';
    }

    return 'nominate-late';
  }

  /**
   * Determine bidding strategy
   */
  private determineBiddingStrategy(
    player: ValuationResult,
    context: DraftContext,
    action: string
  ): 'aggressive' | 'patient' | 'price-enforce' | 'avoid' {
    if (action === 'strong-buy') {
      return 'aggressive';
    }

    if (action === 'consider') {
      return 'patient';
    }

    if (action === 'avoid') {
      // Price enforce if someone else overpaying
      const marketPrice = player.marketPrice || player.auctionValue;
      if (context.currentBid < marketPrice * 0.8) {
        return 'price-enforce';
      }
    }

    return 'avoid';
  }

  /**
   * Find alternative players at similar value
   */
  private findAlternatives(
    player: ValuationResult,
    context: DraftContext
  ): ValuationResult[] {
    const alternatives = context.availablePlayers
      .filter(p => 
        p.position === player.position &&
        p.playerId !== player.playerId &&
        Math.abs(p.auctionValue - player.auctionValue) <= 5
      )
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, 3);

    return alternatives;
  }

  // Helper methods

  private isFlexEligible(position: string): boolean {
    return this.rosterRequirements.FLEX.eligiblePositions.includes(position);
  }

  private calculateRemainingRosterSpots(team: Team): number {
    const totalSpots = 16; // Standard roster size
    return totalSpots - (team.players?.length || 0);
  }

  private calculateTotalPositionNeeds(position: string, context: DraftContext): number {
    const requirements = this.rosterRequirements[position as keyof RosterRequirements];
    if (!requirements || typeof requirements === 'number') {
      return context.allTeams.length; // Default
    }

    const posReq = requirements as { min: number; max: number; optimal: number };
    return context.allTeams.length * posReq.optimal;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate global max bid cap to ensure balanced roster construction
   * Prevents overspending on single players when better strategies exist
   */
  private calculateGlobalMaxBid(
    player: ValuationResult,
    context: DraftContext,
    remainingBudget: number,
    remainingSpots: number,
    draftStage: string
  ): number {
    // Base caps by position and tier
    const positionCaps: Record<string, number> = {
      RB: 75,  // Top RBs can go up to $75
      WR: 65,  // Top WRs can go up to $65
      QB: 45,  // Top QBs max around $45
      TE: 45,  // Premium TEs max around $45
      DST: 5,  // Never spend more than $5 on DST
      K: 2     // Never spend more than $2 on K
    };
    
    let globalCap = positionCaps[player.position] || 50;
    
    // Adjust based on remaining budget and roster spots
    const budgetPerSpot = remainingBudget / Math.max(1, remainingSpots);
    
    // Strategy pivot thresholds
    if (remainingSpots >= 10) {
      // Many spots to fill - cap at 30% of remaining budget
      globalCap = Math.min(globalCap, remainingBudget * 0.30);
    } else if (remainingSpots >= 5) {
      // Some spots to fill - cap at 40% of remaining budget
      globalCap = Math.min(globalCap, remainingBudget * 0.40);
    } else if (remainingSpots >= 2) {
      // Few spots left - can spend up to 60% if elite
      if (player.tier === 'elite' || player.tier === 'tier1') {
        globalCap = Math.min(globalCap, remainingBudget * 0.60);
      } else {
        globalCap = Math.min(globalCap, remainingBudget * 0.45);
      }
    } else {
      // Last spot - can spend most of budget
      globalCap = Math.min(globalCap, remainingBudget - 1);
    }
    
    // Draft stage adjustments
    if (draftStage === 'early') {
      // Early draft - be more conservative to maintain flexibility
      const mySpentSoFar = 200 - remainingBudget;
      const picksCompleted = context.myTeam.players?.length || 0;
      
      if (picksCompleted === 0) {
        // First pick - don't exceed 30% of total budget, but respect player's actual value
        const budgetCap = context.totalBudget * 0.30;
        globalCap = Math.min(globalCap, budgetCap);
      } else if (picksCompleted <= 2) {
        // Early picks - cap based on "stars and scrubs" vs "balanced" strategy
        // If we've already spent big, cap lower to force balance
        if (mySpentSoFar > context.totalBudget * 0.30) {
          globalCap = Math.min(globalCap, remainingBudget * 0.25);
        }
      }
    }
    
    // Never exceed certain percentages based on player tier
    if (player.tier === 'tier3' || player.tier === 'replacement') {
      // Lower tier players should never exceed 20% of remaining budget
      globalCap = Math.min(globalCap, remainingBudget * 0.20);
    }
    
    // Special case: if this would leave us with less than $1 per remaining spot
    const budgetAfterPurchase = remainingBudget - globalCap;
    const spotsAfterPurchase = remainingSpots - 1;
    if (spotsAfterPurchase > 0 && budgetAfterPurchase < spotsAfterPurchase) {
      globalCap = remainingBudget - spotsAfterPurchase;
    }
    
    return Math.max(1, Math.floor(globalCap));
  }

  /**
   * Detect if there's a position run happening
   * A position run is when multiple players from the same position are drafted in quick succession
   */
  private detectPositionRun(position: string, context: DraftContext): boolean {
    if (context.draftHistory.length < 5) return false;
    
    // Look at last 5 picks
    const recentPicks = context.draftHistory.slice(-5);
    const positionCount = recentPicks.filter(
      pick => pick.player?.position === position
    ).length;
    
    // If 3 or more of last 5 picks are same position, it's a run
    return positionCount >= 3;
  }

  /**
   * Calculate panic level based on remaining quality and roster needs
   * Returns 0-1 where 1 is maximum panic
   */
  private calculatePanicLevel(position: string, context: DraftContext): number {
    const myRoster = context.myTeam.players || [];
    const currentCount = myRoster.filter(p => p.position === position).length;
    const requirements = this.rosterRequirements[position as keyof RosterRequirements];
    
    if (!requirements || typeof requirements === 'number') return 0;
    
    const posReq = requirements as { min: number; max: number; optimal: number };
    const stillNeeded = Math.max(0, posReq.min - currentCount);
    
    if (stillNeeded === 0) return 0;
    
    // Count quality players remaining
    const qualityRemaining = context.availablePlayers.filter(
      p => p.position === position && (p.tier === 'elite' || p.tier === 1 || p.tier === 2)
    ).length;
    
    // Calculate how many picks until it's likely our turn again
    const teamsCount = context.allTeams.length;
    const picksUntilTurn = Math.floor(teamsCount / 2);
    
    // High panic if we need players and few quality options remain
    if (stillNeeded > 0 && qualityRemaining <= picksUntilTurn) {
      return Math.min(1, stillNeeded / qualityRemaining);
    }
    
    return 0;
  }

  /**
   * Determine what stage of the draft we're in
   */
  private determineDraftStage(context: DraftContext): 'early' | 'middle' | 'late' {
    const totalRosterSpots = context.allTeams.length * 16; // 16 players per team
    const draftedCount = context.draftHistory.length;
    const percentDrafted = draftedCount / totalRosterSpots;
    
    if (percentDrafted < 0.25) return 'early';
    if (percentDrafted < 0.65) return 'middle';
    return 'late';
  }

  /**
   * Analyze competitor budgets and needs
   */
  private analyzeCompetitors(
    player: ValuationResult,
    context: DraftContext
  ): CompetitorInsight[] {
    const insights: CompetitorInsight[] = [];
    const position = player.position;
    
    context.allTeams.forEach(team => {
      if (team.id === context.myTeam.id) return;
      
      const positionCount = (team.players || []).filter(p => p.position === position).length;
      const requirements = this.rosterRequirements[position as keyof RosterRequirements];
      const needsPosition = requirements && typeof requirements !== 'number' &&
        positionCount < (requirements as any).optimal;
      
      const remainingBudget = team.budget || 0;
      const rosterSize = team.players?.length || 0;
      const spotsLeft = 16 - rosterSize;
      const maxPossibleBid = Math.max(0, remainingBudget - spotsLeft + 1);
      
      // Determine aggression level based on spending pattern
      const avgSpend = rosterSize > 0 ? ((200 - remainingBudget) / rosterSize) : 0;
      let aggressionLevel: 'high' | 'medium' | 'low' = 'medium';
      if (avgSpend > 20) aggressionLevel = 'high';
      else if (avgSpend < 10) aggressionLevel = 'low';
      
      if (needsPosition && maxPossibleBid >= player.auctionValue * 0.5) {
        insights.push({
          teamName: team.name,
          remainingBudget,
          needsPosition,
          maxPossibleBid,
          aggressionLevel
        });
      }
    });
    
    // Sort by threat level (max bid)
    return insights.sort((a, b) => b.maxPossibleBid - a.maxPossibleBid).slice(0, 5);
  }

  /**
   * Analyze bye week impact
   */
  private analyzeByeWeekImpact(
    player: ValuationResult,
    context: DraftContext
  ): ByeWeekAnalysis | undefined {
    if (!player.byeWeek) return undefined;
    
    const myRoster = context.myTeam.players || [];
    const byeWeekCounts: Record<number, number> = {};
    const byeWeekPositions: Record<number, string[]> = {};
    
    // Count current bye weeks
    myRoster.forEach(p => {
      if (p.byeWeek) {
        byeWeekCounts[p.byeWeek] = (byeWeekCounts[p.byeWeek] || 0) + 1;
        if (!byeWeekPositions[p.byeWeek]) byeWeekPositions[p.byeWeek] = [];
        byeWeekPositions[p.byeWeek].push(p.position);
      }
    });
    
    // Check impact of adding this player
    const currentCount = byeWeekCounts[player.byeWeek] || 0;
    const wouldCreateStack = currentCount >= 2;
    const affectedPositions = byeWeekPositions[player.byeWeek] || [];
    
    let warning: string | undefined;
    if (currentCount >= 3) {
      warning = `CRITICAL: Would have ${currentCount + 1} players on Week ${player.byeWeek} bye`;
    } else if (wouldCreateStack && affectedPositions.includes('QB')) {
      warning = `Warning: QB and ${player.position} both on Week ${player.byeWeek} bye`;
    } else if (wouldCreateStack && player.position === 'RB' && affectedPositions.includes('RB')) {
      warning = `Warning: Multiple RBs on Week ${player.byeWeek} bye`;
    }
    
    return {
      playerByeWeek: player.byeWeek,
      currentByeWeekCounts: byeWeekCounts,
      wouldCreateStack,
      affectedPositions,
      warning
    };
  }

  /**
   * Analyze team stacking opportunities
   */
  private analyzeTeamStack(
    player: ValuationResult,
    context: DraftContext
  ): TeamStackInfo | undefined {
    const myRoster = context.myTeam.players || [];
    const sameTeamPlayers = myRoster.filter(p => p.team === player.team);
    
    if (sameTeamPlayers.length === 0) return undefined;
    
    const existingPositions = sameTeamPlayers.map(p => p.position);
    const existingNames = sameTeamPlayers.map(p => p.name);
    
    let stackType: 'QB-WR' | 'QB-TE' | 'RB-DEF' | 'multiple' | 'none' = 'none';
    let synergyBonus = 0;
    let warning: string | undefined;
    
    // Check for QB stacks (most valuable)
    if (existingPositions.includes('QB')) {
      if (player.position === 'WR') {
        stackType = 'QB-WR';
        synergyBonus = 10; // 10% bonus for QB-WR stack
      } else if (player.position === 'TE') {
        stackType = 'QB-TE';
        synergyBonus = 8; // 8% bonus for QB-TE stack
      }
    }
    
    // Check for RB-DEF stack (risky but can work)
    if (existingPositions.includes('RB') && player.position === 'DST') {
      stackType = 'RB-DEF';
      synergyBonus = 3; // Small bonus
    }
    
    // Warning for too many from same team
    if (sameTeamPlayers.length >= 3) {
      warning = `Already have ${sameTeamPlayers.length} ${player.team} players - consider diversifying`;
      synergyBonus = Math.max(0, synergyBonus - 5); // Reduce bonus if overconcentrated
    }
    
    if (sameTeamPlayers.length >= 2) {
      stackType = 'multiple';
    }
    
    return {
      team: player.team,
      existingPlayers: existingNames,
      stackType,
      synergyBonus,
      warning
    };
  }

  /**
   * Generate smart alternative suggestions
   */
  private generateSmartAlternatives(
    player: ValuationResult,
    context: DraftContext,
    action: string
  ): SmartAlternative[] {
    const alternatives: SmartAlternative[] = [];
    const position = player.position;
    
    // Always check if we have available players data
    if (!context.availablePlayers || context.availablePlayers.length === 0) {
      // If no data, return empty array rather than crash
      return [];
    }
    
    // Always show alternatives regardless of action for better UX
    
    // 1. Find similar tier alternatives at same position
    const samePositionAlts = context.availablePlayers
      .filter(p => {
        if (p.position !== position) return false;
        if (p.playerId === player.playerId) return false;
        
        // Handle tier comparison - tiers can be 'elite', 1, 2, 3, etc.
        const playerTier = player.tier === 'elite' ? 0 : (player.tier as number);
        const altTier = p.tier === 'elite' ? 0 : (p.tier as number);
        
        return Math.abs(altTier - playerTier) <= 1;
      })
      .sort((a, b) => {
        // Sort by value for money (edge)
        const aEdge = (a.edge || 0);
        const bEdge = (b.edge || 0);
        return bEdge - aEdge;
      })
      .slice(0, 2);
    
    // Add alternatives based on context
    if (action === 'pass' || action === 'avoid') {
      // Show better value plays
      samePositionAlts.forEach(alt => {
        if (alt.auctionValue < player.auctionValue) {
          alternatives.push({
            player: alt,
            reasoning: `Better value: $${alt.auctionValue} for similar production`,
            targetPrice: Math.round(alt.auctionValue * 0.9),
            availability: 'likely-available'
          });
        }
      });
    } else {
      // Show backup options if we lose
      samePositionAlts.forEach(alt => {
        alternatives.push({
          player: alt,
          reasoning: `Backup option: Similar tier ${position}`,
          targetPrice: Math.round(alt.auctionValue * 0.95),
          availability: alt.tier <= 2 ? 'risky' : 'likely-available'
        });
      });
    }
    
    // 2. Find pivot opportunities at positions of need
    const criticalNeeds = this.identifyCriticalNeeds(context);
    if (criticalNeeds.length > 0 && !criticalNeeds.includes(position)) {
      const pivotTarget = context.availablePlayers
        .filter(p => 
          criticalNeeds.includes(p.position) &&
          p.tier <= 2 &&
          p.auctionValue <= player.auctionValue
        )
        .sort((a, b) => b.vorp - a.vorp)
        .slice(0, 1);
      
      pivotTarget.forEach(alt => {
        alternatives.push({
          player: alt,
          reasoning: `Pivot opportunity: Fill critical need at ${alt.position}`,
          targetPrice: Math.round(alt.auctionValue),
          availability: 'immediate'
        });
      });
    }
    
    // 3. If position is deep, show wait-and-see options
    const positionDepth = context.availablePlayers.filter(
      p => p.position === position && p.tier <= 3
    ).length;
    
    if (positionDepth > 10 && action !== 'strong-buy') {
      const laterTarget = context.availablePlayers
        .filter(p => {
          if (p.position !== position) return false;
          if (p.playerId === player.playerId) return false;
          
          const playerTier = player.tier === 'elite' ? 0 : (player.tier as number);
          const altTier = p.tier === 'elite' ? 0 : (p.tier as number);
          
          return altTier === playerTier + 1 && p.auctionValue < player.auctionValue * 0.7;
        })
        .sort((a, b) => b.vorp - a.vorp)
        .slice(0, 1);
      
      laterTarget.forEach(alt => {
        alternatives.push({
          player: alt,
          reasoning: `Wait for value: ${positionDepth} quality ${position}s remain`,
          targetPrice: Math.round(alt.auctionValue * 0.85),
          availability: 'likely-available'
        });
      });
    }
    
    // Remove duplicates and limit to 3
    const uniqueAlts = alternatives.filter((alt, index, self) =>
      index === self.findIndex(a => a.player.playerId === alt.player.playerId)
    );
    
    return uniqueAlts.slice(0, 3);
  }

  /**
   * Identify positions where we have critical needs
   */
  private identifyCriticalNeeds(context: DraftContext): string[] {
    const criticalNeeds: string[] = [];
    const myRoster = context.myTeam.players || [];
    
    for (const [position, requirements] of Object.entries(this.rosterRequirements)) {
      if (typeof requirements === 'number') continue;
      
      const posReq = requirements as { min: number; max: number; optimal: number };
      const currentCount = myRoster.filter(p => p.position === position).length;
      
      // Critical if we haven't met minimum requirements
      if (currentCount < posReq.min) {
        // Extra critical if it's a starting position and we have none
        if (currentCount === 0 && ['QB', 'RB', 'WR', 'TE'].includes(position)) {
          criticalNeeds.push(position);
        } else if (currentCount < posReq.min) {
          criticalNeeds.push(position);
        }
      }
    }
    
    return criticalNeeds;
  }
}

export const bidAdvisorService = new BidAdvisorService();