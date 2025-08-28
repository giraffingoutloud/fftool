import type { PlayerProjection } from '@/types';

interface KalmanState {
  estimate: number;
  errorCovariance: number;
  timestamp: number;
}

interface EnsembleState {
  playerId: string;
  ensemble: number[];
  mean: number;
  covariance: number[][];
  lastUpdate: number;
}

export class EnsembleKalmanFilter {
  private ensembleSize: number;
  private states: Map<string, EnsembleState> = new Map();
  private processNoise: number;
  private measurementNoise: number;
  
  constructor(
    ensembleSize: number = 100,
    processNoise: number = 0.1,
    measurementNoise: number = 0.05
  ) {
    this.ensembleSize = ensembleSize;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }
  
  initialize(players: PlayerProjection[]): void {
    for (const player of players) {
      const initialPrice = player.adp || player.points / 10;
      
      // Create ensemble with perturbations
      const ensemble: number[] = [];
      for (let i = 0; i < this.ensembleSize; i++) {
        const perturbation = this.generatePerturbation(initialPrice * 0.1);
        ensemble.push(initialPrice + perturbation);
      }
      
      // Initialize covariance matrix
      const covariance = this.calculateCovariance(ensemble);
      
      this.states.set(player.id, {
        playerId: player.id,
        ensemble,
        mean: this.calculateMean(ensemble),
        covariance,
        lastUpdate: Date.now()
      });
    }
  }
  
  update(
    playerId: string, 
    observedPrice: number,
    timestamp: number = Date.now()
  ): number {
    const state = this.states.get(playerId);
    if (!state) {
      throw new Error(`Player ${playerId} not initialized`);
    }
    
    // Time evolution (forecast step)
    const forecastEnsemble = this.forecast(state, timestamp);
    
    // Analysis step (update with observation)
    const analysisEnsemble = this.analysis(
      forecastEnsemble,
      observedPrice,
      state
    );
    
    // Update state
    const newMean = this.calculateMean(analysisEnsemble);
    const newCovariance = this.calculateCovariance(analysisEnsemble);
    
    this.states.set(playerId, {
      playerId,
      ensemble: analysisEnsemble,
      mean: newMean,
      covariance: newCovariance,
      lastUpdate: timestamp
    });
    
    return newMean;
  }
  
  private forecast(state: EnsembleState, timestamp: number): number[] {
    const dt = (timestamp - state.lastUpdate) / 1000 / 3600; // Hours
    
    return state.ensemble.map(member => {
      // State transition with drift and diffusion
      const drift = this.calculateDrift(member, state.mean);
      const diffusion = this.calculateDiffusion(member) * Math.sqrt(dt);
      const noise = this.generatePerturbation(this.processNoise);
      
      return member + drift * dt + diffusion * noise;
    });
  }
  
  private analysis(
    forecastEnsemble: number[],
    observation: number,
    state: EnsembleState
  ): number[] {
    // Calculate Kalman gain
    const forecastMean = this.calculateMean(forecastEnsemble);
    const forecastCovariance = this.calculateCovariance(forecastEnsemble);
    
    // Perturbed observations
    const perturbedObs = Array(this.ensembleSize).fill(0).map(() => 
      observation + this.generatePerturbation(this.measurementNoise)
    );
    
    // Calculate innovations
    const innovations = perturbedObs.map((obs, i) => 
      obs - forecastEnsemble[i]
    );
    
    // Calculate cross-covariance
    const crossCovariance = this.calculateCrossCovariance(
      forecastEnsemble,
      innovations
    );
    
    // Calculate Kalman gain
    const observationCovariance = this.measurementNoise * this.measurementNoise;
    const kalmanGain = crossCovariance / (forecastCovariance[0][0] + observationCovariance);
    
    // Update ensemble
    return forecastEnsemble.map((member, i) => 
      member + kalmanGain * innovations[i]
    );
  }
  
  private calculateDrift(value: number, mean: number): number {
    // Mean reversion drift
    const meanReversionSpeed = 0.1;
    return meanReversionSpeed * (mean - value);
  }
  
  private calculateDiffusion(value: number): number {
    // Volatility proportional to price level
    return value * 0.2; // 20% volatility
  }
  
  private calculateMean(ensemble: number[]): number {
    return ensemble.reduce((sum, x) => sum + x, 0) / ensemble.length;
  }
  
  private calculateCovariance(ensemble: number[]): number[][] {
    const mean = this.calculateMean(ensemble);
    const n = ensemble.length;
    
    // For univariate case, return 1x1 matrix
    const variance = ensemble.reduce(
      (sum, x) => sum + Math.pow(x - mean, 2), 0
    ) / (n - 1);
    
    return [[variance]];
  }
  
  private calculateCrossCovariance(
    ensemble1: number[],
    ensemble2: number[]
  ): number {
    const mean1 = this.calculateMean(ensemble1);
    const mean2 = this.calculateMean(ensemble2);
    const n = ensemble1.length;
    
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (ensemble1[i] - mean1) * (ensemble2[i] - mean2);
    }
    
    return sum / (n - 1);
  }
  
  private generatePerturbation(scale: number): number {
    // Generate random perturbation from normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * scale;
  }
  
  getPrediction(playerId: string): {
    price: number;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
  } | null {
    const state = this.states.get(playerId);
    if (!state) return null;
    
    // Calculate confidence from ensemble spread
    const std = Math.sqrt(state.covariance[0][0]);
    const confidence = Math.max(0, Math.min(1, 1 - std / state.mean));
    
    // Determine trend from recent ensemble evolution
    const recentMean = this.calculateMean(state.ensemble.slice(-20));
    const olderMean = this.calculateMean(state.ensemble.slice(0, 20));
    
    let trend: 'up' | 'down' | 'stable';
    if (recentMean > olderMean * 1.05) {
      trend = 'up';
    } else if (recentMean < olderMean * 0.95) {
      trend = 'down';
    } else {
      trend = 'stable';
    }
    
    return {
      price: state.mean,
      confidence,
      trend
    };
  }
  
  getEnsembleStatistics(playerId: string): {
    mean: number;
    std: number;
    percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
    convergenceRate: number;
  } | null {
    const state = this.states.get(playerId);
    if (!state) return null;
    
    const sorted = [...state.ensemble].sort((a, b) => a - b);
    const mean = state.mean;
    const variance = state.covariance[0][0];
    const std = Math.sqrt(variance);
    
    const percentiles = {
      p5: sorted[Math.floor(sorted.length * 0.05)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
    
    // Calculate convergence rate (how quickly ensemble is converging)
    const convergenceRate = 1 / (1 + std / mean);
    
    return {
      mean,
      std,
      percentiles,
      convergenceRate
    };
  }
}