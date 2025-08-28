import type { 
  PlayerValuation, 
  Position, 
  LeagueSettings,
  Team
} from '@/types';

type Strategy = 'stars_and_scrubs' | 'balanced' | 'zero_rb' | 'hero_rb' | 'robust_rb';

interface AllocationPlan {
  position: Position;
  targetSpend: number;
  targetCount: number;
  priority: number;
}

interface DynamicAllocation {
  strategy: Strategy;
  allocations: AllocationPlan[];
  totalBudget: number;
  flexAdjustment: number;
  marketAdjustment: number;
}

export class DynamicAuctionAllocator {
  private leagueSettings: LeagueSettings;
  private budget: number;
  
  constructor(leagueSettings: LeagueSettings, budget: number = 200) {
    this.leagueSettings = leagueSettings;
    this.budget = budget;
  }
  
  allocateBudget(
    strategy: Strategy,
    marketConditions: Map<Position, number>,
    teamState: Team
  ): DynamicAllocation {
    // Calculate base allocations for strategy
    const baseAllocations = this.getStrategyAllocations(strategy);
    
    // Adjust for market conditions
    const marketAdjusted = this.adjustForMarket(
      baseAllocations,
      marketConditions
    );
    
    // Adjust for current team state
    const teamAdjusted = this.adjustForTeamState(
      marketAdjusted,
      teamState
    );
    
    // Calculate flex adjustment
    const flexAdjustment = this.calculateFlexAdjustment(
      teamAdjusted,
      marketConditions
    );
    
    // Calculate total market adjustment factor
    const marketAdjustment = this.calculateMarketAdjustment(marketConditions);
    
    return {
      strategy,
      allocations: teamAdjusted,
      totalBudget: this.budget - teamState.spent,
      flexAdjustment,
      marketAdjustment
    };
  }
  
  private getStrategyAllocations(strategy: Strategy): AllocationPlan[] {
    const allocations: AllocationPlan[] = [];
    
    switch (strategy) {
      case 'stars_and_scrubs':
        allocations.push(
          { position: 'RB', targetSpend: 80, targetCount: 2, priority: 1 },
          { position: 'WR', targetSpend: 70, targetCount: 2, priority: 2 },
          { position: 'QB', targetSpend: 25, targetCount: 1, priority: 3 },
          { position: 'TE', targetSpend: 10, targetCount: 1, priority: 4 }
        );
        break;
        
      case 'balanced':
        allocations.push(
          { position: 'RB', targetSpend: 60, targetCount: 3, priority: 1 },
          { position: 'WR', targetSpend: 60, targetCount: 3, priority: 1 },
          { position: 'QB', targetSpend: 30, targetCount: 1, priority: 2 },
          { position: 'TE', targetSpend: 20, targetCount: 1, priority: 3 }
        );
        break;
        
      case 'zero_rb':
        allocations.push(
          { position: 'WR', targetSpend: 100, targetCount: 4, priority: 1 },
          { position: 'TE', targetSpend: 35, targetCount: 1, priority: 2 },
          { position: 'QB', targetSpend: 35, targetCount: 1, priority: 3 },
          { position: 'RB', targetSpend: 15, targetCount: 4, priority: 4 }
        );
        break;
        
      case 'hero_rb':
        allocations.push(
          { position: 'RB', targetSpend: 65, targetCount: 1, priority: 1 },
          { position: 'WR', targetSpend: 80, targetCount: 4, priority: 2 },
          { position: 'QB', targetSpend: 20, targetCount: 1, priority: 3 },
          { position: 'TE', targetSpend: 15, targetCount: 1, priority: 4 }
        );
        break;
        
      case 'robust_rb':
        allocations.push(
          { position: 'RB', targetSpend: 90, targetCount: 4, priority: 1 },
          { position: 'WR', targetSpend: 50, targetCount: 3, priority: 2 },
          { position: 'QB', targetSpend: 20, targetCount: 1, priority: 3 },
          { position: 'TE', targetSpend: 15, targetCount: 1, priority: 4 }
        );
        break;
    }
    
    return allocations;
  }
  
  private adjustForMarket(
    allocations: AllocationPlan[],
    marketConditions: Map<Position, number>
  ): AllocationPlan[] {
    return allocations.map(alloc => {
      const marketMultiplier = marketConditions.get(alloc.position) || 1.0;
      
      // If position is expensive, reduce allocation
      // If position is cheap, increase allocation
      const adjustmentFactor = 2 - marketMultiplier; // Inverse relationship
      
      return {
        ...alloc,
        targetSpend: Math.round(alloc.targetSpend * adjustmentFactor)
      };
    });
  }
  
  private adjustForTeamState(
    allocations: AllocationPlan[],
    teamState: Team
  ): AllocationPlan[] {
    // Count current positions
    const positionCounts = new Map<Position, number>();
    for (const pick of teamState.roster) {
      const pos = pick.player.position;
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    }
    
    // Adjust allocations based on what we already have
    return allocations.map(alloc => {
      const currentCount = positionCounts.get(alloc.position) || 0;
      const remaining = Math.max(0, alloc.targetCount - currentCount);
      
      // Scale down spend proportionally to positions already filled
      const fillRatio = currentCount / alloc.targetCount;
      const remainingSpend = alloc.targetSpend * (1 - fillRatio);
      
      return {
        ...alloc,
        targetSpend: Math.round(remainingSpend),
        targetCount: remaining
      };
    });
  }
  
  private calculateFlexAdjustment(
    allocations: AllocationPlan[],
    marketConditions: Map<Position, number>
  ): number {
    // Calculate adjustment for FLEX-eligible positions
    const flexPositions: Position[] = ['RB', 'WR', 'TE'];
    
    let totalFlexValue = 0;
    let flexCount = 0;
    
    for (const pos of flexPositions) {
      const allocation = allocations.find(a => a.position === pos);
      const marketValue = marketConditions.get(pos) || 1.0;
      
      if (allocation) {
        totalFlexValue += allocation.targetSpend * marketValue;
        flexCount += allocation.targetCount;
      }
    }
    
    // Return average FLEX value adjustment
    return flexCount > 0 ? totalFlexValue / flexCount / 30 : 1.0; // Normalize to ~1.0
  }
  
  private calculateMarketAdjustment(
    marketConditions: Map<Position, number>
  ): number {
    // Calculate overall market inflation/deflation
    let totalAdjustment = 0;
    let count = 0;
    
    for (const [_, value] of marketConditions) {
      totalAdjustment += value;
      count++;
    }
    
    return count > 0 ? totalAdjustment / count : 1.0;
  }
  
  recommendStrategy(
    playerPool: PlayerValuation[],
    marketPrices: Map<string, number>
  ): Strategy {
    // Analyze player pool to recommend best strategy
    const positionValues = this.analyzePositionValues(playerPool, marketPrices);
    
    // Calculate value ratios
    const rbValue = positionValues.get('RB') || 0;
    const wrValue = positionValues.get('WR') || 0;
    const qbValue = positionValues.get('QB') || 0;
    const teValue = positionValues.get('TE') || 0;
    
    // Decision logic based on relative values
    if (rbValue < 0.8 && wrValue > 1.2) {
      return 'zero_rb'; // RBs overpriced, WRs have value
    } else if (rbValue > 1.2 && wrValue < 0.9) {
      return 'robust_rb'; // RBs have value, WRs overpriced
    } else if (qbValue > 1.3 || teValue > 1.3) {
      return 'stars_and_scrubs'; // Elite QB/TE available
    } else if (Math.abs(rbValue - wrValue) < 0.1) {
      return 'balanced'; // Similar value across positions
    } else {
      return 'hero_rb'; // Default to hero RB
    }
  }
  
  private analyzePositionValues(
    playerPool: PlayerValuation[],
    marketPrices: Map<string, number>
  ): Map<Position, number> {
    const positionValues = new Map<Position, number>();
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];
    
    for (const position of positions) {
      const positionPlayers = playerPool.filter(p => p.position === position);
      
      let totalValue = 0;
      let count = 0;
      
      for (const player of positionPlayers) {
        const marketPrice = marketPrices.get(player.id) || player.marketPrice;
        const edge = player.intrinsicValue - marketPrice;
        const edgeRatio = marketPrice > 0 ? edge / marketPrice : 0;
        
        totalValue += edgeRatio;
        count++;
      }
      
      // Average edge ratio for position
      const avgValue = count > 0 ? totalValue / count : 0;
      positionValues.set(position, 1 + avgValue); // Normalize around 1.0
    }
    
    return positionValues;
  }
  
  getPositionBudget(
    allocation: DynamicAllocation,
    position: Position
  ): number {
    const posAllocation = allocation.allocations.find(
      a => a.position === position
    );
    
    if (!posAllocation) return 0;
    
    // Apply market and flex adjustments
    let budget = posAllocation.targetSpend;
    
    if (['RB', 'WR', 'TE'].includes(position)) {
      budget *= allocation.flexAdjustment;
    }
    
    budget *= allocation.marketAdjustment;
    
    return Math.round(budget);
  }
}