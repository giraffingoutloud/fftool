import type { PlayerProjection, Position, TeamMetrics } from '@/types';

interface HyperParameters {
  mu: number;      // Population mean
  tau: number;     // Population precision (1/variance)
  alpha: number;   // Shape parameter for gamma prior
  beta: number;    // Rate parameter for gamma prior
}

interface PlayerParameters {
  playerId: string;
  theta: number;   // Player-specific parameter
  precision: number; // Player-specific precision
  posterior: {
    mean: number;
    variance: number;
    samples: number[];
  };
}

export class BayesianHierarchicalModel {
  private hyperParams: Map<Position, HyperParameters> = new Map();
  private playerParams: Map<string, PlayerParameters> = new Map();
  private iterations: number;
  
  constructor(iterations: number = 5000) {
    this.iterations = iterations;
  }
  
  fit(
    players: PlayerProjection[],
    historicalData?: Map<string, number[]>
  ): void {
    // Group players by position
    const positionGroups = this.groupByPosition(players);
    
    // Fit hierarchical model for each position
    for (const [position, positionPlayers] of positionGroups) {
      this.fitPositionModel(position, positionPlayers, historicalData);
    }
  }
  
  private groupByPosition(
    players: PlayerProjection[]
  ): Map<Position, PlayerProjection[]> {
    const groups = new Map<Position, PlayerProjection[]>();
    
    for (const player of players) {
      if (!groups.has(player.position)) {
        groups.set(player.position, []);
      }
      groups.get(player.position)!.push(player);
    }
    
    return groups;
  }
  
  private fitPositionModel(
    position: Position,
    players: PlayerProjection[],
    historicalData?: Map<string, number[]>
  ): void {
    // Initialize hyperparameters with empirical Bayes
    const hyperParams = this.initializeHyperParameters(players);
    this.hyperParams.set(position, hyperParams);
    
    // Gibbs sampling for posterior inference
    const samples = this.gibbsSampling(
      players,
      hyperParams,
      historicalData
    );
    
    // Update player parameters with posterior samples
    for (const player of players) {
      const playerSamples = samples.get(player.id) || [];
      const posterior = this.computePosterior(playerSamples);
      
      this.playerParams.set(player.id, {
        playerId: player.id,
        theta: posterior.mean,
        precision: 1 / posterior.variance,
        posterior
      });
    }
  }
  
  private initializeHyperParameters(
    players: PlayerProjection[]
  ): HyperParameters {
    // Empirical Bayes estimation
    const points = players.map(p => p.points);
    const mean = points.reduce((sum, x) => sum + x, 0) / points.length;
    const variance = points.reduce(
      (sum, x) => sum + Math.pow(x - mean, 2), 0
    ) / points.length;
    
    return {
      mu: mean,
      tau: 1 / variance,
      alpha: 2,  // Weakly informative prior
      beta: variance / 2
    };
  }
  
  private gibbsSampling(
    players: PlayerProjection[],
    hyperParams: HyperParameters,
    historicalData?: Map<string, number[]>
  ): Map<string, number[]> {
    const samples = new Map<string, number[]>();
    
    // Initialize player parameters
    const playerThetas = new Map<string, number>();
    for (const player of players) {
      playerThetas.set(player.id, player.points);
      samples.set(player.id, []);
    }
    
    // Current hyperparameters
    let mu = hyperParams.mu;
    let tau = hyperParams.tau;
    
    // Gibbs sampling iterations
    for (let iter = 0; iter < this.iterations; iter++) {
      // Sample player parameters given hyperparameters
      for (const player of players) {
        const historical = historicalData?.get(player.id) || [player.points];
        const theta = this.samplePlayerParameter(
          player,
          historical,
          mu,
          tau
        );
        playerThetas.set(player.id, theta);
        samples.get(player.id)!.push(theta);
      }
      
      // Sample hyperparameters given player parameters
      const thetas = Array.from(playerThetas.values());
      mu = this.sampleMu(thetas, tau);
      tau = this.sampleTau(thetas, mu, hyperParams.alpha, hyperParams.beta);
    }
    
    return samples;
  }
  
  private samplePlayerParameter(
    player: PlayerProjection,
    historical: number[],
    mu: number,
    tau: number
  ): number {
    // Posterior precision = prior precision + data precision
    const n = historical.length;
    const dataMean = historical.reduce((sum, x) => sum + x, 0) / n;
    const dataPrec = n; // Assuming unit variance for simplicity
    
    const postPrec = tau + dataPrec;
    const postMean = (tau * mu + dataPrec * dataMean) / postPrec;
    const postStd = Math.sqrt(1 / postPrec);
    
    // Sample from posterior normal distribution
    return this.sampleNormal(postMean, postStd);
  }
  
  private sampleMu(thetas: number[], tau: number): number {
    // Sample population mean from its conditional posterior
    const n = thetas.length;
    const mean = thetas.reduce((sum, x) => sum + x, 0) / n;
    const precision = n * tau;
    const std = Math.sqrt(1 / precision);
    
    return this.sampleNormal(mean, std);
  }
  
  private sampleTau(
    thetas: number[],
    mu: number,
    alpha: number,
    beta: number
  ): number {
    // Sample population precision from its conditional posterior (Gamma)
    const n = thetas.length;
    const sumSquaredDev = thetas.reduce(
      (sum, theta) => sum + Math.pow(theta - mu, 2), 0
    );
    
    const postAlpha = alpha + n / 2;
    const postBeta = beta + sumSquaredDev / 2;
    
    return this.sampleGamma(postAlpha, postBeta);
  }
  
  private sampleNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }
  
  private sampleGamma(alpha: number, beta: number): number {
    // Marsaglia and Tsang method
    const d = alpha - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      const x = this.sampleNormal(0, 1);
      const v = Math.pow(1 + c * x, 3);
      if (v > 0) {
        const u = Math.random();
        if (u < 1 - 0.0331 * Math.pow(x, 4)) {
          return d * v / beta;
        }
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v / beta;
        }
      }
    }
  }
  
  private computePosterior(samples: number[]): {
    mean: number;
    variance: number;
    samples: number[];
  } {
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    const variance = samples.reduce(
      (sum, x) => sum + Math.pow(x - mean, 2), 0
    ) / samples.length;
    
    return { mean, variance, samples };
  }
  
  predict(
    playerId: string,
    features?: { teamMetrics?: TeamMetrics; schedule?: number[] }
  ): {
    mean: number;
    std: number;
    credibleInterval: { lower: number; upper: number };
  } | null {
    const params = this.playerParams.get(playerId);
    if (!params) return null;
    
    let adjustedMean = params.posterior.mean;
    let adjustedStd = Math.sqrt(params.posterior.variance);
    
    // Adjust for team metrics if provided
    if (features?.teamMetrics) {
      const teamEffect = this.calculateTeamEffect(features.teamMetrics);
      adjustedMean *= teamEffect;
    }
    
    // Adjust for schedule strength if provided
    if (features?.schedule) {
      const scheduleEffect = this.calculateScheduleEffect(features.schedule);
      adjustedMean *= scheduleEffect;
      adjustedStd *= (1 + Math.abs(1 - scheduleEffect) * 0.5);
    }
    
    // 95% credible interval
    const credibleInterval = {
      lower: adjustedMean - 1.96 * adjustedStd,
      upper: adjustedMean + 1.96 * adjustedStd
    };
    
    return {
      mean: adjustedMean,
      std: adjustedStd,
      credibleInterval
    };
  }
  
  private calculateTeamEffect(teamMetrics: TeamMetrics): number {
    // Weighted average of offensive metrics
    const offenseScore = 
      teamMetrics.passingYards * 0.0002 +
      teamMetrics.rushingYards * 0.0003 +
      teamMetrics.scoringEfficiency * 0.5 +
      teamMetrics.redZoneEfficiency * 0.3;
    
    // Normalize to multiplier (0.8 to 1.2)
    return 0.8 + Math.min(0.4, offenseScore * 0.4);
  }
  
  private calculateScheduleEffect(schedule: number[]): number {
    // Average opponent strength (assuming values 0-1)
    const avgStrength = schedule.reduce((sum, x) => sum + x, 0) / schedule.length;
    
    // Convert to multiplier (easier schedule = higher multiplier)
    return 1.2 - avgStrength * 0.4; // Range: 0.8 to 1.2
  }
  
  getHierarchicalStructure(): {
    positions: Map<Position, {
      populationMean: number;
      populationVariance: number;
      playerCount: number;
    }>;
  } {
    const structure = new Map<Position, {
      populationMean: number;
      populationVariance: number;
      playerCount: number;
    }>();
    
    for (const [position, hyperParams] of this.hyperParams) {
      const positionPlayers = Array.from(this.playerParams.values())
        .filter(p => {
          // Would need to track position in playerParams for this
          return true; // Placeholder
        });
      
      structure.set(position, {
        populationMean: hyperParams.mu,
        populationVariance: 1 / hyperParams.tau,
        playerCount: positionPlayers.length
      });
    }
    
    return { positions: structure };
  }
}