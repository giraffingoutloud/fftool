import type { PlayerValuation, Position } from '@/types';

interface PropertyTest<T> {
  name: string;
  property: (input: T) => boolean;
  generator: () => T;
  iterations?: number;
}

interface ValidationResult {
  test: string;
  passed: boolean;
  failures: any[];
  iterations: number;
}

export class PropertyTesting {
  runTests<T>(tests: PropertyTest<T>[]): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    for (const test of tests) {
      const result = this.runSingleTest(test);
      results.push(result);
    }
    
    return results;
  }
  
  private runSingleTest<T>(test: PropertyTest<T>): ValidationResult {
    const iterations = test.iterations || 100;
    const failures: any[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const input = test.generator();
      
      try {
        const result = test.property(input);
        if (!result) {
          failures.push({
            iteration: i,
            input,
            reason: 'Property returned false'
          });
        }
      } catch (error) {
        failures.push({
          iteration: i,
          input,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return {
      test: test.name,
      passed: failures.length === 0,
      failures: failures.slice(0, 10), // Limit reported failures
      iterations
    };
  }
  
  // Generators for common types
  static generators = {
    playerValuation: (): PlayerValuation => ({
      id: `player_${Math.random().toString(36).substr(2, 9)}`,
      name: `Player ${Math.floor(Math.random() * 1000)}`,
      position: PropertyTesting.generators.position(),
      team: `TEAM${Math.floor(Math.random() * 32)}`,
      points: Math.random() * 400,
      vorp: Math.random() * 200,
      intrinsicValue: Math.random() * 100,
      marketPrice: Math.random() * 100,
      adp: Math.random() * 200,
      confidence: Math.random(),
      injuryStatus: Math.random() > 0.8 ? 'questionable' : 'healthy'
    }),
    
    position: (): Position => {
      const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];
      return positions[Math.floor(Math.random() * positions.length)];
    },
    
    positiveNumber: (min = 0, max = 1000): number => {
      return Math.random() * (max - min) + min;
    },
    
    probability: (): number => {
      return Math.random();
    },
    
    array: <T>(generator: () => T, minLength = 1, maxLength = 100): T[] => {
      const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
      return Array.from({ length }, generator);
    }
  };
}

// Validation properties for testing
export const validationProperties = {
  // VORP should always be non-negative
  vorpNonNegative: (player: PlayerValuation): boolean => {
    return player.vorp >= 0;
  },
  
  // Intrinsic value should be positive
  intrinsicValuePositive: (player: PlayerValuation): boolean => {
    return player.intrinsicValue > 0;
  },
  
  // Market price should be positive
  marketPricePositive: (player: PlayerValuation): boolean => {
    return player.marketPrice > 0;
  },
  
  // Confidence should be between 0 and 1
  confidenceInRange: (player: PlayerValuation): boolean => {
    return player.confidence !== undefined && 
           player.confidence >= 0 && 
           player.confidence <= 1;
  },
  
  // Edge calculations
  edgeCalculation: (player: PlayerValuation): boolean => {
    const edge = player.intrinsicValue - player.marketPrice;
    const edgePercent = edge / Math.max(1, player.marketPrice);
    return !isNaN(edgePercent) && isFinite(edgePercent);
  },
  
  // Monte Carlo results
  monteCarloDistribution: (samples: number[]): boolean => {
    if (samples.length === 0) return false;
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    const allPositive = samples.every(x => x >= 0);
    const finiteValues = samples.every(x => isFinite(x));
    return allPositive && finiteValues && mean > 0;
  },
  
  // Portfolio weights
  portfolioWeights: (weights: number[]): boolean => {
    const sum = weights.reduce((a, b) => a + b, 0);
    const allNonNegative = weights.every(w => w >= 0);
    const normalized = Math.abs(sum - 1) < 0.001; // Allow small floating point error
    return allNonNegative && normalized;
  },
  
  // Bayesian parameters
  bayesianPosterior: (params: { mean: number; variance: number }): boolean => {
    return params.variance > 0 && isFinite(params.mean) && isFinite(params.variance);
  },
  
  // Kalman filter state
  kalmanState: (state: { estimate: number; covariance: number[][] }): boolean => {
    const validEstimate = isFinite(state.estimate) && state.estimate >= 0;
    const validCovariance = state.covariance.every(row => 
      row.every(val => isFinite(val))
    );
    return validEstimate && validCovariance;
  },
  
  // Auction constraints
  auctionBudget: (budget: number, spent: number, slots: number): boolean => {
    const remaining = budget - spent;
    const minRequired = slots - 1; // $1 per remaining slot
    return remaining >= minRequired;
  }
};

// Test suites
export const testSuites = {
  playerValuation: [
    {
      name: 'VORP is non-negative',
      property: validationProperties.vorpNonNegative,
      generator: PropertyTesting.generators.playerValuation,
      iterations: 1000
    },
    {
      name: 'Intrinsic value is positive',
      property: validationProperties.intrinsicValuePositive,
      generator: PropertyTesting.generators.playerValuation,
      iterations: 1000
    },
    {
      name: 'Market price is positive',
      property: validationProperties.marketPricePositive,
      generator: PropertyTesting.generators.playerValuation,
      iterations: 1000
    },
    {
      name: 'Confidence is in valid range',
      property: validationProperties.confidenceInRange,
      generator: PropertyTesting.generators.playerValuation,
      iterations: 1000
    },
    {
      name: 'Edge calculation is valid',
      property: validationProperties.edgeCalculation,
      generator: PropertyTesting.generators.playerValuation,
      iterations: 1000
    }
  ],
  
  monteCarlo: [
    {
      name: 'Monte Carlo samples are valid',
      property: validationProperties.monteCarloDistribution,
      generator: () => PropertyTesting.generators.array(
        () => PropertyTesting.generators.positiveNumber(0, 500),
        100,
        10000
      ),
      iterations: 100
    }
  ],
  
  portfolio: [
    {
      name: 'Portfolio weights are valid',
      property: validationProperties.portfolioWeights,
      generator: () => {
        const n = Math.floor(Math.random() * 20) + 1;
        const weights = Array.from({ length: n }, () => Math.random());
        const sum = weights.reduce((a, b) => a + b, 0);
        return weights.map(w => w / sum);
      },
      iterations: 1000
    }
  ]
};