import type { 
  PlayerADP, 
  PlayerProjection,
  Team,
  DraftPick,
  PriceFeatures
} from '@/types';

interface MarketState {
  inflationRate: number;
  positionScarcity: Map<string, number>;
  remainingBudgets: Map<string, number>;
  draftProgress: number;
  recentPrices: DraftPick[];
  nominationOrder: number;
}

export class MarketPriceModel {
  private marketState: MarketState;
  private priceHistory: DraftPick[] = [];
  private kalmanState = { estimate: 1.0, errorCovariance: 1.0 };
  private readonly processNoise = 0.01;
  private readonly measurementNoise = 0.1;
  
  constructor() {
    this.marketState = {
      inflationRate: 1.0,
      positionScarcity: new Map(),
      remainingBudgets: new Map(),
      draftProgress: 0,
      recentPrices: [],
      nominationOrder: 0
    };
  }

  predictMarketPrice(
    player: PlayerProjection & Partial<PlayerADP>,
    teams: Team[],
    draftHistory: DraftPick[],
    remainingPlayers: PlayerProjection[]
  ): { price: number; confidence: number; features: PriceFeatures } {
    this.updateMarketState(teams, draftHistory, remainingPlayers);
    
    const features = this.extractFeatures(player, teams, remainingPlayers);
    
    const basePrice = this.calculateBasePrice(player, features);
    
    const adjustedPrice = this.applyBayesianAdjustment(basePrice, features);
    
    const confidence = this.calculateConfidence(features, draftHistory.length);
    
    return {
      price: Math.max(1, Math.round(adjustedPrice)),
      confidence,
      features
    };
  }

  private updateMarketState(
    teams: Team[],
    draftHistory: DraftPick[],
    remainingPlayers: PlayerProjection[]
  ) {
    for (const team of teams) {
      this.marketState.remainingBudgets.set(team.id, team.budget - team.spent);
    }
    
    this.marketState.draftProgress = draftHistory.length / 
      (draftHistory.length + remainingPlayers.length);
    
    this.marketState.recentPrices = draftHistory.slice(-10);
    
    this.updateInflation(draftHistory);
    
    this.updatePositionScarcity(remainingPlayers);
    
    this.marketState.nominationOrder = draftHistory.length;
  }

  private updateInflation(draftHistory: DraftPick[]) {
    if (draftHistory.length < 5) {
      this.marketState.inflationRate = 1.0;
      return;
    }
    
    const recentPicks = draftHistory.slice(-5);
    const expectedSum = recentPicks.reduce((sum, pick) => {
      const aav = (pick.player as any).auctionValue || 10;
      return sum + aav;
    }, 0);
    
    const actualSum = recentPicks.reduce((sum, pick) => sum + pick.price, 0);
    
    const observedInflation = actualSum / Math.max(1, expectedSum);
    
    this.kalmanState.errorCovariance += this.processNoise;
    
    const kalmanGain = this.kalmanState.errorCovariance / 
      (this.kalmanState.errorCovariance + this.measurementNoise);
    
    this.kalmanState.estimate += kalmanGain * 
      (observedInflation - this.kalmanState.estimate);
    
    this.kalmanState.errorCovariance *= (1 - kalmanGain);
    
    this.marketState.inflationRate = this.kalmanState.estimate;
  }

  private updatePositionScarcity(remainingPlayers: PlayerProjection[]) {
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    
    for (const pos of positions) {
      const positionPlayers = remainingPlayers.filter(p => p.position === pos);
      const top12 = positionPlayers
        .sort((a, b) => b.projectedPoints - a.projectedPoints)
        .slice(0, 12);
      
      const avgProjected = top12.reduce((sum, p) => sum + p.projectedPoints, 0) / 
        Math.max(1, top12.length);
      
      const scarcityScore = Math.max(0.5, Math.min(2.0, 
        1.0 + (150 - avgProjected) / 100
      ));
      
      this.marketState.positionScarcity.set(pos, scarcityScore);
    }
  }

  private extractFeatures(
    player: PlayerProjection & Partial<PlayerADP>,
    teams: Team[],
    remainingPlayers: PlayerProjection[]
  ): PriceFeatures {
    const aav = player.auctionValue || 10;
    const logAAV = Math.log(Math.max(1, aav));
    
    const adpTier = this.calculateADPTier(player.adp || 200);
    
    // Calculate remaining budget with validation
    const totalRemainingBudget = teams.reduce((sum, team) => {
      const remaining = Math.max(0, team.budget - team.spent);
      return sum + remaining;
    }, 0);
    
    // Calculate remaining starters with proper floor
    const totalStarterSlots = teams.length * 9; // QB, 2RB, 2WR, TE, FLEX, DST, K
    const draftedStarters = this.priceHistory.filter((p: any) => {
      // All drafted players count as starters for budget purposes
      return true;
    }).length;
    const remainingStarters = Math.max(1, totalStarterSlots - draftedStarters);
    
    // Safe division
    const moneyPerStarter = totalRemainingBudget / remainingStarters;
    
    // Calculate inflation with bounds
    const inflationState = Math.max(0.5, Math.min(2.0, this.marketState.inflationRate));
    
    const nominationEffect = this.calculateNominationEffect();
    const daysToSeason = Math.max(0, this.calculateDaysToSeason());
    
    // Position scarcity with default
    const positionScarcity = this.marketState.positionScarcity.get(player.position) || 1.0;
    
    const recentTrend = this.calculateRecentTrend(player.position);
    
    return {
      logAAV,
      adpTier,
      moneyPerStarter: Math.max(1, moneyPerStarter), // Ensure minimum value
      inflationState,
      nominationEffect,
      daysToSeason,
      positionScarcity: Math.max(0.5, Math.min(2.0, positionScarcity)),
      recentTrend: Math.max(0.5, Math.min(2.0, recentTrend))
    };
  }

  private calculateADPTier(adp: number): number {
    if (adp <= 12) return 5;
    if (adp <= 24) return 4;
    if (adp <= 48) return 3;
    if (adp <= 96) return 2;
    if (adp <= 150) return 1;
    return 0;
  }

  private calculateNominationEffect(): number {
    const progress = this.marketState.draftProgress;
    
    if (progress < 0.1) return 1.1;
    if (progress < 0.3) return 1.05;
    if (progress > 0.8) return 0.9;
    
    return 1.0;
  }

  private calculateDaysToSeason(): number {
    const today = new Date();
    const seasonStart = new Date(today.getFullYear(), 8, 7);
    const days = Math.max(0, 
      (seasonStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  }

  private calculateRecentTrend(position: string): number {
    const recentSamePosition = this.marketState.recentPrices.filter(
      p => p.player.position === position
    );
    
    if (recentSamePosition.length < 2) return 1.0;
    
    const avgRecent = recentSamePosition.reduce((sum, p) => sum + p.price, 0) / 
      recentSamePosition.length;
    
    const expectedAvg = recentSamePosition.reduce((sum, p) => {
      const aav = (p.player as any).auctionValue || 10;
      return sum + aav;
    }, 0) / recentSamePosition.length;
    
    return avgRecent / Math.max(1, expectedAvg);
  }

  private calculateBasePrice(
    player: PlayerProjection & Partial<PlayerADP>,
    features: PriceFeatures
  ): number {
    // Updated coefficients based on historical data analysis
    const coefficients = {
      intercept: 2.3,        // Reduced from 2.5
      logAAV: 0.90,         // Increased from 0.85 for stronger AAV influence
      adpTier: 0.12,        // Reduced from 0.15
      moneyPerStarter: 0.0025, // Increased from 0.002
      inflationState: 0.25,  // Reduced from 0.3
      nominationEffect: 0.08, // Reduced from 0.1
      daysToSeason: -0.001,
      positionScarcity: 0.18, // Reduced from 0.2
      recentTrend: 0.12      // Reduced from 0.15
    };
    
    let logPrice = coefficients.intercept;
    logPrice += coefficients.logAAV * features.logAAV;
    logPrice += coefficients.adpTier * features.adpTier;
    logPrice += coefficients.moneyPerStarter * features.moneyPerStarter;
    logPrice += coefficients.inflationState * (features.inflationState - 1);
    logPrice += coefficients.nominationEffect * (features.nominationEffect - 1);
    logPrice += coefficients.daysToSeason * features.daysToSeason;
    logPrice += coefficients.positionScarcity * (features.positionScarcity - 1);
    logPrice += coefficients.recentTrend * (features.recentTrend - 1);
    
    return Math.exp(logPrice);
  }

  private applyBayesianAdjustment(
    basePrice: number,
    features: PriceFeatures
  ): number {
    const priorWeight = Math.max(0.3, 1 - this.marketState.draftProgress);
    
    const observedWeight = 1 - priorWeight;
    
    const tierPrior = this.getTierPrior(features.adpTier);
    
    const observedAdjustment = features.inflationState * features.recentTrend;
    
    const adjustmentFactor = (priorWeight * 1.0) + 
      (observedWeight * observedAdjustment);
    
    return basePrice * adjustmentFactor * tierPrior;
  }

  private getTierPrior(tier: number): number {
    // Return values between 0.8 and 1.2 for tier adjustment
    // Higher tier (lower number) = higher multiplier
    const tierMultipliers = [1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.8];
    const index = Math.min(Math.max(0, tier - 1), tierMultipliers.length - 1);
    return tierMultipliers[index] || 1.0;
  }

  private calculateConfidence(features: PriceFeatures, historySize: number): number {
    let confidence = 0.5; // Base confidence
    
    // More drafted players = more confidence
    confidence += Math.min(0.3, historySize / 50 * 0.3);
    
    // Inflation stability
    const inflationStability = 1 - Math.abs(features.inflationState - 1);
    confidence += inflationStability * 0.1;
    
    // Recent trend stability
    const trendStability = 1 - Math.abs(features.recentTrend - 1);
    confidence += trendStability * 0.1;
    
    // Data completeness (if we have ADP data)
    if (features.logAAV > 0) confidence += 0.05;
    
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  updatePriceHistory(pick: DraftPick) {
    this.priceHistory.push(pick);
    
    if (this.priceHistory.length > 50) {
      this.priceHistory = this.priceHistory.slice(-50);
    }
  }
}