import type { 
  PlayerProjection, 
  Position, 
  LeagueSettings,
  DepthChartEntry
} from '@/types';
import { getPositionVariance, getInjuryRate } from '@/lib/utils/positions';

interface BEERCalculation {
  playerId: string;
  beer: number;
  vols: number;
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  confidenceInterval: { lower: number; upper: number };
}

export class EnhancedVORPEngine {
  private leagueSettings: LeagueSettings;
  private replacementLevels: Map<Position, number> = new Map();
  private volsThresholds: Map<Position, number> = new Map();
  
  constructor(leagueSettings: LeagueSettings) {
    this.leagueSettings = leagueSettings;
  }

  calculateBEERPlus(
    players: PlayerProjection[],
    depthCharts: Map<string, DepthChartEntry>,
    marketPrices: Map<string, number>
  ): Map<string, BEERCalculation> {
    const results = new Map<string, BEERCalculation>();
    
    // Calculate replacement levels and VOLS thresholds
    this.calculateReplacementLevels(players);
    this.calculateVOLSThresholds(players);
    
    for (const player of players) {
      const depthEntry = depthCharts.get(`${player.name.toLowerCase()}_${player.position}`);
      const marketPrice = marketPrices.get(player.id) || player.adp || 1;
      
      // Calculate expected return (VORP-based)
      const replacementLevel = this.replacementLevels.get(player.position) || 0;
      const vorp = Math.max(0, player.points - replacementLevel);
      
      // Calculate VOLS (Value Over Last Starter)
      const volsThreshold = this.volsThresholds.get(player.position) || 0;
      const vols = Math.max(0, player.points - volsThreshold);
      
      // Risk calculation with multiple factors
      const positionVariance = getPositionVariance(player.position);
      const injuryRate = getInjuryRate(player.position);
      const depthRisk = this.calculateDepthRisk(depthEntry);
      const ageRisk = this.calculateAgeRisk(player);
      
      const baseRisk = positionVariance * 0.4 + injuryRate * 0.3 + 
                      depthRisk * 0.2 + ageRisk * 0.1;
      
      // Confidence adjustment
      const confidence = player.confidence || 0.5;
      const risk = baseRisk * (2 - confidence);
      
      // Expected return adjusted for opportunity cost
      const opportunityCost = marketPrice * 0.05; // 5% required return
      const expectedReturn = vorp - opportunityCost;
      
      // Sharpe Ratio calculation
      const sharpeRatio = risk > 0 ? expectedReturn / risk : 0;
      
      // BEER calculation (Best Expected Excess Return)
      const beer = expectedReturn * confidence - risk * marketPrice * 0.1;
      
      // Confidence interval using z-score (95% confidence)
      const zScore = 1.96;
      const stdError = risk / Math.sqrt(100); // Assume 100 simulations
      const confidenceInterval = {
        lower: beer - zScore * stdError,
        upper: beer + zScore * stdError
      };
      
      results.set(player.id, {
        playerId: player.id,
        beer,
        vols,
        expectedReturn,
        risk,
        sharpeRatio,
        confidenceInterval
      });
    }
    
    return results;
  }
  
  private calculateReplacementLevels(players: PlayerProjection[]): void {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];
    
    for (const position of positions) {
      const positionPlayers = players
        .filter(p => p.position === position)
        .sort((a, b) => b.points - a.points);
      
      // Replacement level = average of players ranked n+1 to n+3
      // where n = number of starters at position
      const starterCount = this.getStarterCount(position);
      const replacementPlayers = positionPlayers.slice(
        starterCount, 
        starterCount + 3
      );
      
      if (replacementPlayers.length > 0) {
        const avgPoints = replacementPlayers.reduce(
          (sum, p) => sum + p.points, 0
        ) / replacementPlayers.length;
        this.replacementLevels.set(position, avgPoints);
      }
    }
  }
  
  private calculateVOLSThresholds(players: PlayerProjection[]): void {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];
    
    for (const position of positions) {
      const positionPlayers = players
        .filter(p => p.position === position)
        .sort((a, b) => b.points - a.points);
      
      const starterCount = this.getStarterCount(position);
      const lastStarter = positionPlayers[starterCount - 1];
      
      if (lastStarter) {
        this.volsThresholds.set(position, lastStarter.points);
      }
    }
  }
  
  private getStarterCount(position: Position): number {
    const leagueSize = 12; // Assuming 12-team league
    const positionStarters: Record<Position, number> = {
      QB: 12,  // 1 QB per team
      RB: 24,  // 2 RBs per team
      WR: 36,  // 3 WRs per team
      TE: 12,  // 1 TE per team
      DST: 12,
      K: 12
    };
    return positionStarters[position] || 12;
  }
  
  private calculateDepthRisk(depthEntry?: DepthChartEntry): number {
    if (!depthEntry) return 0.5; // Unknown depth
    
    const depthRisks: Record<number, number> = {
      1: 0.1,  // Starter - low risk
      2: 0.3,  // Backup - moderate risk
      3: 0.5,  // Third string - high risk
      4: 0.7,  // Fourth string - very high risk
    };
    
    return depthRisks[depthEntry.depthOrder] || 0.8;
  }
  
  private calculateAgeRisk(player: PlayerProjection): number {
    // Age-based risk calculation would require age data
    // For now, use a placeholder based on experience
    // This would be enhanced with actual age data
    return 0.3; // Default moderate risk
  }
}