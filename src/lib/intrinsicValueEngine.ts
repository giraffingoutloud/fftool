import type { 
  PlayerProjection, 
  LeagueSettings, 
  Team,
  PlayerValuation
} from '@/types';
import { AdvancedMetricsEngineV2 } from './advancedMetricsEngineV2';

/**
 * Engine for calculating intrinsic player values using VORP (Value Over Replacement Player),
 * Monte Carlo simulations for weekly value, and two-pass auction value allocation.
 * Integrates with AdvancedMetricsEngineV2 for position-specific adjustments.
 */
export class IntrinsicValueEngine {
  private leagueSettings: LeagueSettings;
  private draftedPlayers: Set<string> = new Set();
  private remainingBudget: Map<string, number> = new Map();
  private flexReplacementLevel: number = 0;
  private positionReplacementLevels: Map<string, number> = new Map();
  private advancedMetricsEngine?: AdvancedMetricsEngineV2;
  
  constructor(
    leagueSettings: LeagueSettings, 
    advancedMetricsEngine?: AdvancedMetricsEngineV2
  ) {
    this.leagueSettings = leagueSettings;
    this.initializeBudgets();
    this.advancedMetricsEngine = advancedMetricsEngine;
  }

  private initializeBudgets() {
    for (let i = 0; i < this.leagueSettings.teams; i++) {
      this.remainingBudget.set(`team_${i}`, this.leagueSettings.budget);
    }
  }

  /**
   * Calculate intrinsic auction values for all available players.
   * @param projections - Player projections with fantasy points
   * @param teams - Current draft teams with budgets
   * @param draftedPlayerIds - IDs of already drafted players
   * @returns Array of player valuations with intrinsic values and confidence
   */
  calculateIntrinsicValues(
    projections: PlayerProjection[],
    teams: Team[],
    draftedPlayerIds: string[]
  ): PlayerValuation[] {
    this.draftedPlayers = new Set(draftedPlayerIds);
    this.updateRemainingBudgets(teams);
    
    const availablePlayers = projections.filter(
      p => !this.draftedPlayers.has(p.id)
    );
    
    this.calculateFlexAwareReplacementLevel(availablePlayers);
    
    // Calculate raw VORP and determine starter/bench status for all players
    const playersWithVorp = availablePlayers.map(player => {
      const vorp = this.calculateVORP(player, availablePlayers);
      const weeklyValue = this.simulateWeeklyValue(player, availablePlayers);
      const isStarter = this.isProjectedStarter(player, availablePlayers);
      
      // Get advanced metrics adjustment if available
      let advancedAdjustment = 1.0;
      if (this.advancedMetricsEngine) {
        const adjustment = this.advancedMetricsEngine.getPlayerAdjustment(
          player.name,
          player.position,
          player.team
        );
        advancedAdjustment = adjustment.totalAdjustment;
      }
      
      return {
        player,
        vorp,
        weeklyValue,
        isStarter,
        advancedAdjustment
      };
    });
    
    // Apply two-pass auction value allocation
    const auctionValues = this.allocateAuctionValues(playersWithVorp);
    
    const valuations = playersWithVorp.map(({ player, vorp, advancedAdjustment }) => {
      const baseIntrinsicValue = auctionValues.get(player.id) || 1;
      const intrinsicValue = Math.round(baseIntrinsicValue * advancedAdjustment);
      
      return {
        ...player,
        intrinsicValue,
        vorp,
        replacementLevel: this.getReplacementLevel(player.position),
        marketPrice: 0,
        edge: 0,
        confidence: 0.75,
        recommendation: 'FAIR' as const,
        maxBid: Math.ceil(intrinsicValue * 1.15),
        minBid: Math.floor(intrinsicValue * 0.85)
      };
    });
    
    return valuations;
  }

  /**
   * Calculate replacement level considering FLEX positions.
   * RB/WR/TE share same replacement level based on combined starter slots.
   */
  private calculateFlexAwareReplacementLevel(players: PlayerProjection[]) {
    const rosterSpots = this.leagueSettings.rosterPositions;
    const totalTeams = this.leagueSettings.teams;
    
    // Validate input
    if (!players || players.length === 0) {
      console.warn('No players provided for replacement level calculation');
      this.flexReplacementLevel = 0;
      return;
    }
    
    // Calculate position requirements
    const rbSlots = this.getPositionSlots('RB');
    const wrSlots = this.getPositionSlots('WR');
    const teSlots = this.getPositionSlots('TE');
    const flexSlots = this.getPositionSlots('FLEX');
    
    // FLEX replacement across RB/WR/TE
    const flexEligible = players.filter(p => 
      ['RB', 'WR', 'TE'].includes(p.position) && 
      p.projectedPoints !== undefined && 
      p.projectedPoints >= 0
    );
    
    if (flexEligible.length === 0) {
      console.warn('No FLEX-eligible players found');
      this.flexReplacementLevel = 0;
      return;
    }
    
    flexEligible.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
    
    // Calculate total starter slots for FLEX-eligible positions
    const totalFlexStarterSlots = (rbSlots + wrSlots + teSlots + flexSlots) * totalTeams;
    
    // Ensure valid index with proper bounds checking
    const flexReplacementIndex = Math.min(
      totalFlexStarterSlots - 1,
      flexEligible.length - 1
    );
    
    if (flexReplacementIndex < 0) {
      this.flexReplacementLevel = 0;
    } else {
      this.flexReplacementLevel = flexEligible[flexReplacementIndex].projectedPoints || 0;
    }
    
    // Position-specific replacement for QB/DST/K
    const nonFlexPositions: Array<'QB' | 'DST' | 'K'> = ['QB', 'DST', 'K'];
    
    for (const pos of nonFlexPositions) {
      const posPlayers = players.filter(p => 
        p.position === pos && 
        p.projectedPoints !== undefined && 
        p.projectedPoints >= 0
      );
      
      if (posPlayers.length === 0) {
        this.positionReplacementLevels.set(pos, 0);
        continue;
      }
      
      posPlayers.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
      
      const slots = this.getPositionSlots(pos);
      const starters = slots * totalTeams;
      const idx = Math.min(starters - 1, posPlayers.length - 1);
      
      this.positionReplacementLevels.set(
        pos, 
        idx >= 0 ? (posPlayers[idx]?.projectedPoints || 0) : 0
      );
    }
    
    // Set FLEX-eligible positions to use FLEX replacement level
    this.positionReplacementLevels.set('RB', this.flexReplacementLevel);
    this.positionReplacementLevels.set('WR', this.flexReplacementLevel);
    this.positionReplacementLevels.set('TE', this.flexReplacementLevel);
  }
  
  private getPositionSlots(position: string): number {
    return this.leagueSettings.rosterPositions
      .filter(s => s.position === position)
      .reduce((sum, s) => sum + s.required, 0);
  }

  private getReplacementLevel(position: string): number {
    if (['RB', 'WR', 'TE'].includes(position)) {
      return this.flexReplacementLevel;
    }
    return this.positionReplacementLevels.get(position) || 0;
  }

  /**
   * Calculate Value Over Replacement Player with advanced metrics adjustment.
   */
  private calculateVORP(player: PlayerProjection, allPlayers: PlayerProjection[]): number {
    // Apply advanced metrics adjustment if available
    let adjustedProjectedPoints = player.projectedPoints;
    if (this.advancedMetricsEngine) {
      const adjustment = this.advancedMetricsEngine.getPlayerAdjustment(
        player.name,
        player.position,
        player.team
      );
      adjustedProjectedPoints = player.projectedPoints * adjustment.totalAdjustment;
    }
    
    const replacementLevel = this.getReplacementLevel(player.position);
    return Math.max(0, adjustedProjectedPoints - replacementLevel);
  }

  /**
   * Monte Carlo simulation of player's weekly value considering variance,
   * injury risk, and start probability.
   */
  private simulateWeeklyValue(
    player: PlayerProjection, 
    availablePlayers: PlayerProjection[]
  ): number {
    // Use environment variable for simulations count if available
    const envSimulations = import.meta?.env?.VITE_MONTE_CARLO_ITERATIONS;
    const simulations = envSimulations ? Number(envSimulations) : 1000;
    const results: number[] = [];
    
    // Apply advanced metrics adjustment if available
    let adjustedProjectedPoints = player.projectedPoints;
    if (this.advancedMetricsEngine) {
      const adjustment = this.advancedMetricsEngine.getPlayerAdjustment(
        player.name,
        player.position,
        player.team
      );
      adjustedProjectedPoints = player.projectedPoints * adjustment.totalAdjustment;
    }
    
    for (let sim = 0; sim < simulations; sim++) {
      let seasonTotal = 0;
      let weeksPlayed = 0;
      let isInjured = false;
      
      for (let week = 1; week <= 17; week++) {
        if (player.byeWeek === week) continue;
        
        if (!isInjured) {
          const weeklyMean = adjustedProjectedPoints / 17; // NFL season is 17 weeks
          const positionVolatility = this.getPositionVolatility(player.position);
          const weeklyStdDev = weeklyMean * positionVolatility;
          
          // Fixed Box-Muller transform with proper guards
          let u1 = 0, u2 = 0;
          do {
            u1 = Math.random();
            u2 = Math.random();
          } while (u1 <= 0); // Ensure u1 > 0 to avoid log(0)
          
          const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          
          // Apply floor and ceiling constraints
          const weekScore = Math.max(0, Math.min(
            weeklyMean * 3, // Cap at 3x mean
            weeklyMean + z0 * weeklyStdDev
          ));
          
          const startProbability = this.calculateStartProbability(
            player, 
            weekScore, 
            availablePlayers
          );
          
          seasonTotal += weekScore * startProbability;
          weeksPlayed++;
          
          // Check for injury with proper rate
          const injuryRate = this.getInjuryRate(player.position);
          const ageMultiplier = player.age ? 1 + Math.max(0, (player.age - 26) * 0.015) : 1;
          const weeklyInjuryProb = injuryRate * ageMultiplier;
          
          if (Math.random() < weeklyInjuryProb) {
            isInjured = true;
          }
        }
      }
      
      results.push(seasonTotal);
    }
    
    // Return median instead of mean for robustness
    results.sort((a, b) => a - b);
    return results[Math.floor(results.length / 2)];
  }
  
  private getPositionVolatility(position: string): number {
    // Based on historical fantasy volatility data
    const volatility: Record<string, number> = {
      'QB': 0.25,
      'RB': 0.35,
      'WR': 0.40,
      'TE': 0.45,
      'DST': 0.50,
      'K': 0.30
    };
    return volatility[position] || 0.30;
  }
  
  private getInjuryRate(position: string): number {
    const baseRates: Record<string, number> = {
      'QB': 0.015,  // 1.5% weekly injury rate
      'RB': 0.035,  // 3.5% weekly injury rate
      'WR': 0.025,  // 2.5% weekly injury rate
      'TE': 0.020,  // 2.0% weekly injury rate
      'DST': 0.005, // 0.5% weekly injury rate
      'K': 0.003    // 0.3% weekly injury rate
    };
    
    return baseRates[position] || 0.02;
  }
  
  private checkInjury(player: PlayerProjection): boolean {
    const rate = this.getInjuryRate(player.position);
    const ageMultiplier = player.age ? 1 + Math.max(0, (player.age - 26) * 0.015) : 1;
    
    return Math.random() < (rate * ageMultiplier);
  }


  private calculateStartProbability(
    player: PlayerProjection,
    weekPoints: number,
    allPlayers: PlayerProjection[]
  ): number {
    const samePosition = allPlayers.filter(
      p => p.position === player.position && p.id !== player.id
    );
    
    const betterPlayers = samePosition.filter(
      p => p.projectedPoints / 16 > weekPoints
    );
    
    const rosterSpots = this.leagueSettings.rosterPositions;
    const positionSlots = rosterSpots
      .filter(s => s.position === player.position)
      .reduce((sum, s) => sum + s.required, 0);
    
    let flexSlots = 0;
    if (['RB', 'WR', 'TE'].includes(player.position)) {
      flexSlots = rosterSpots
        .filter(s => s.position === 'FLEX')
        .reduce((sum, s) => sum + s.required, 0);
    }
    
    const totalSlots = (positionSlots + flexSlots) * this.leagueSettings.teams;
    const rank = betterPlayers.length + 1;
    
    return Math.max(0, Math.min(1, (totalSlots - rank + 1) / totalSlots));
  }

  private isProjectedStarter(player: PlayerProjection, allPlayers: PlayerProjection[]): boolean {
    const positionPlayers = allPlayers.filter(p => p.position === player.position);
    positionPlayers.sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    const rank = positionPlayers.findIndex(p => p.id === player.id) + 1;
    const rosterSpots = this.leagueSettings.rosterPositions;
    const totalTeams = this.leagueSettings.teams;
    
    if (player.position === 'QB' || player.position === 'DST' || player.position === 'K') {
      const slots = rosterSpots
        .filter(s => s.position === player.position)
        .reduce((sum, s) => sum + s.required, 0);
      return rank <= slots * totalTeams;
    }
    
    // For FLEX-eligible positions
    if (['RB', 'WR', 'TE'].includes(player.position)) {
      const rbSlots = rosterSpots.filter(s => s.position === 'RB').reduce((sum, s) => sum + s.required, 0);
      const wrSlots = rosterSpots.filter(s => s.position === 'WR').reduce((sum, s) => sum + s.required, 0);
      const teSlots = rosterSpots.filter(s => s.position === 'TE').reduce((sum, s) => sum + s.required, 0);
      const flexSlots = rosterSpots.filter(s => s.position === 'FLEX').reduce((sum, s) => sum + s.required, 0);
      
      const totalFlexSlots = (rbSlots + wrSlots + teSlots + flexSlots) * totalTeams;
      
      // Get all FLEX-eligible players
      const flexEligible = allPlayers.filter(p => ['RB', 'WR', 'TE'].includes(p.position));
      flexEligible.sort((a, b) => b.projectedPoints - a.projectedPoints);
      const flexRank = flexEligible.findIndex(p => p.id === player.id) + 1;
      
      return flexRank <= totalFlexSlots;
    }
    
    return false;
  }
  
  /**
   * Two-pass auction value allocation: 80% to starters, 20% to bench.
   * Bench players receive 50% discount on their VORP weights.
   */
  private allocateAuctionValues(
    playersWithVorp: Array<{
      player: PlayerProjection;
      vorp: number;
      weeklyValue: number;
      isStarter: boolean;
      advancedAdjustment: number;
    }>
  ): Map<string, number> {
    const totalTeams = this.leagueSettings.teams;
    const totalBudget = this.leagueSettings.budget * totalTeams;
    const rosterSize = this.leagueSettings.rosterPositions.reduce((sum, slot) => sum + slot.required, 0);
    const minimumSpend = totalTeams * rosterSize; // $1 per roster spot
    const effectiveBudget = totalBudget - minimumSpend;
    
    // Separate starters and bench
    const starters = playersWithVorp.filter(p => p.isStarter && p.vorp > 0);
    const bench = playersWithVorp.filter(p => !p.isStarter && p.vorp > 0);
    
    const sumVorpStarters = starters.reduce((sum, p) => sum + p.vorp, 0);
    const sumVorpBench = bench.reduce((sum, p) => sum + p.vorp, 0);
    
    const auctionValues = new Map<string, number>();
    
    // Pass 1: Allocate 80% of budget to starters
    const starterBudget = effectiveBudget * 0.80;
    for (const p of starters) {
      const share = sumVorpStarters > 0 ? p.vorp / sumVorpStarters : 0;
      const value = share * starterBudget;
      auctionValues.set(p.player.id, Math.max(1, Math.round(value)));
    }
    
    // Pass 2: Allocate 20% of budget to bench
    // Apply discount to weights, not the budget itself to maintain identity
    const benchBudget = effectiveBudget * 0.20;
    const benchDiscount = 0.5; // 50% discount applied to weights
    
    // Calculate weighted VORP for bench players
    const benchWeights = bench.map(p => p.vorp * benchDiscount);
    const sumWeightedBench = benchWeights.reduce((sum, w) => sum + w, 0);
    
    for (let i = 0; i < bench.length; i++) {
      const p = bench[i];
      const weight = benchWeights[i];
      const share = sumWeightedBench > 0 ? weight / sumWeightedBench : 0;
      const value = share * benchBudget; // Full bench budget allocated
      auctionValues.set(p.player.id, Math.max(1, Math.round(value)));
    }
    
    // Set minimum $1 for any player not yet allocated
    for (const p of playersWithVorp) {
      if (!auctionValues.has(p.player.id)) {
        auctionValues.set(p.player.id, 1);
      }
    }
    
    return auctionValues;
  }


  private updateRemainingBudgets(teams: Team[]) {
    for (const team of teams) {
      this.remainingBudget.set(team.id, team.budget - team.spent);
    }
  }

  updateDraftState(draftedPlayerId: string, price: number, teamId: string) {
    this.draftedPlayers.add(draftedPlayerId);
    const currentBudget = this.remainingBudget.get(teamId) || 0;
    this.remainingBudget.set(teamId, currentBudget - price);
  }
}