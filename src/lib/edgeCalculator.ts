import type { 
  PlayerValuation, 
  Team,
  LeagueSettings,
  EdgeContext,
  RosterNeeds,
  Position,
  DraftPick
} from '@/types';

export class EdgeCalculator {
  private leagueSettings: LeagueSettings;
  
  constructor(leagueSettings: LeagueSettings) {
    this.leagueSettings = leagueSettings;
  }

  calculateEdges(
    valuations: PlayerValuation[],
    myTeam: Team,
    allTeams: Team[],
    remainingPlayers: PlayerValuation[]
  ): Map<string, EdgeContext> {
    const rosterNeeds = this.analyzeRosterNeeds(myTeam);
    const edges = new Map<string, EdgeContext>();
    
    for (const player of valuations) {
      const context = this.calculatePlayerEdge(
        player,
        rosterNeeds,
        remainingPlayers,
        myTeam
      );
      edges.set(player.id, context);
    }
    
    return edges;
  }

  private analyzeRosterNeeds(team: Team): RosterNeeds {
    const needs: RosterNeeds = {
      criticalNeeds: new Set<Position | 'FLEX'>(),
      moderateNeeds: new Set<Position>(),
      filled: new Set<Position>(),
      overfilled: new Set<Position>()
    };
    
    const positionCounts = new Map<string, number>();
    for (const pick of team.roster) {
      const pos = pick.player.position;
      positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    }
    
    const flexCount = team.roster.filter(
      p => ['RB', 'WR', 'TE'].includes(p.player.position)
    ).length;
    
    for (const slot of this.leagueSettings.rosterPositions) {
      const current = positionCounts.get(slot.position) || 0;
      
      if (slot.position === 'FLEX') {
        const flexNeeded = slot.required;
        const rbCount = positionCounts.get('RB') || 0;
        const wrCount = positionCounts.get('WR') || 0;
        const teCount = positionCounts.get('TE') || 0;
        
        const rbRequired = this.getPositionRequirement('RB');
        const wrRequired = this.getPositionRequirement('WR');
        const teRequired = this.getPositionRequirement('TE');
        
        const extraRB = Math.max(0, rbCount - rbRequired);
        const extraWR = Math.max(0, wrCount - wrRequired);
        const extraTE = Math.max(0, teCount - teRequired);
        
        const flexFilled = extraRB + extraWR + extraTE;
        
        if (flexFilled < flexNeeded) {
          needs.criticalNeeds.add('FLEX');
          if (rbCount < rbRequired + 1) needs.moderateNeeds.add('RB');
          if (wrCount < wrRequired + 1) needs.moderateNeeds.add('WR');
          if (teCount < teRequired) needs.moderateNeeds.add('TE');
        }
      } else if (slot.position === 'BE') {
        continue;
      } else {
        if (current < slot.required) {
          needs.criticalNeeds.add(slot.position);
        } else if (current === slot.required) {
          needs.filled.add(slot.position);
          if (['RB', 'WR'].includes(slot.position) && current < slot.required + 2) {
            needs.moderateNeeds.add(slot.position);
          }
        } else if (current > slot.required + 2) {
          needs.overfilled.add(slot.position);
        }
      }
    }
    
    return needs;
  }

  private getPositionRequirement(position: string): number {
    return this.leagueSettings.rosterPositions
      .filter(s => s.position === position)
      .reduce((sum, s) => sum + s.required, 0);
  }

  private calculatePlayerEdge(
    player: PlayerValuation,
    rosterNeeds: RosterNeeds,
    remainingPlayers: PlayerValuation[],
    myTeam: Team
  ): EdgeContext {
    const baseEdge = player.intrinsicValue - player.marketPrice;
    
    const rosterAdjustment = this.calculateRosterAdjustment(
      player,
      rosterNeeds
    );
    
    const confidenceAdjustment = this.calculateConfidenceAdjustment(
      player,
      baseEdge
    );
    
    const valueOfWaiting = this.calculateValueOfWaiting(
      player,
      remainingPlayers,
      rosterNeeds
    );
    
    const finalEdge = baseEdge + rosterAdjustment + confidenceAdjustment - valueOfWaiting;
    
    const recommendation = this.getRecommendation(
      finalEdge,
      player,
      rosterNeeds,
      myTeam
    );
    
    const bidRange = this.calculateBidRange(
      player,
      finalEdge,
      rosterNeeds,
      myTeam
    );
    
    return {
      baseEdge,
      rosterAdjustment,
      confidenceAdjustment,
      valueOfWaiting,
      finalEdge,
      recommendation,
      bidRange
    };
  }

  private calculateRosterAdjustment(
    player: PlayerValuation,
    rosterNeeds: RosterNeeds
  ): number {
    let adjustment = 0;
    
    // CRITICAL FIX: More aggressive adjustments for roster needs
    if (rosterNeeds.criticalNeeds.has(player.position)) {
      adjustment += player.intrinsicValue * 0.20; // Increased from 0.15
    } else if (rosterNeeds.moderateNeeds.has(player.position)) {
      adjustment += player.intrinsicValue * 0.08; // Increased from 0.05
    } else if (rosterNeeds.overfilled.has(player.position)) {
      adjustment -= player.intrinsicValue * 0.30; // More aggressive penalty
    }
    
    // FLEX eligibility bonus
    if (['RB', 'WR', 'TE'].includes(player.position)) {
      if (rosterNeeds.criticalNeeds.has('FLEX')) {
        adjustment += player.intrinsicValue * 0.12; // Increased from 0.1
      }
    }
    
    // Elite player at scarce position bonus
    if (player.position === 'QB' || player.position === 'TE') {
      const topTier = player.vorp > 50;
      if (topTier && !rosterNeeds.filled.has(player.position)) {
        adjustment += player.intrinsicValue * 0.1;
      }
    }
    
    return adjustment;
  }

  private calculateConfidenceAdjustment(
    player: PlayerValuation,
    baseEdge: number
  ): number {
    const uncertaintyDiscount = (1 - player.confidence) * Math.abs(baseEdge) * 0.5;
    
    return baseEdge > 0 ? -uncertaintyDiscount : uncertaintyDiscount;
  }

  private calculateValueOfWaiting(
    player: PlayerValuation,
    remainingPlayers: PlayerValuation[],
    rosterNeeds: RosterNeeds
  ): number {
    if (rosterNeeds.criticalNeeds.has(player.position)) {
      return 0;
    }
    
    const similarPlayers = remainingPlayers.filter(
      p => p.position === player.position &&
           p.id !== player.id &&
           Math.abs(p.intrinsicValue - player.intrinsicValue) < 5
    );
    
    if (similarPlayers.length === 0) return 0;
    
    const avgFutureEdge = similarPlayers.reduce(
      (sum, p) => sum + (p.intrinsicValue - p.marketPrice), 0
    ) / similarPlayers.length;
    
    const scarcityPenalty = Math.max(0, 1 - similarPlayers.length / 10);
    
    return Math.max(0, avgFutureEdge * (1 - scarcityPenalty) * 0.7);
  }

  private getRecommendation(
    finalEdge: number,
    player: PlayerValuation,
    rosterNeeds: RosterNeeds,
    myTeam: Team
  ): 'STRONG_BUY' | 'BUY' | 'FAIR' | 'PASS' | 'AVOID' {
    const edgePercent = finalEdge / Math.max(1, player.marketPrice);
    
    // Check budget constraints first
    const remainingBudget = myTeam.budget - myTeam.spent;
    const remainingSlots = 16 - myTeam.roster.length;
    const mustSave = remainingSlots - 1;
    
    if (remainingBudget <= mustSave) {
      return 'AVOID'; // Can't afford anything above $1
    }
    
    // Position-specific recommendations
    if (rosterNeeds.overfilled.has(player.position)) {
      if (edgePercent > 0.50) return 'BUY'; // Only if exceptional value
      return 'AVOID';
    }
    
    if (rosterNeeds.criticalNeeds.has(player.position)) {
      if (edgePercent > -0.20) return 'STRONG_BUY';
      if (edgePercent > -0.30) return 'BUY';
      return 'FAIR';
    }
    
    // Standard thresholds
    if (edgePercent > 0.30) return 'STRONG_BUY';
    if (edgePercent > 0.15) return 'BUY';
    if (edgePercent > -0.05) return 'FAIR';
    if (edgePercent > -0.15) return 'PASS';
    return 'AVOID';
  }

  private calculateBidRange(
    player: PlayerValuation,
    finalEdge: number,
    rosterNeeds: RosterNeeds,
    myTeam: Team
  ): { min: number; max: number } {
    const remainingSlots = this.getRemainingSlots(myTeam.roster);
    const remainingBudget = myTeam.budget - myTeam.spent;
    
    // Must save $1 for each remaining slot except this one
    const mustSave = remainingSlots - 1;
    const availableForThisPlayer = Math.max(1, remainingBudget - mustSave);
    
    // Calculate base bid range
    let baseMax = player.marketPrice + Math.max(0, finalEdge * 0.8);
    let baseMin = player.marketPrice - Math.abs(Math.min(0, finalEdge * 0.3));
    
    // Adjust for roster needs
    if (rosterNeeds.criticalNeeds.has(player.position)) {
      baseMax *= 1.15;
      baseMin *= 1.05;
    } else if (rosterNeeds.overfilled.has(player.position)) {
      baseMax *= 0.85;
      baseMin *= 0.70;
    }
    
    // Cap at available budget
    const max = Math.min(baseMax, availableForThisPlayer, player.intrinsicValue * 1.2);
    const min = Math.min(baseMin, max);
    
    return {
      min: Math.max(1, Math.floor(min)),
      max: Math.max(1, Math.ceil(max))
    };
  }
  
  private getRemainingSlots(roster: DraftPick[]): number {
    const totalRequired = this.leagueSettings.rosterPositions
      .filter(s => s.position !== 'BE')
      .reduce((sum, s) => sum + s.required, 0);
    const currentlyFilled = roster.length;
    return Math.max(0, totalRequired - currentlyFilled);
  }

}