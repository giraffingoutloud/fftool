/**
 * Draft Simulation Test Suite
 * Tests the bid advisor recommendations through complete mock drafts
 */

import { bidAdvisorService } from '../src/lib/bidAdvisorService';
import { calibratedValuationService, type ValuationResult } from '../src/lib/calibratedValuationService';
import type { DraftPick, Team, Player } from '../src/types';
import { loadCleanData } from '../src/lib/cleanDataLoader';

interface SimulationTeam {
  id: string;
  name: string;
  budget: number;
  spent: number;
  roster: Player[];
  strategy: 'balanced' | 'stars-and-scrubs' | 'robust-rb' | 'zero-rb' | 'hero-rb';
  isUser: boolean;
}

interface DraftResult {
  team: SimulationTeam;
  rosterAnalysis: {
    totalSpent: number;
    avgPlayerValue: number;
    positionCounts: Record<string, number>;
    tierDistribution: Record<string, number>;
    projectedPoints: number;
    rosterComplete: boolean;
    meetsRequirements: boolean;
    strengthScore: number;
  };
}

class DraftSimulator {
  private players: ValuationResult[] = [];
  private teams: SimulationTeam[] = [];
  private draftHistory: DraftPick[] = [];
  private availablePlayers: ValuationResult[] = [];
  private currentPick = 0;
  
  constructor() {
    this.initializeTeams();
  }

  private initializeTeams() {
    const strategies: SimulationTeam['strategy'][] = [
      'balanced', 'stars-and-scrubs', 'robust-rb', 'zero-rb', 
      'hero-rb', 'balanced', 'balanced', 'stars-and-scrubs',
      'robust-rb', 'zero-rb', 'balanced', 'balanced'
    ];
    
    this.teams = strategies.map((strategy, idx) => ({
      id: `team_${idx}`,
      name: idx === 0 ? 'My Team (User)' : `Team ${idx + 1}`,
      budget: 200,
      spent: 0,
      roster: [],
      strategy: idx === 0 ? 'robust-rb' : strategy, // User uses robust-rb
      isUser: idx === 0
    }));
  }

  async loadPlayers() {
    console.log('Loading player data...');
    const cleanData = await loadCleanData();
    const valuations = await calibratedValuationService.getAllPlayerValuations();
    
    // Merge data
    this.players = valuations.map(player => ({
      ...player,
      adp: cleanData.players.find(p => 
        p.name === player.playerName || p.player === player.playerName
      )?.adp || 999
    }));
    
    // Sort by value for draft order
    this.players.sort((a, b) => (b.value || 0) - (a.value || 0));
    this.availablePlayers = [...this.players];
    
    console.log(`Loaded ${this.players.length} players`);
  }

  private getNominatedPlayer(): ValuationResult | null {
    // Nominate based on team needs and strategy
    const nominatingTeam = this.teams[this.currentPick % 12];
    
    // Filter available by position needs
    const needs = this.getTeamNeeds(nominatingTeam);
    let candidates = this.availablePlayers.filter(p => needs.includes(p.position));
    
    if (candidates.length === 0) {
      candidates = this.availablePlayers;
    }
    
    // Pick from top candidates based on strategy
    const topCandidates = candidates.slice(0, 20);
    if (topCandidates.length === 0) return null;
    
    // Add some randomness to make it realistic
    const randomIndex = Math.floor(Math.random() * Math.min(5, topCandidates.length));
    return topCandidates[randomIndex];
  }

  private getTeamNeeds(team: SimulationTeam): string[] {
    const counts = this.getPositionCounts(team);
    const needs: string[] = [];
    
    // Check required positions
    if (counts.QB < 1) needs.push('QB');
    if (counts.RB < 2) needs.push('RB');
    if (counts.WR < 2) needs.push('WR');
    if (counts.TE < 1) needs.push('TE');
    if (counts.DST < 1) needs.push('DST');
    if (counts.K < 1) needs.push('K');
    
    // Add flex eligible if needed
    if (team.roster.length < 10) {
      needs.push('RB', 'WR', 'TE');
    }
    
    return needs.length > 0 ? needs : ['RB', 'WR', 'TE', 'QB'];
  }

  private getPositionCounts(team: SimulationTeam): Record<string, number> {
    const counts: Record<string, number> = {
      QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0
    };
    
    team.roster.forEach(player => {
      counts[player.position] = (counts[player.position] || 0) + 1;
    });
    
    return counts;
  }

  private simulateBidding(player: ValuationResult, userTeam: SimulationTeam): number {
    let currentBid = 1;
    let highBidder: SimulationTeam | null = null;
    let bidding = true;
    const maxRounds = 50; // Prevent infinite loops
    let rounds = 0;
    
    while (bidding && rounds < maxRounds) {
      rounds++;
      bidding = false;
      
      for (const team of this.teams) {
        const canAfford = (team.budget - team.spent) > currentBid;
        if (!canAfford) continue;
        
        const shouldBid = this.shouldTeamBid(team, player, currentBid);
        
        if (shouldBid) {
          // Determine bid increment
          const increment = currentBid < 10 ? 1 : currentBid < 30 ? 2 : 5;
          currentBid += increment;
          highBidder = team;
          bidding = true;
          
          // User team uses our recommendation logic
          if (team.isUser) {
            const recommendation = this.getUserRecommendation(player, currentBid, team);
            if (recommendation.action === 'pass' || recommendation.action === 'avoid') {
              // User drops out
              continue;
            }
          }
        }
      }
    }
    
    // Award player to high bidder
    if (highBidder) {
      this.awardPlayer(highBidder, player, currentBid);
    }
    
    return currentBid;
  }

  private shouldTeamBid(team: SimulationTeam, player: ValuationResult, currentBid: number): boolean {
    const budget = team.budget - team.spent;
    const slotsLeft = 16 - team.roster.length;
    const avgBudgetPerSlot = budget / Math.max(1, slotsLeft);
    
    // Don't bid if it would leave less than $1 per remaining slot
    if (currentBid > budget - (slotsLeft - 1)) {
      return false;
    }
    
    // Strategy-based bidding
    const maxBid = this.getMaxBidForStrategy(team, player, budget, slotsLeft);
    
    return currentBid <= maxBid;
  }

  private getMaxBidForStrategy(
    team: SimulationTeam, 
    player: ValuationResult, 
    budget: number,
    slotsLeft: number
  ): number {
    const baseValue = player.value || player.auctionValue || 1;
    let maxBid = baseValue;
    
    switch (team.strategy) {
      case 'stars-and-scrubs':
        // Spend big on elite, cheap on others
        if (player.tier === 'elite' || player.tier === 'tier1') {
          maxBid = baseValue * 1.3;
        } else {
          maxBid = Math.min(5, baseValue * 0.5);
        }
        break;
        
      case 'robust-rb':
        // Overpay for RBs
        if (player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1')) {
          maxBid = baseValue * 1.4;
        } else if (player.position === 'RB') {
          maxBid = baseValue * 1.2;
        } else {
          maxBid = baseValue * 0.8;
        }
        break;
        
      case 'zero-rb':
        // Avoid expensive RBs
        if (player.position === 'RB') {
          maxBid = Math.min(15, baseValue * 0.5);
        } else if (player.position === 'WR') {
          maxBid = baseValue * 1.2;
        }
        break;
        
      case 'hero-rb':
        // One expensive RB, cheap others
        const hasExpensiveRB = team.roster.some(p => 
          p.position === 'RB' && this.getPlayerDraftPrice(p) > 30
        );
        if (player.position === 'RB') {
          maxBid = hasExpensiveRB ? Math.min(10, baseValue * 0.4) : baseValue * 1.3;
        }
        break;
        
      case 'balanced':
      default:
        // Stick close to value
        maxBid = baseValue * 1.1;
        break;
    }
    
    // Never bid more than remaining budget allows
    return Math.min(maxBid, budget - (slotsLeft - 1));
  }

  private getPlayerDraftPrice(player: Player): number {
    const pick = this.draftHistory.find(p => 
      p.player?.id === player.id || p.player?.name === player.name
    );
    return pick?.price || 0;
  }

  private getUserRecommendation(player: ValuationResult, currentBid: number, team: SimulationTeam) {
    // Build context for recommendation
    const context = {
      myTeam: {
        id: team.id,
        name: team.name,
        budget: team.budget - team.spent,
        players: team.roster,
        isUser: true,
        maxBid: team.budget - team.spent,
        nominations: 0
      },
      allTeams: this.teams.map(t => ({
        id: t.id,
        name: t.name,
        budget: t.budget - t.spent,
        players: t.roster,
        isUser: t.isUser,
        maxBid: t.budget - t.spent,
        nominations: 0
      })),
      draftHistory: this.draftHistory,
      availablePlayers: this.availablePlayers,
      currentBid: currentBid,
      totalBudget: 200,
      rosterRequirements: {
        QB: { min: 1, max: 2, optimal: 1 },
        RB: { min: 2, max: 6, optimal: 4 },
        WR: { min: 2, max: 6, optimal: 4 },
        TE: { min: 1, max: 3, optimal: 2 },
        DST: { min: 1, max: 2, optimal: 1 },
        K: { min: 1, max: 2, optimal: 1 },
        FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
        BENCH: 6
      }
    };
    
    return bidAdvisorService.getRecommendation(player, context, currentBid);
  }

  private awardPlayer(team: SimulationTeam, player: ValuationResult, price: number) {
    // Create Player object from ValuationResult
    const playerData: Player = {
      id: player.playerId || `${player.playerName}_${player.team}`,
      name: player.playerName,
      position: player.position as any,
      team: player.team,
      playerId: player.playerId,
      projectedPoints: player.projectedPoints || 0,
      auctionValue: player.auctionValue || 0,
      marketValue: player.marketValue || 0,
      vorp: player.vorp || 0,
      tier: player.tier || 'replacement'
    };
    
    team.roster.push(playerData);
    team.spent += price;
    
    // Add to draft history
    this.draftHistory.push({
      pickNumber: this.draftHistory.length + 1,
      teamId: team.id,
      player: playerData,
      price: price,
      timestamp: new Date()
    });
    
    // Remove from available
    this.availablePlayers = this.availablePlayers.filter(p => 
      p.playerId !== player.playerId
    );
    
    console.log(`${team.name} drafted ${player.playerName} (${player.position}) for $${price}`);
  }

  async runDraft(): Promise<DraftResult[]> {
    console.log('\n=== Starting Draft Simulation ===\n');
    
    // Run until all teams have 16 players or budget exhausted
    while (this.availablePlayers.length > 0 && this.currentPick < 192) {
      const player = this.getNominatedPlayer();
      if (!player) break;
      
      const userTeam = this.teams[0];
      const winningBid = this.simulateBidding(player, userTeam);
      
      this.currentPick++;
      
      // Show progress every 20 picks
      if (this.currentPick % 20 === 0) {
        console.log(`\nPick ${this.currentPick}/192 completed`);
        this.printTeamStatus(userTeam);
      }
    }
    
    console.log('\n=== Draft Complete ===\n');
    return this.analyzeResults();
  }

  private printTeamStatus(team: SimulationTeam) {
    const counts = this.getPositionCounts(team);
    console.log(`${team.name}: $${team.spent}/${team.budget} spent, ${team.roster.length} players`);
    console.log(`  Positions: QB:${counts.QB} RB:${counts.RB} WR:${counts.WR} TE:${counts.TE} DST:${counts.DST} K:${counts.K}`);
  }

  private analyzeResults(): DraftResult[] {
    return this.teams.map(team => {
      const counts = this.getPositionCounts(team);
      const tierDist = this.getTierDistribution(team);
      const projectedPoints = team.roster.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
      
      // Check requirements
      const meetsMin = counts.QB >= 1 && counts.RB >= 2 && counts.WR >= 2 && 
                       counts.TE >= 1 && counts.DST >= 1 && counts.K >= 1;
      const rosterComplete = team.roster.length === 16;
      const budgetEfficient = team.spent >= 190 && team.spent <= 200;
      
      // Calculate strength score (0-100)
      const strengthScore = this.calculateStrengthScore(team, tierDist, projectedPoints);
      
      return {
        team,
        rosterAnalysis: {
          totalSpent: team.spent,
          avgPlayerValue: team.spent / Math.max(1, team.roster.length),
          positionCounts: counts,
          tierDistribution: tierDist,
          projectedPoints,
          rosterComplete,
          meetsRequirements: meetsMin && rosterComplete && budgetEfficient,
          strengthScore
        }
      };
    });
  }

  private getTierDistribution(team: SimulationTeam): Record<string, number> {
    const dist: Record<string, number> = {
      elite: 0, tier1: 0, tier2: 0, tier3: 0, replacement: 0
    };
    
    team.roster.forEach(player => {
      const tier = player.tier || 'replacement';
      dist[tier] = (dist[tier] || 0) + 1;
    });
    
    return dist;
  }

  private calculateStrengthScore(
    team: SimulationTeam, 
    tierDist: Record<string, number>,
    projectedPoints: number
  ): number {
    let score = 0;
    
    // Points contribution (40%)
    const maxPoints = 1800; // Approximate max for a team
    score += (projectedPoints / maxPoints) * 40;
    
    // Tier distribution (30%)
    const tierScore = (tierDist.elite * 10 + tierDist.tier1 * 7 + 
                      tierDist.tier2 * 4 + tierDist.tier3 * 2) / 16;
    score += tierScore * 3;
    
    // Position balance (20%)
    const counts = this.getPositionCounts(team);
    const balance = (
      (counts.QB >= 1 ? 3 : 0) +
      (counts.RB >= 3 ? 4 : counts.RB * 1.3) +
      (counts.WR >= 3 ? 4 : counts.WR * 1.3) +
      (counts.TE >= 1 ? 3 : 0) +
      (counts.DST >= 1 ? 3 : 0) +
      (counts.K >= 1 ? 3 : 0)
    );
    score += balance;
    
    // Budget efficiency (10%)
    const budgetScore = team.spent >= 190 ? 10 : (team.spent / 190) * 10;
    score += budgetScore;
    
    return Math.round(Math.min(100, score));
  }
}

// Run simulation
async function runSimulation() {
  const simulator = new DraftSimulator();
  await simulator.loadPlayers();
  
  const results = await simulator.runDraft();
  
  // Print detailed results
  console.log('\n=== DRAFT RESULTS ===\n');
  
  results.forEach((result, idx) => {
    console.log(`\n${result.team.name} (${result.team.strategy} strategy)`);
    console.log('=' .repeat(50));
    console.log(`Budget: $${result.rosterAnalysis.totalSpent}/200 spent`);
    console.log(`Roster: ${result.team.roster.length}/16 players`);
    console.log(`Avg Value: $${result.rosterAnalysis.avgPlayerValue.toFixed(1)}`);
    console.log(`Projected Points: ${result.rosterAnalysis.projectedPoints.toFixed(0)}`);
    console.log(`Strength Score: ${result.rosterAnalysis.strengthScore}/100`);
    console.log(`Meets Requirements: ${result.rosterAnalysis.meetsRequirements ? '✅' : '❌'}`);
    
    console.log('\nPosition Distribution:');
    Object.entries(result.rosterAnalysis.positionCounts).forEach(([pos, count]) => {
      console.log(`  ${pos}: ${count}`);
    });
    
    console.log('\nTier Distribution:');
    Object.entries(result.rosterAnalysis.tierDistribution).forEach(([tier, count]) => {
      if (count > 0) console.log(`  ${tier}: ${count}`);
    });
    
    if (idx === 0) {
      // Show user team roster details
      console.log('\nUser Team Roster:');
      result.team.roster.forEach(player => {
        const pick = simulator['draftHistory'].find(p => p.player?.id === player.id);
        console.log(`  ${player.name} (${player.position}) - $${pick?.price || 0} - ${player.tier}`);
      });
    }
  });
  
  // Summary for user team
  const userResult = results[0];
  console.log('\n' + '=' .repeat(50));
  console.log('USER TEAM ANALYSIS:');
  console.log('=' .repeat(50));
  
  if (userResult.rosterAnalysis.meetsRequirements) {
    console.log('✅ Successfully drafted a complete, valid roster!');
  } else {
    console.log('❌ Issues with roster:');
    if (!userResult.rosterAnalysis.rosterComplete) {
      console.log('  - Incomplete roster');
    }
    if (userResult.rosterAnalysis.totalSpent < 190) {
      console.log('  - Under-spent budget');
    }
    const counts = userResult.rosterAnalysis.positionCounts;
    if (counts.QB < 1) console.log('  - Missing QB');
    if (counts.RB < 2) console.log('  - Not enough RBs');
    if (counts.WR < 2) console.log('  - Not enough WRs');
    if (counts.TE < 1) console.log('  - Missing TE');
  }
  
  console.log(`\nStrength Score: ${userResult.rosterAnalysis.strengthScore}/100`);
  console.log(`Projected Points: ${userResult.rosterAnalysis.projectedPoints.toFixed(0)}`);
}

// Run the simulation
runSimulation().catch(console.error);