import type { PlayerProjection, Position } from '@/types';

interface SimulationResult {
  playerId: string;
  mean: number;
  median: number;
  std: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  distribution: number[];
  skewness: number;
  kurtosis: number;
}

export class AdvancedMonteCarloEngine {
  private iterations: number;
  
  constructor(iterations: number = 10000) {
    this.iterations = iterations;
  }
  
  runSimulations(players: PlayerProjection[]): Map<string, SimulationResult> {
    const results = new Map<string, SimulationResult>();
    
    for (const player of players) {
      const distribution = this.simulatePlayerPerformance(player);
      const result = this.analyzeDistribution(player.id, distribution);
      results.set(player.id, result);
    }
    
    return results;
  }
  
  private simulatePlayerPerformance(player: PlayerProjection): number[] {
    const samples: number[] = [];
    const basePoints = player.points;
    
    // Select distribution based on position
    const distributionType = this.getDistributionType(player.position);
    
    for (let i = 0; i < this.iterations; i++) {
      let sample: number;
      
      switch (distributionType) {
        case 'gamma':
          sample = this.sampleGamma(basePoints, player.position);
          break;
        case 'lognormal':
          sample = this.sampleLogNormal(basePoints, player.position);
          break;
        case 'weibull':
          sample = this.sampleWeibull(basePoints, player.position);
          break;
        default:
          sample = this.sampleNormal(basePoints, player.position);
      }
      
      // Apply injury probability
      const injuryMultiplier = this.getInjuryMultiplier(player.position);
      if (Math.random() < injuryMultiplier.probability) {
        sample *= injuryMultiplier.impact;
      }
      
      // Apply boom/bust adjustment
      const boomBust = this.getBoomBustAdjustment(player);
      sample *= boomBust;
      
      samples.push(Math.max(0, sample));
    }
    
    return samples;
  }
  
  private getDistributionType(position: Position): string {
    // Position-specific distribution selection
    const distributions: Record<Position, string> = {
      QB: 'normal',     // QBs are most consistent
      RB: 'gamma',      // RBs have right-skewed distributions
      WR: 'lognormal',  // WRs have high variance, boom/bust
      TE: 'weibull',    // TEs have reliability-based distributions
      DST: 'normal',
      K: 'normal'
    };
    return distributions[position] || 'normal';
  }
  
  private sampleGamma(mean: number, position: Position): number {
    // Gamma distribution for right-skewed outcomes
    const shape = this.getShapeParameter(position);
    const scale = mean / shape;
    
    // Using Marsaglia and Tsang method for gamma sampling
    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      const x = this.standardNormal();
      const v = Math.pow(1 + c * x, 3);
      if (v > 0) {
        const u = Math.random();
        if (u < 1 - 0.0331 * Math.pow(x, 4)) {
          return d * v * scale;
        }
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v * scale;
        }
      }
    }
  }
  
  private sampleLogNormal(mean: number, position: Position): number {
    // Log-normal distribution for boom/bust players
    const variance = this.getVariance(position);
    const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean));
    const sigma = Math.sqrt(Math.log(1 + variance / (mean * mean)));
    
    const normal = this.standardNormal();
    return Math.exp(mu + sigma * normal);
  }
  
  private sampleWeibull(mean: number, position: Position): number {
    // Weibull distribution for reliability modeling
    const shape = this.getWeibullShape(position);
    const scale = mean / this.gamma(1 + 1/shape);
    
    const u = Math.random();
    return scale * Math.pow(-Math.log(1 - u), 1/shape);
  }
  
  private sampleNormal(mean: number, position: Position): number {
    const std = Math.sqrt(this.getVariance(position)) * mean;
    return mean + this.standardNormal() * std;
  }
  
  private standardNormal(): number {
    // Box-Muller transform for standard normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  
  private getShapeParameter(position: Position): number {
    const shapes: Record<Position, number> = {
      QB: 10,   // Less skewed
      RB: 3,    // More skewed (boom/bust)
      WR: 2,    // Highly skewed
      TE: 4,    // Moderately skewed
      DST: 8,
      K: 12
    };
    return shapes[position] || 5;
  }
  
  private getVariance(position: Position): number {
    const variances: Record<Position, number> = {
      QB: 0.15,   // 15% coefficient of variation
      RB: 0.35,   // 35% - high variance
      WR: 0.40,   // 40% - highest variance
      TE: 0.30,   // 30% - moderate variance
      DST: 0.25,
      K: 0.20
    };
    return variances[position] || 0.25;
  }
  
  private getWeibullShape(position: Position): number {
    const shapes: Record<Position, number> = {
      QB: 3.5,  // More reliable
      RB: 2.0,  // Less reliable
      WR: 1.8,  // Least reliable
      TE: 2.5,  // Moderate reliability
      DST: 3.0,
      K: 4.0
    };
    return shapes[position] || 2.5;
  }
  
  private getInjuryMultiplier(position: Position): { probability: number; impact: number } {
    const injuries: Record<Position, { probability: number; impact: number }> = {
      QB: { probability: 0.05, impact: 0 },    // 5% chance, season-ending
      RB: { probability: 0.15, impact: 0.5 },  // 15% chance, 50% reduction
      WR: { probability: 0.10, impact: 0.6 },  // 10% chance, 40% reduction
      TE: { probability: 0.08, impact: 0.7 },  // 8% chance, 30% reduction
      DST: { probability: 0.02, impact: 0.9 },
      K: { probability: 0.02, impact: 0.9 }
    };
    return injuries[position] || { probability: 0.05, impact: 0.7 };
  }
  
  private getBoomBustAdjustment(player: PlayerProjection): number {
    // Random boom/bust factor based on player volatility
    const rand = Math.random();
    if (rand < 0.1) {
      // 10% chance of boom game (150-200% performance)
      return 1.5 + Math.random() * 0.5;
    } else if (rand < 0.2) {
      // 10% chance of bust game (30-70% performance)
      return 0.3 + Math.random() * 0.4;
    } else {
      // 80% chance of normal performance (80-120%)
      return 0.8 + Math.random() * 0.4;
    }
  }
  
  private analyzeDistribution(playerId: string, distribution: number[]): SimulationResult {
    // Sort for percentile calculations
    const sorted = [...distribution].sort((a, b) => a - b);
    
    // Calculate statistics
    const mean = distribution.reduce((sum, x) => sum + x, 0) / distribution.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Standard deviation
    const variance = distribution.reduce(
      (sum, x) => sum + Math.pow(x - mean, 2), 0
    ) / distribution.length;
    const std = Math.sqrt(variance);
    
    // Percentiles
    const percentiles = {
      p5: sorted[Math.floor(sorted.length * 0.05)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p50: median,
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
    
    // Skewness
    const skewness = distribution.reduce(
      (sum, x) => sum + Math.pow((x - mean) / std, 3), 0
    ) / distribution.length;
    
    // Kurtosis
    const kurtosis = distribution.reduce(
      (sum, x) => sum + Math.pow((x - mean) / std, 4), 0
    ) / distribution.length - 3;
    
    return {
      playerId,
      mean,
      median,
      std,
      percentiles,
      distribution,
      skewness,
      kurtosis
    };
  }
  
  private gamma(x: number): number {
    // Stirling's approximation for gamma function
    if (x === 1) return 1;
    if (x === 0.5) return Math.sqrt(Math.PI);
    
    const coefficients = [
      76.18009172947146,
      -86.50532032941677,
      24.01409824083091,
      -1.231739572450155,
      0.1208650973866179e-2,
      -0.5395239384953e-5
    ];
    
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    
    for (let j = 0; j < 6; j++) {
      ser += coefficients[j] / ++y;
    }
    
    return Math.sqrt(2 * Math.PI) * Math.sqrt(x + 5.5) * 
           Math.exp(-(x + 5.5) + (x + 0.5) * Math.log(x + 5.5)) * ser;
  }
}