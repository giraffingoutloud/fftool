// Web Worker for parallel computation

interface WorkerMessage {
  taskId: string;
  type: 'monte_carlo' | 'vorp' | 'optimization' | 'bayesian';
  data: any;
  startTime: number;
}

// Listen for messages from main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { taskId, type, data, startTime } = e.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'monte_carlo':
        result = await computeMonteCarlo(data);
        break;
      case 'vorp':
        result = await computeVORP(data);
        break;
      case 'optimization':
        result = await computeOptimization(data);
        break;
      case 'bayesian':
        result = await computeBayesian(data);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    const computeTime = performance.now() - startTime;
    
    // Send result back to main thread
    self.postMessage({
      taskId,
      result,
      computeTime
    });
  } catch (error) {
    self.postMessage({
      taskId,
      error: error instanceof Error ? error.message : 'Unknown error',
      computeTime: performance.now() - startTime
    });
  }
};

async function computeMonteCarlo(data: {
  players: any[];
  iterations: number;
}): Promise<[string, any][]> {
  const { players, iterations } = data;
  const results: [string, any][] = [];
  
  for (const player of players) {
    const samples: number[] = [];
    const basePoints = player.points;
    const variance = getPositionVariance(player.position);
    
    for (let i = 0; i < iterations; i++) {
      // Simple normal distribution sampling
      const sample = sampleNormal(basePoints, Math.sqrt(variance) * basePoints);
      samples.push(Math.max(0, sample));
    }
    
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    
    results.push([player.id, {
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    }]);
  }
  
  return results;
}

async function computeVORP(data: {
  players: any[];
  replacementLevels: [string, number][];
}): Promise<[string, number][]> {
  const { players, replacementLevels } = data;
  const replacementMap = new Map(replacementLevels);
  const results: [string, number][] = [];
  
  for (const player of players) {
    const replacementLevel = replacementMap.get(player.position) || 0;
    const vorp = Math.max(0, player.points - replacementLevel);
    results.push([player.id, vorp]);
  }
  
  return results;
}

async function computeOptimization(data: {
  assets: any[];
  constraints: any;
}): Promise<number[]> {
  const { assets, constraints } = data;
  const n = assets.length;
  const weights = new Array(n).fill(1 / n);
  
  // Simplified optimization using gradient descent
  const learningRate = 0.01;
  const iterations = 500;
  
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate gradient
    const gradient = calculateGradient(weights, assets);
    
    // Update weights
    for (let i = 0; i < n; i++) {
      weights[i] -= learningRate * gradient[i];
      weights[i] = Math.max(0, Math.min(1, weights[i]));
    }
    
    // Normalize
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (let i = 0; i < n; i++) {
        weights[i] /= sum;
      }
    }
  }
  
  return weights;
}

async function computeBayesian(data: {
  samples: number[];
  priorMean: number;
  priorVariance: number;
}): Promise<{ posteriorMean: number; posteriorVariance: number }> {
  const { samples, priorMean, priorVariance } = data;
  
  // Calculate sample statistics
  const n = samples.length;
  const sampleMean = samples.reduce((sum, x) => sum + x, 0) / n;
  const sampleVariance = samples.reduce(
    (sum, x) => sum + Math.pow(x - sampleMean, 2), 0
  ) / (n - 1);
  
  // Bayesian update
  const priorPrecision = 1 / priorVariance;
  const samplePrecision = n / sampleVariance;
  
  const posteriorPrecision = priorPrecision + samplePrecision;
  const posteriorMean = (priorPrecision * priorMean + samplePrecision * sampleMean) / 
                       posteriorPrecision;
  const posteriorVariance = 1 / posteriorPrecision;
  
  return { posteriorMean, posteriorVariance };
}

// Helper functions
function sampleNormal(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function getPositionVariance(position: string): number {
  const variances: Record<string, number> = {
    QB: 0.15,
    RB: 0.35,
    WR: 0.40,
    TE: 0.30,
    DST: 0.25,
    K: 0.20
  };
  return variances[position] || 0.25;
}

function calculateGradient(weights: number[], assets: any[]): number[] {
  const n = weights.length;
  const gradient = new Array(n).fill(0);
  
  // Simplified gradient calculation
  const portfolioReturn = weights.reduce(
    (sum, w, i) => sum + w * assets[i].expectedReturn, 0
  );
  
  for (let i = 0; i < n; i++) {
    gradient[i] = -assets[i].expectedReturn + portfolioReturn;
  }
  
  return gradient;
}

// Export for TypeScript
export {};