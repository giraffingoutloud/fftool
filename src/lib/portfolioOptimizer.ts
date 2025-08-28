import type { PlayerValuation, Position, Team } from '@/types';

interface PortfolioAsset {
  playerId: string;
  expectedReturn: number;
  risk: number;
  weight: number;
  position: Position;
}

interface CorrelationMatrix {
  matrix: number[][];
  assets: string[];
}

interface OptimizationResult {
  portfolio: PortfolioAsset[];
  expectedReturn: number;
  portfolioRisk: number;
  sharpeRatio: number;
  diversificationRatio: number;
  constraints: {
    budgetUsed: number;
    positionCounts: Map<Position, number>;
  };
}

export class PortfolioOptimizer {
  private riskFreeRate: number;
  private confidenceLevel: number;
  
  constructor(riskFreeRate: number = 0.02, confidenceLevel: number = 0.95) {
    this.riskFreeRate = riskFreeRate;
    this.confidenceLevel = confidenceLevel;
  }
  
  optimize(
    players: PlayerValuation[],
    correlations: CorrelationMatrix,
    constraints: {
      budget: number;
      minPositions: Map<Position, number>;
      maxPositions: Map<Position, number>;
      currentTeam?: Team;
    }
  ): OptimizationResult {
    // Convert players to portfolio assets
    const assets = this.playersToAssets(players);
    
    // Calculate optimal weights using Markowitz optimization
    const weights = this.calculateOptimalWeights(
      assets,
      correlations,
      constraints
    );
    
    // Apply Black-Litterman adjustments based on views
    const adjustedWeights = this.applyBlackLitterman(
      weights,
      assets,
      correlations
    );
    
    // Calculate portfolio metrics
    const metrics = this.calculatePortfolioMetrics(
      assets,
      adjustedWeights,
      correlations
    );
    
    return metrics;
  }
  
  private playersToAssets(players: PlayerValuation[]): PortfolioAsset[] {
    return players.map(player => ({
      playerId: player.id,
      expectedReturn: (player.intrinsicValue - player.marketPrice) / player.marketPrice,
      risk: this.calculatePlayerRisk(player),
      weight: 0,
      position: player.position
    }));
  }
  
  private calculatePlayerRisk(player: PlayerValuation): number {
    // Base risk from position
    const positionRisks: Record<Position, number> = {
      QB: 0.15,
      RB: 0.35,
      WR: 0.30,
      TE: 0.25,
      DST: 0.20,
      K: 0.10
    };
    
    let risk = positionRisks[player.position] || 0.25;
    
    // Adjust for confidence
    const confidenceAdjustment = 2 - (player.confidence || 0.5);
    risk *= confidenceAdjustment;
    
    // Adjust for injury risk
    if (player.injuryStatus && player.injuryStatus !== 'healthy') {
      risk *= 1.5;
    }
    
    return risk;
  }
  
  private calculateOptimalWeights(
    assets: PortfolioAsset[],
    correlations: CorrelationMatrix,
    constraints: {
      budget: number;
      minPositions: Map<Position, number>;
      maxPositions: Map<Position, number>;
      currentTeam?: Team;
    }
  ): number[] {
    const n = assets.length;
    const weights = new Array(n).fill(0);
    
    // Simplified mean-variance optimization
    // In practice, would use quadratic programming solver
    
    // Start with equal weights
    const initialWeight = 1 / n;
    for (let i = 0; i < n; i++) {
      weights[i] = initialWeight;
    }
    
    // Gradient descent optimization
    const learningRate = 0.01;
    const iterations = 1000;
    
    for (let iter = 0; iter < iterations; iter++) {
      const gradient = this.calculateGradient(
        weights,
        assets,
        correlations
      );
      
      // Update weights
      for (let i = 0; i < n; i++) {
        weights[i] -= learningRate * gradient[i];
        weights[i] = Math.max(0, Math.min(1, weights[i])); // Bound between 0 and 1
      }
      
      // Normalize to sum to 1
      const sum = weights.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (let i = 0; i < n; i++) {
          weights[i] /= sum;
        }
      }
      
      // Apply position constraints
      weights.forEach((w, i) => {
        const position = assets[i].position;
        const minCount = constraints.minPositions.get(position) || 0;
        const maxCount = constraints.maxPositions.get(position) || Infinity;
        
        // Simple constraint: zero out if violates position limits
        const positionCount = assets.filter((a, j) => 
          a.position === position && weights[j] > 0.01
        ).length;
        
        if (positionCount > maxCount) {
          weights[i] = 0;
        }
      });
    }
    
    return weights;
  }
  
  private calculateGradient(
    weights: number[],
    assets: PortfolioAsset[],
    correlations: CorrelationMatrix
  ): number[] {
    const n = weights.length;
    const gradient = new Array(n).fill(0);
    
    // Portfolio return
    const portfolioReturn = weights.reduce(
      (sum, w, i) => sum + w * assets[i].expectedReturn, 0
    );
    
    // Portfolio variance
    let portfolioVariance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const corr = this.getCorrelation(
          correlations,
          assets[i].playerId,
          assets[j].playerId
        );
        portfolioVariance += weights[i] * weights[j] * 
                           assets[i].risk * assets[j].risk * corr;
      }
    }
    
    // Gradient of Sharpe ratio
    const sharpe = (portfolioReturn - this.riskFreeRate) / Math.sqrt(portfolioVariance);
    
    for (let i = 0; i < n; i++) {
      // Partial derivative of Sharpe ratio
      const returnGradient = assets[i].expectedReturn;
      
      let varianceGradient = 0;
      for (let j = 0; j < n; j++) {
        const corr = this.getCorrelation(
          correlations,
          assets[i].playerId,
          assets[j].playerId
        );
        varianceGradient += 2 * weights[j] * assets[i].risk * assets[j].risk * corr;
      }
      
      gradient[i] = -returnGradient / Math.sqrt(portfolioVariance) +
                   (portfolioReturn - this.riskFreeRate) * varianceGradient /
                   (2 * Math.pow(portfolioVariance, 1.5));
    }
    
    return gradient;
  }
  
  private getCorrelation(
    correlations: CorrelationMatrix,
    asset1: string,
    asset2: string
  ): number {
    if (asset1 === asset2) return 1;
    
    const i = correlations.assets.indexOf(asset1);
    const j = correlations.assets.indexOf(asset2);
    
    if (i === -1 || j === -1) {
      // Default correlation based on positions
      return 0.3; // Placeholder
    }
    
    return correlations.matrix[i][j];
  }
  
  private applyBlackLitterman(
    weights: number[],
    assets: PortfolioAsset[],
    correlations: CorrelationMatrix
  ): number[] {
    // Simplified Black-Litterman adjustment
    const tau = 0.05; // Uncertainty in prior
    const adjustedWeights = [...weights];
    
    // Apply views (e.g., certain players are undervalued)
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      
      // View: High confidence players should have higher weight
      if (asset.expectedReturn > 0.2) {
        adjustedWeights[i] *= 1.2;
      }
      
      // View: Injury risk players should have lower weight
      // (Would need injury data in asset structure)
      
      // View: Position scarcity adjustment
      if (asset.position === 'RB' || asset.position === 'TE') {
        adjustedWeights[i] *= 1.1;
      }
    }
    
    // Renormalize
    const sum = adjustedWeights.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (let i = 0; i < adjustedWeights.length; i++) {
        adjustedWeights[i] /= sum;
      }
    }
    
    return adjustedWeights;
  }
  
  private calculatePortfolioMetrics(
    assets: PortfolioAsset[],
    weights: number[],
    correlations: CorrelationMatrix
  ): OptimizationResult {
    // Update asset weights
    const portfolio = assets.map((asset, i) => ({
      ...asset,
      weight: weights[i]
    })).filter(a => a.weight > 0.01); // Only include significant weights
    
    // Expected return
    const expectedReturn = portfolio.reduce(
      (sum, a) => sum + a.weight * a.expectedReturn, 0
    );
    
    // Portfolio risk
    let portfolioVariance = 0;
    for (let i = 0; i < portfolio.length; i++) {
      for (let j = 0; j < portfolio.length; j++) {
        const corr = this.getCorrelation(
          correlations,
          portfolio[i].playerId,
          portfolio[j].playerId
        );
        portfolioVariance += portfolio[i].weight * portfolio[j].weight *
                           portfolio[i].risk * portfolio[j].risk * corr;
      }
    }
    const portfolioRisk = Math.sqrt(portfolioVariance);
    
    // Sharpe ratio
    const sharpeRatio = (expectedReturn - this.riskFreeRate) / portfolioRisk;
    
    // Diversification ratio
    const weightedAvgRisk = portfolio.reduce(
      (sum, a) => sum + a.weight * a.risk, 0
    );
    const diversificationRatio = weightedAvgRisk / portfolioRisk;
    
    // Position counts
    const positionCounts = new Map<Position, number>();
    for (const asset of portfolio) {
      positionCounts.set(
        asset.position,
        (positionCounts.get(asset.position) || 0) + 1
      );
    }
    
    // Budget used (would need prices in assets)
    const budgetUsed = portfolio.reduce((sum, a) => sum + a.weight * 100, 0);
    
    return {
      portfolio,
      expectedReturn,
      portfolioRisk,
      sharpeRatio,
      diversificationRatio,
      constraints: {
        budgetUsed,
        positionCounts
      }
    };
  }
  
  calculateCorrelations(
    players: PlayerValuation[],
    historicalData?: Map<string, number[]>
  ): CorrelationMatrix {
    const n = players.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const assets = players.map(p => p.id);
    
    // Calculate correlations
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          // Position-based correlation
          const samePosition = players[i].position === players[j].position;
          const sameTeam = players[i].team === players[j].team;
          
          let correlation = 0.2; // Base correlation
          if (samePosition) correlation += 0.3;
          if (sameTeam) correlation += 0.2;
          
          // Adjust based on historical data if available
          if (historicalData) {
            const data1 = historicalData.get(players[i].id);
            const data2 = historicalData.get(players[j].id);
            if (data1 && data2) {
              correlation = this.pearsonCorrelation(data1, data2);
            }
          }
          
          matrix[i][j] = correlation;
        }
      }
    }
    
    return { matrix, assets };
  }
  
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    
    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  }
}