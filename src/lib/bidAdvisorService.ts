/**
 * Real-Time Bid Advisor Service
 * Provides dynamic bidding recommendations during auction drafts
 */

import type { ValuationResult } from './calibratedValuationService';
import type { DraftPick } from '@/store/draftStore';
import type { Player } from '@/types';

// Custom Team interface for BidAdvisor that includes players array
interface BidAdvisorTeam {
  id: string;
  name: string;
  budget: number;
  players: Player[];
  isUser?: boolean;
  maxBid?: number;
  nominations?: number;
}

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
  
  // New: Budget and Draft Progress
  budgetAdvantage?: BudgetAdvantage;
  draftProgress?: DraftProgress;
  activeStrategy?: 'robust-rb' | 'hero-rb' | 'zero-rb' | 'balanced';
  strategyPivotAlert?: string;
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

export interface BudgetAdvantage {
  myBudget: number;
  averageBudget: number;
  advantage: number; // positive = more than avg, negative = less
  percentile: number; // 0-100, where you rank
  canDominate: boolean; // true if significantly more budget
}

export interface DraftProgress {
  totalPicks: number;
  picksMade: number;
  percentComplete: number;
  isHalfway: boolean;
  phase: 'early' | 'mid' | 'late' | 'end';
}

export interface DraftContext {
  myTeam: BidAdvisorTeam;
  allTeams: BidAdvisorTeam[];
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

// 12-team Full PPR roster requirements (16 total players)
// Starters: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 DST, 1 K = 9 starters
// Bench: 7 spots
// Total: 16 players
const DEFAULT_ROSTER_REQUIREMENTS: RosterRequirements = {
  QB: { min: 1, max: 2, optimal: 1 },  // Only 1 QB needed
  RB: { min: 2, max: 5, optimal: 5 },  // Target: 1 elite, 2 tier2, 2 value
  WR: { min: 2, max: 6, optimal: 5 },  // 5 WRs to balance spending
  TE: { min: 1, max: 2, optimal: 1 },  // Only 1 TE needed
  DST: { min: 1, max: 1, optimal: 1 },
  K: { min: 1, max: 1, optimal: 1 },
  FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
  BENCH: 7
};

// Robust RB Strategy Configuration for 2025 - UPDATED FOR GUIDELINES
const ROBUST_RB_CONFIG = {
  enabled: true,
  targetBudgetPercent: 0.55, // 50-60% on RBs per strat.md
  eliteRBTarget: 1, // Target only 1 elite RB
  maxEliteRBs: 1,
  firstFiveRounds: 5, // Get elite RB in first 5 nomination rounds
  eliteRBBudget: 50, // $45-55 for 1 elite RB
  tier1RBRange: { min: 35, max: 45 }, // Tier 1 range
  tier2RBRange: { min: 20, max: 30 }, // Tier 2 range for 2 RBs
  inflationThreshold: 1.35, // Pivot if RBs cost 35% more than expected
  totalRBTarget: 5, // Target exactly 5 RBs
  totalWRTarget: 5 // Target exactly 5 WRs
};

// Backup Strategy Configurations
const HERO_RB_CONFIG = {
  targetBudgetPercent: 0.35, // 30-40% on RBs
  eliteRBTarget: 1, // Just one elite RB
  maxSpendOnOne: 65, // Max $65 on single RB
  pivotToWR: true // Heavy WR investment after
};

const ZERO_RB_CONFIG = {
  targetBudgetPercent: 0.15, // 10-20% on RBs
  noEliteRBs: true,
  waitUntilRound: 7, // Don't draft RBs until round 7+
  loadWRs: true // Get 4+ WRs early
};

class BidAdvisorService {
  private rosterRequirements: RosterRequirements;
  private originalValuations: Map<string, number> = new Map();
  private robustRBConfig = ROBUST_RB_CONFIG;
  private heroRBConfig = HERO_RB_CONFIG;
  private zeroRBConfig = ZERO_RB_CONFIG;
  private activeStrategy: 'robust-rb' | 'hero-rb' | 'zero-rb' | 'balanced' = 'robust-rb';
  private strategyPivoted: boolean = false;

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
    
    // New: Budget advantage and draft progress
    const budgetAdvantage = this.calculateBudgetAdvantage(context);
    const draftProgress = this.calculateDraftProgress(context);
    
    // Check if strategy pivot is needed
    const strategyCheck = this.checkStrategyPivot(player, context, marketInflation);
    if (strategyCheck.shouldPivot) {
      this.activeStrategy = strategyCheck.newStrategy;
      this.strategyPivoted = true;
    }

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
      smartAlternatives,
      budgetAdvantage,
      draftProgress,
      activeStrategy: this.activeStrategy,
      strategyPivotAlert: strategyCheck.alert
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

    // Weight tier scarcity more for top tiers - Fixed tier comparison
    const weight = (tier === 'elite' || tier === 'tier1') ? 0.7 : 0.4;
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

    // Adjust for player quality - Fixed tier comparison
    if (player.tier === 'elite' || player.tier === 'tier1') {
      score = Math.min(100, score + 15); // More willing to spend on elite
    }

    return Math.round(score);
  }

  /**
   * Calculate current market inflation
   * Fixed: Store original valuations at draft start
   */
  private calculateMarketInflation(context: DraftContext): number {
    const draftHistory = context.draftHistory;
    
    if (draftHistory.length === 0) {
      // Store original valuations at draft start
      context.availablePlayers.forEach(player => {
        const playerId = player.playerId || player.id;
        if (playerId && !this.originalValuations.has(playerId)) {
          this.originalValuations.set(playerId, player.marketValue || player.auctionValue || 1);
        }
      });
      return 0;
    }

    let totalExpectedValue = 0;
    let totalActualSpent = 0;

    draftHistory.forEach(pick => {
      if (pick.price && pick.player) {
        const playerId = pick.player.id || pick.player.playerId;
        const originalValue = this.originalValuations.get(playerId);
        
        if (originalValue) {
          totalExpectedValue += originalValue;
          totalActualSpent += pick.price;
        }
      }
    });

    if (totalExpectedValue === 0) {
      return 0;
    }

    const inflation = ((totalActualSpent - totalExpectedValue) / totalExpectedValue) * 100;
    return Math.round(Math.max(-30, Math.min(30, inflation))); // Cap at ±30%
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
    
    // Robust RB Strategy adjustments
    const myRoster = context.myTeam.players || [];
    const myRBs = myRoster.filter(p => p.position === 'RB');
    // Count elite RBs based on draft price since they're no longer in available players
    const eliteRBCount = myRBs.filter(rb => {
      const draftPick = context.draftHistory.find(pick => 
        pick.player && rb && (
          (pick.player.id && pick.player.id === (rb as any).id) || 
          ((pick.player as any).playerId && (pick.player as any).playerId === (rb as any).id)
        )
      );
      // Consider RBs drafted for $40+ as elite
      return draftPick && draftPick.price && draftPick.price >= 40;
    }).length;
    const draftRound = Math.floor(context.draftHistory.length / 12) + 1;
    
    // Apply strategy-specific bonuses
    let robustRBBonus = 0;
    let wrDepthBonus = 0;
    
    // ROBUST RB STRATEGY: Balanced aggression on elite RBs early (target 50-60% budget)
    if (this.activeStrategy === 'robust-rb' && player.position === 'RB') {
      // Calculate how much we've already spent on RBs
      const rbSpent = context.draftHistory
        .filter(pick => pick.team === context.myTeam.id && pick.player?.position === 'RB')
        .reduce((sum, pick) => sum + (pick.price || 0), 0);
      
      // If we've already spent >60% of starting budget on RBs, reduce bonuses
      const rbBudgetPercent = rbSpent / 200;
      
      if (draftRound <= this.robustRBConfig.firstFiveRounds && rbBudgetPercent < 0.6) {
        if (player.tier === 'elite' && eliteRBCount < 1) {
          // Only bonus for the FIRST elite RB
          robustRBBonus = 0.05; // Only 5% bonus for first elite RB
          console.log('[Robust RB] First elite RB bonus applied:', player.playerName, 'Bonus:', robustRBBonus);
        } else if (player.tier === 'tier2' && myRBs.length < 3) {
          robustRBBonus = 0.02; // Tiny 2% bonus for tier2 RBs
          console.log('[Robust RB] Tier2 RB bonus applied:', player.playerName);
        } else {
          robustRBBonus = 0.0; // No bonus for additional RBs
        }
      } else if (draftRound <= 8 && player.tier === 'tier2' && myRBs.length < 3 && rbBudgetPercent < 0.5) {
        robustRBBonus = 0.02; // 2% bonus for mid-round tier2 RBs
      }
    }
    
    // HERO RB STRATEGY: One elite RB, then pivot to WR
    else if (this.activeStrategy === 'hero-rb') {
      if (player.position === 'RB' && eliteRBCount === 0 && player.tier === 'elite') {
        // Still want ONE elite RB
        robustRBBonus = 0.40; // 40% bonus for single elite RB
        console.log('[Hero RB] Elite RB bonus for anchor:', player.playerName);
      } else if (player.position === 'WR' && (player.tier === 'elite' || player.tier === 'tier1')) {
        // Pivot hard to elite WRs after getting one RB
        wrDepthBonus = 0.35; // 35% bonus for elite WRs
        console.log('[Hero RB] Elite WR bonus:', player.playerName);
      }
    }
    
    // ZERO RB STRATEGY: WR heavy, value RBs late
    else if (this.activeStrategy === 'zero-rb') {
      if (player.position === 'WR' && (player.tier === 'elite' || player.tier === 'tier1')) {
        // Maximum aggression on WRs
        wrDepthBonus = 0.45; // 45% bonus for elite WRs
        console.log('[Zero RB] Elite WR maximum bonus:', player.playerName);
      } else if (player.position === 'RB') {
        // Only value RBs (tier3 or worse) in late rounds
        if ((player.tier === 'tier3' || player.tier === 'replacement') && draftRound >= 8) {
          robustRBBonus = 0.15; // Small bonus for value RBs
          console.log('[Zero RB] Value RB bonus:', player.playerName);
        } else {
          // Actively avoid expensive RBs
          robustRBBonus = -0.20; // PENALTY for elite/tier1 RBs
          console.log('[Zero RB] Avoiding expensive RB:', player.playerName);
        }
      }
    }
    
    // WR Depth acquisition (applies to all strategies after core is secured)
    const myWRs = myRoster.filter(p => p.position === 'WR');
    if (player.position === 'WR' && this.activeStrategy !== 'zero-rb') {
      // After securing RB core, prioritize WRs to hit 25-35% target
      if (this.activeStrategy === 'robust-rb' && eliteRBCount >= 2) {
        if (player.tier === 'elite' || player.tier === 'tier1') {
          wrDepthBonus = 0.15; // 15% bonus for elite/tier1 WRs
          console.log('[WR Depth] Elite WR bonus after RB core:', player.playerName);
        } else if (myWRs.length < 5 && (player.tier === 'tier2' || player.tier === 'tier3')) {
          wrDepthBonus = Math.max(wrDepthBonus, 0.10); // 10% for depth WRs
          console.log('[WR Depth] Bonus applied:', player.playerName);
        }
      } else if (this.activeStrategy === 'hero-rb' && eliteRBCount >= 1) {
        if (myWRs.length < 5 && (player.tier === 'tier2' || player.tier === 'tier3')) {
          wrDepthBonus = Math.max(wrDepthBonus, 0.20); // Ensure WR depth
          console.log('[WR Depth] Bonus applied:', player.playerName);
        }
      }
    }

    console.log('[MaxBid Calculation]', {
      playerName: player.playerName,
      startingMaxBid: maxBid,
      auctionValue: player.auctionValue,
      marketPrice: marketPrice,
      edge: player.edge,
      tier: player.tier,
      robustRBBonus,
      wrDepthBonus
    });

    // Calculate total adjustment with CAP to prevent multiplier stacking
    // Using additive approach instead of multiplicative
    let totalAdjustment = 0;
    
    // Market inflation adjustment (capped at ±30%)
    totalAdjustment += (scores.marketInflation / 100);
    
    // Need adjustment (up to +20%)
    totalAdjustment += (scores.needScore / 100) * 0.2;
    
    // Scarcity adjustment (up to +15%)
    totalAdjustment += (scores.scarcityScore / 100) * 0.15;
    
    // Team stack bonus (up to +10%)
    const stackInfo = this.analyzeTeamStack(player, context);
    if (stackInfo && stackInfo.synergyBonus > 0) {
      totalAdjustment += stackInfo.synergyBonus / 100;
    }
    
    // Position run adjustment (up to +15%)
    if (adjustments.isPositionRun && scores.needScore > 70) {
      totalAdjustment += 0.15;
    }
    
    // Panic adjustment (capped)
    const cappedPanicLevel = Math.min(1.0, adjustments.panicLevel);
    if (cappedPanicLevel > 0.5) {
      totalAdjustment += cappedPanicLevel * 0.2;
    }
    
    // Stage adjustment
    if (adjustments.draftStage === 'late' && (player.tier === 'elite' || player.tier === 'tier1' || player.tier === 'tier2')) {
      totalAdjustment += 0.1;
    }
    
    // Robust RB bonus
    totalAdjustment += robustRBBonus;
    
    // WR Depth bonus
    totalAdjustment += wrDepthBonus;
    
    // Dynamic cap based on draft context
    const draftProgress = context.draftHistory.length / (12 * 16);
    const isEarlyDraft = draftProgress < 0.25;
    let maxIncrease = 0.5; // Default
    
    // More flexible caps early in draft - INCREASED for 70-80% top player spend
    if (isEarlyDraft) {
      if (player.tier === 'elite') {
        maxIncrease = 1.0; // Allow up to 100% over for elite players early
      } else if (player.tier === 'tier1') {
        maxIncrease = 0.85; // Allow up to 85% over for tier1 early
      } else {
        maxIncrease = 0.7; // Allow up to 70% over for others early
      }
    }
    
    // Special RB allowance during Robust RB strategy - INCREASED
    if (this.robustRBConfig.enabled && player.position === 'RB' && draftRound <= 5) {
      maxIncrease = Math.max(maxIncrease, 0.90); // At least 90% flexibility for RBs
    }
    
    totalAdjustment = Math.max(-0.3, Math.min(maxIncrease, totalAdjustment));
    
    // Apply the capped adjustment
    maxBid = maxBid * (1 + totalAdjustment);

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
    // Calculate draft progress and context
    const draftProgress = context.draftHistory.length / (12 * 16); // % of draft complete
    const isEarlyDraft = draftProgress < 0.25;
    const isMidDraft = draftProgress >= 0.25 && draftProgress < 0.6;
    const isLateDraft = draftProgress >= 0.6;
    
    // Calculate market inflation
    const marketInflation = this.calculateMarketInflation(context) / 100; // Convert to decimal
    const isInflatedMarket = marketInflation > 0.1; // Market is 10%+ inflated
    
    // Budget context
    const remainingBudget = context.myTeam.budget;
    const avgBudgetPerSlot = remainingBudget / Math.max(1, 16 - (context.myTeam.players?.length || 0));
    const hasAmpleBudget = remainingBudget > 100;
    const isBudgetConstrained = remainingBudget < 50;
    
    // Flexible max bid based on context
    let flexibleMaxBid = maxBid;
    
    // Early draft adjustments - be more aggressive
    if (isEarlyDraft) {
      if (player.tier === 'elite') {
        flexibleMaxBid = maxBid * 1.15; // Allow 15% over for elite players early
      } else if (player.tier === 'tier1') {
        flexibleMaxBid = maxBid * 1.10; // Allow 10% over for tier1 early
      }
      
      // If market is inflated and we have budget, be even more flexible
      if (isInflatedMarket && hasAmpleBudget) {
        flexibleMaxBid *= 1.1; // Additional 10% flexibility in inflated markets
      }
    }
    
    // Mid draft - moderate flexibility
    else if (isMidDraft) {
      if (player.tier === 'elite' || player.tier === 'tier1') {
        flexibleMaxBid = maxBid * 1.05; // Allow 5% over for top tiers
      }
    }
    
    // Late draft - be strict unless desperate
    else if (isLateDraft) {
      // Only be flexible if we have critical needs
      const criticalNeeds = this.identifyCriticalNeeds(context);
      if (criticalNeeds.includes(player.position)) {
        flexibleMaxBid = maxBid * 1.05;
      }
    }
    
    // Can't afford even with flexibility
    if (currentBid > flexibleMaxBid * 1.2) {
      return 'pass'; // Hard limit at 20% over flexible max
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

    // Special Robust RB logic - EXTREMELY aggressive on RBs
    const draftRound = Math.floor(context.draftHistory.length / 12) + 1;
    const myRBs = (context.myTeam.players || []).filter(p => p.position === 'RB');
    const eliteRBCount = myRBs.filter(rb => {
      const draftPick = context.draftHistory.find(pick => 
        pick.player && rb && (
          (pick.player.id && pick.player.id === (rb as any).id) || 
          ((pick.player as any).playerId && (pick.player as any).playerId === (rb as any).id)
        )
      );
      return draftPick && draftPick.price && draftPick.price >= 40;
    }).length;
    
    // CRITICAL: Must get RBs at almost any cost
    if (this.robustRBConfig.enabled && player.position === 'RB') {
      // Elite RBs - pay whatever it takes
      if (player.tier === 'elite' && eliteRBCount < 2) {
        if (currentBid <= flexibleMaxBid * 1.5) { // Up to 50% over
          return 'strong-buy';
        }
      }
      // Tier1 RBs - very aggressive if no elites yet
      else if (player.tier === 'tier1' && myRBs.length < 3) {
        if (currentBid <= flexibleMaxBid * 1.3 || eliteRBCount === 0) {
          return 'strong-buy';
        } else if (currentBid <= flexibleMaxBid * 1.4) {
          return 'consider';
        }
      }
      // Tier2 RBs - still need depth
      else if (player.tier === 'tier2' && myRBs.length < 4) {
        if (currentBid <= flexibleMaxBid * 1.2) {
          return draftRound <= 8 ? 'strong-buy' : 'consider';
        }
      }
    }

    // Adjust thresholds based on draft context
    let strongBuyThreshold = 75;
    let considerThreshold = 55;
    let avoidThreshold = 35;
    
    if (isEarlyDraft) {
      // Lower thresholds early to be more aggressive
      strongBuyThreshold = 65;
      considerThreshold = 45;
      avoidThreshold = 25;
      
      // Extra aggressive for elite/tier1 players
      if (player.tier === 'elite' || player.tier === 'tier1') {
        strongBuyThreshold -= 10;
        considerThreshold -= 10;
      }
    } else if (isInflatedMarket && hasAmpleBudget) {
      // Adjust for inflated market with budget
      strongBuyThreshold = 70;
      considerThreshold = 50;
      avoidThreshold = 30;
    } else if (isBudgetConstrained) {
      // Raise thresholds when budget constrained
      strongBuyThreshold = 80;
      considerThreshold = 65;
      avoidThreshold = 45;
    }
    
    // Check if within flexible budget
    if (currentBid <= flexibleMaxBid) {
      // Standard decision logic with adjusted thresholds
      if (compositeScore >= strongBuyThreshold || (hasGreatValue && hasCriticalNeed)) {
        return 'strong-buy';
      } else if (compositeScore >= considerThreshold || (hasGreatValue && goodBudgetFit)) {
        return 'consider';
      } else if (compositeScore >= avoidThreshold) {
        return 'avoid';
      } else {
        return 'pass';
      }
    } else if (currentBid <= flexibleMaxBid * 1.1) {
      // Within 10% over flexible max - still consider if really good
      if (compositeScore >= strongBuyThreshold + 10 || (player.tier === 'elite' && isEarlyDraft)) {
        return 'consider';
      } else {
        return 'avoid';
      }
    } else {
      // Too expensive
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

    // Robust RB Strategy warnings
    if (this.robustRBConfig.enabled) {
      const myRBs = (context.myTeam.players || []).filter(p => p.position === 'RB');
      const eliteRBCount = myRBs.filter(rb => {
        const draftPick = context.draftHistory.find(pick => 
          (pick.player?.id === rb.id || pick.player?.playerId === rb.id)
        );
        // Consider RBs drafted for $40+ as elite
        return draftPick && draftPick.price && draftPick.price >= 40;
      }).length;
      
      const draftRound = Math.floor(context.draftHistory.length / 12) + 1;
      const rbSpent = myRBs.reduce((sum, rb) => {
        const pick = context.draftHistory.find(p => p.player?.id === rb.id);
        return sum + (pick?.price || 0);
      }, 0);
      
      if (draftRound > this.robustRBConfig.firstFiveRounds && 
          eliteRBCount < this.robustRBConfig.eliteRBTarget) {
        warnings.push(`🎯 Robust RB Alert: Only ${eliteRBCount}/${this.robustRBConfig.eliteRBTarget} elite RBs secured (target 2-3 in first 5 rounds)`);
      }
      
      if (player.position !== 'RB' && eliteRBCount < 2 && draftRound <= 3) {
        warnings.push(`⚠️ Focus on RBs early - Robust RB strategy targets 50-60% budget on elite RBs`);
      }
      
      if (rbSpent > 120 && player.position === 'RB' && player.tier !== 'elite' && player.tier !== 'tier1') {
        warnings.push(`💰 Already spent $${rbSpent} on RBs - consider WR value`);
      }
    }
    
    // Tier warnings with context - Fixed tier comparison
    const remainingElite = context.availablePlayers.filter(
      p => p.tier === 'elite' || p.tier === 'tier1'
    ).length;

    if (remainingElite > 5 && player.tier !== 'elite' && player.tier !== 'tier1' && 
        player.tier !== 'tier2' && draftStage === 'early') {
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

    // Robust RB Strategy opportunities
    if (this.robustRBConfig.enabled && player.position === 'RB') {
      const myRBs = (context.myTeam.players || []).filter(p => p.position === 'RB');
      const eliteRBCount = myRBs.filter(rb => {
        const draftPick = context.draftHistory.find(pick => 
          (pick.player?.id === rb.id || pick.player?.playerId === rb.id)
        );
        // Consider RBs drafted for $40+ as elite
        return draftPick && draftPick.price && draftPick.price >= 40;
      }).length;
      
      const draftRound = Math.floor(context.draftHistory.length / 12) + 1;
      
      if ((player.tier === 'elite' || player.tier === 'tier1') && 
          eliteRBCount < this.robustRBConfig.eliteRBTarget && 
          draftRound <= this.robustRBConfig.firstFiveRounds) {
        opportunities.push(`🎯 Core Robust RB target - secure elite RB foundation`);
      }
      
      if (player.tier === 'tier2' && eliteRBCount >= 2) {
        opportunities.push(`✅ Strong RB3 to complete Robust RB build`);
      }
    }
    
    // WR value opportunity in Robust RB
    if (this.robustRBConfig.enabled && player.position === 'WR') {
      const myRBs = (context.myTeam.players || []).filter(p => p.position === 'RB');
      const eliteRBCount = myRBs.filter(rb => {
        const draftPick = context.draftHistory.find(pick => 
          (pick.player?.id === rb.id || pick.player?.playerId === rb.id)
        );
        // Consider RBs drafted for $40+ as elite
        return draftPick && draftPick.price && draftPick.price >= 40;
      }).length;
      
      if (eliteRBCount >= 2 && (player.tier === 'tier2' || player.tier === 'tier3') && 
          currentBid <= 25) {
        opportunities.push(`💎 WR value play after securing RB foundation`);
      }
    }
    
    // Value opportunity
    const discount = player.auctionValue - currentBid;
    if (discount > 10) {
      opportunities.push(`💰 $${discount} discount from fair value`);
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

    // Flex opportunity - Fixed tier comparison
    if (this.isFlexEligible(player.position) && 
        (player.tier === 'elite' || player.tier === 'tier1' || player.tier === 'tier2')) {
      opportunities.push('🔥 Strong flex play potential');
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
    // Base caps by position and tier - INCREASED for 70-80% top player spend
    const positionCaps: Record<string, number> = {
      RB: 85,  // Top RBs can go up to $85 (increased)
      WR: 70,  // Top WRs can go up to $70 (increased)
      QB: 45,  // Top QBs max around $45
      TE: 45,  // Premium TEs max around $45
      DST: 5,  // Never spend more than $5 on DST
      K: 2     // Never spend more than $2 on K
    };
    
    let globalCap = positionCaps[player.position] || 50;
    
    // Adjust based on remaining budget and roster spots
    const budgetPerSpot = remainingBudget / Math.max(1, remainingSpots);
    
    // Special handling for Robust RB strategy
    if (this.robustRBConfig.enabled && player.position === 'RB' && player.tier === 'elite') {
      // Allow spending up to 45% of total budget ($90) on elite RBs early
      const draftProgress = context.draftHistory.length / (12 * 16);
      if (draftProgress < 0.3) { // First 30% of draft
        globalCap = Math.min(90, remainingBudget * 0.55); // Up to 55% of remaining
      }
    }
    
    // Strategy pivot thresholds
    if (remainingSpots >= 10) {
      // Many spots to fill - normally cap at 30% of remaining budget
      // But for Robust RB, allow more on RBs - INCREASED
      if (this.robustRBConfig.enabled && player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1')) {
        globalCap = Math.min(globalCap, remainingBudget * 0.50); // 50% for RBs (increased)
      } else {
        globalCap = Math.min(globalCap, remainingBudget * 0.30);
      }
    } else if (remainingSpots >= 5) {
      // Some spots to fill - cap at 40% of remaining budget
      if (this.robustRBConfig.enabled && player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1')) {
        globalCap = Math.min(globalCap, remainingBudget * 0.60); // 60% for RBs (increased)
      } else {
        globalCap = Math.min(globalCap, remainingBudget * 0.40);
      }
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
        // First pick - for Robust RB allow up to 40% on elite RBs
        if (this.robustRBConfig.enabled && player.position === 'RB' && player.tier === 'elite') {
          const budgetCap = context.totalBudget * 0.40; // $80 for elite RBs
          globalCap = Math.min(globalCap, budgetCap);
        } else {
          const budgetCap = context.totalBudget * 0.30;
          globalCap = Math.min(globalCap, budgetCap);
        }
      } else if (picksCompleted <= 2) {
        // Early picks - Robust RB should continue being aggressive
        if (this.robustRBConfig.enabled && player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1')) {
          // Allow continued high spending on RBs
          globalCap = Math.min(globalCap, remainingBudget * 0.45);
        } else if (mySpentSoFar > context.totalBudget * 0.30) {
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
    
    // Count quality players remaining - Fixed tier comparison
    const qualityRemaining = context.availablePlayers.filter(
      p => p.position === position && (p.tier === 'elite' || p.tier === 'tier1' || p.tier === 'tier2')
    ).length;
    
    // Calculate how many picks until it's likely our turn again
    const teamsCount = context.allTeams.length;
    const picksUntilTurn = Math.floor(teamsCount / 2);
    
    // High panic if we need players and few quality options remain
    if (stillNeeded > 0 && qualityRemaining <= picksUntilTurn) {
      // Cap panic level at 1.0
      return Math.min(1.0, stillNeeded / qualityRemaining);
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

  /**
   * Calculate budget advantage compared to other teams
   */
  private calculateBudgetAdvantage(context: DraftContext): BudgetAdvantage {
    try {
      const myBudget = context.myTeam?.budget || 200;
      const otherTeams = (context.allTeams || []).filter(t => t.id !== context.myTeam?.id);
      
      if (!otherTeams || otherTeams.length === 0) {
        return {
          myBudget,
          averageBudget: myBudget,
          advantage: 0,
          percentile: 50,
          canDominate: false
        };
      }
      
      const otherBudgets = otherTeams.map(t => t.budget || 0);
      const averageBudget = otherBudgets.length > 0 
        ? otherBudgets.reduce((sum, b) => sum + b, 0) / otherBudgets.length
        : myBudget;
      const advantage = myBudget - averageBudget;
      
      // Calculate percentile
      const betterThan = otherBudgets.filter(b => b < myBudget).length;
      const percentile = otherBudgets.length > 0 
        ? Math.round((betterThan / otherBudgets.length) * 100)
        : 50;
      
      // Can dominate if 20% more budget than average
      const canDominate = myBudget > averageBudget * 1.2;
      
      return {
        myBudget,
        averageBudget: Math.round(averageBudget),
        advantage: Math.round(advantage),
        percentile,
        canDominate
      };
    } catch (error) {
      console.error('[BudgetAdvantage Error]', error);
      return {
        myBudget: 200,
        averageBudget: 200,
        advantage: 0,
        percentile: 50,
        canDominate: false
      };
    }
  }

  /**
   * Calculate draft progress and phase
   */
  private calculateDraftProgress(context: DraftContext): DraftProgress {
    try {
      const teamsCount = (context.allTeams || []).length || 12;
      const totalSpots = teamsCount * 16; // 16 players per team
      const picksMade = (context.draftHistory || []).length;
      const percentComplete = totalSpots > 0 
        ? Math.round((picksMade / totalSpots) * 100)
        : 0;
      const isHalfway = picksMade >= totalSpots / 2;
      
      let phase: 'early' | 'mid' | 'late' | 'end';
      if (percentComplete < 25) phase = 'early';
      else if (percentComplete < 50) phase = 'mid';
      else if (percentComplete < 75) phase = 'late';
      else phase = 'end';
      
      return {
        totalPicks: totalSpots,
        picksMade,
        percentComplete,
        isHalfway,
        phase
      };
    } catch (error) {
      console.error('[DraftProgress Error]', error);
      return {
        totalPicks: 192,
        picksMade: 0,
        percentComplete: 0,
        isHalfway: false,
        phase: 'early'
      };
    }
  }

  /**
   * Check if strategy pivot is needed due to market conditions
   */
  private checkStrategyPivot(
    player: ValuationResult,
    context: DraftContext,
    marketInflation: number
  ): { shouldPivot: boolean; newStrategy: 'robust-rb' | 'hero-rb' | 'zero-rb' | 'balanced'; alert?: string } {
    try {
      // Don't pivot if already pivoted
      if (this.strategyPivoted) {
        return { shouldPivot: false, newStrategy: this.activeStrategy };
      }
    
    // Calculate RB inflation from both draft history AND current market
    const historicalInflation = this.calculatePositionInflation('RB', context);
    
    // NEW: Also check current market prices of available elite RBs
    const availableEliteRBs = context.availablePlayers.filter(
      p => p.position === 'RB' && (p.tier === 'elite' || p.tier === 'tier1')
    );
    
    let currentMarketInflation = 0;
    if (availableEliteRBs.length > 0) {
      const avgMarketPrice = availableEliteRBs.reduce((sum, p) => sum + (p.marketValue || 0), 0) / availableEliteRBs.length;
      const avgIntrinsicValue = availableEliteRBs.reduce((sum, p) => sum + (p.intrinsicValue || p.auctionValue || 0), 0) / availableEliteRBs.length;
      if (avgIntrinsicValue > 0) {
        currentMarketInflation = ((avgMarketPrice - avgIntrinsicValue) / avgIntrinsicValue) * 100;
      }
    }
    
    // Use the higher of historical or current market inflation
    const rbInflation = Math.max(historicalInflation, currentMarketInflation);
    
    const myRBs = (context.myTeam.players || []).filter(p => p.position === 'RB');
    const eliteRBCount = myRBs.filter(rb => {
      const draftPick = context.draftHistory.find(pick => 
        pick.player && rb && (
          (pick.player.id && pick.player.id === (rb as any).id) || 
          ((pick.player as any).playerId && (pick.player as any).playerId === (rb as any).id)
        )
      );
      // If drafted for > $40, likely elite/tier1
      return draftPick && draftPick.price && draftPick.price >= 40;
    }).length;
    
    // NEW: Check if we're being priced out of the RB market
    const myBudget = context.myTeam.budget || 0;
    const cheapestEliteRB = availableEliteRBs.sort((a, b) => (a.marketValue || 0) - (b.marketValue || 0))[0];
    const cantAffordEliteRB = cheapestEliteRB && (cheapestEliteRB.marketValue || 0) > myBudget * 0.35;
    
    // Pivot conditions - now more sensitive to market conditions
    if (this.activeStrategy === 'robust-rb') {
      const draftProgress = this.calculateDraftProgress(context);
      
      // Condition 1: RBs are inflated AND we haven't secured any elite RBs yet
      if (rbInflation > 20 && eliteRBCount === 0) {
        if (draftProgress.percentComplete < 25) {
          return {
            shouldPivot: true,
            newStrategy: 'hero-rb',
            alert: `🔄 STRATEGY PIVOT: RBs inflated +${Math.round(rbInflation)}% - switching to Hero RB (one elite RB + WR depth)`
          };
        } else if (draftProgress.percentComplete < 50) {
          return {
            shouldPivot: true,
            newStrategy: 'zero-rb',
            alert: `🔄 STRATEGY PIVOT: RBs too expensive (+${Math.round(rbInflation)}%) - switching to Zero RB (load up on WRs)`
          };
        }
      }
      
      // Condition 2: Can't afford elite RBs anymore
      if (cantAffordEliteRB && eliteRBCount === 0 && draftProgress.percentComplete < 40) {
        return {
          shouldPivot: true,
          newStrategy: 'zero-rb',
          alert: '🔄 STRATEGY PIVOT: Priced out of elite RB market - switching to Zero RB for value'
        };
      }
      
      // Condition 3: Too many teams hoarding elite RBs
      const teamsWithMultipleEliteRBs = context.allTeams.filter(team => {
        if (team.id === context.myTeam.id) return false;
        const teamRBs = team.players?.filter(p => p.position === 'RB') || [];
        const eliteCount = teamRBs.filter(rb => {
          const draftPick = context.draftHistory.find(pick => 
            pick.team === team.id && 
            pick.player?.position === 'RB' &&
            (pick.price || 0) >= 40
          );
          return draftPick != null;
        }).length;
        return eliteCount >= 2;
      }).length;
      
      if (teamsWithMultipleEliteRBs >= 3 && eliteRBCount === 0 && availableEliteRBs.length <= 2) {
        return {
          shouldPivot: true,
          newStrategy: 'zero-rb',
          alert: `🚨 Market Alert: ${teamsWithMultipleEliteRBs} teams hoarding elite RBs - pivot to Zero RB for value`
        };
      }
    }
    
      return { shouldPivot: false, newStrategy: this.activeStrategy };
    } catch (error) {
      console.error('[StrategyPivot Error]', error);
      return { shouldPivot: false, newStrategy: this.activeStrategy };
    }
  }

  /**
   * Calculate inflation for a specific position
   */
  private calculatePositionInflation(position: string, context: DraftContext): number {
    const positionPicks = context.draftHistory.filter(
      pick => pick.player?.position === position && pick.price
    );
    
    if (positionPicks.length === 0) return 0;
    
    let totalExpected = 0;
    let totalActual = 0;
    
    positionPicks.forEach(pick => {
      const playerId = pick.player?.id || pick.player?.playerId;
      const originalValue = this.originalValuations.get(playerId);
      if (originalValue) {
        totalExpected += originalValue;
        totalActual += pick.price || 0;
      }
    });
    
    if (totalExpected === 0) return 0;
    
    return Math.round(((totalActual - totalExpected) / totalExpected) * 100);
  }
}

export const bidAdvisorService = new BidAdvisorService();