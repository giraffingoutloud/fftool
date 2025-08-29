/**
 * Simplified Draft Simulation Test
 * Tests recommendation logic through mock drafts
 */

import { bidAdvisorService } from '../src/lib/bidAdvisorService.js';
import { calibratedValuationService } from '../src/lib/calibratedValuationService.js';
import { cleanDataLoader } from '../src/lib/cleanDataLoader.js';
import type { ValuationResult } from '../src/lib/calibratedValuationService.js';
import type { Player } from '../src/types.js';

interface SimTeam {
  id: string;
  name: string;
  budget: number;
  spent: number;
  roster: Player[];
  strategy: string;
  isUser: boolean;
}

interface DraftPick {
  pickNumber: number;
  teamId: string;
  player: Player;
  price: number;
  timestamp: Date;
}

class SimpleDraftSim {
  private allPlayers: ValuationResult[] = [];
  private availablePlayers: ValuationResult[] = [];
  private teams: SimTeam[] = [];
  private draftHistory: DraftPick[] = [];
  private pickNumber = 0;

  constructor() {
    // Initialize 12 teams
    this.teams = Array.from({ length: 12 }, (_, i) => ({
      id: `team_${i}`,
      name: i === 0 ? 'User Team' : `Team ${i + 1}`,
      budget: 200,
      spent: 0,
      roster: [],
      strategy: i === 0 ? 'robust-rb' : ['balanced', 'stars', 'zero-rb'][i % 3],
      isUser: i === 0
    }));
  }

  async initialize() {
    console.log('Loading player data...');
    
    // Load clean data
    const dataResult = await cleanDataLoader.loadData();
    if (!dataResult.success) {
      throw new Error('Failed to load clean data');
    }
    
    // Get valuations
    const valuations = await calibratedValuationService.getAllPlayerValuations();
    
    // Filter to draftable players and sort by value
    this.allPlayers = valuations
      .filter(p => p.value && p.value > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 250); // Top 250 players
    
    this.availablePlayers = [...this.allPlayers];
    
    console.log(`Loaded ${this.allPlayers.length} draftable players`);
  }

  private getRandomAvailablePlayer(): ValuationResult | null {
    if (this.availablePlayers.length === 0) return null;
    
    // Prefer top players but add randomness
    const topN = Math.min(30, this.availablePlayers.length);
    const idx = Math.floor(Math.random() * topN);
    return this.availablePlayers[idx];
  }

  private simulateAuction(player: ValuationResult): { winner: SimTeam; price: number } | null {
    let currentBid = 1;
    let leadingTeam: SimTeam | null = null;
    const maxBid = player.value || 1;
    
    // Each team evaluates if they want the player
    for (const team of this.teams) {
      const budget = team.budget - team.spent;
      const slotsLeft = 16 - team.roster.length;
      
      // Must save $1 per remaining slot
      const maxAfford = budget - (slotsLeft - 1);
      if (maxAfford < currentBid) continue;
      
      // Determine team's max bid based on strategy
      let teamMax = maxBid;
      
      if (team.isUser) {
        // User team uses our recommendation system
        const context = this.buildContext(team);
        const rec = bidAdvisorService.getRecommendation(player, context, currentBid);
        
        // Bid up to maxBid if recommended
        if (rec.action === 'strong-buy' || rec.action === 'consider') {
          teamMax = Math.min(rec.maxBid, maxAfford);
        } else {
          continue; // Skip if not recommended
        }
      } else {
        // AI teams use simple strategy
        if (team.strategy === 'stars' && player.tier === 'elite') {
          teamMax = maxBid * 1.3;
        } else if (team.strategy === 'zero-rb' && player.position === 'RB') {
          teamMax = maxBid * 0.5;
        } else {
          teamMax = maxBid * (0.9 + Math.random() * 0.3); // 90-120% of value
        }
      }
      
      // Bid if within budget
      const bidAmount = Math.min(teamMax, maxAfford);
      if (bidAmount > currentBid) {
        currentBid = bidAmount;
        leadingTeam = team;
      }
    }
    
    if (leadingTeam) {
      return { winner: leadingTeam, price: Math.round(currentBid) };
    }
    
    return null;
  }

  private buildContext(team: SimTeam) {
    return {
      myTeam: {
        id: team.id,
        name: team.name,
        budget: team.budget - team.spent,
        players: team.roster,
        isUser: team.isUser,
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
      currentBid: 0,
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
  }

  private awardPlayer(team: SimTeam, player: ValuationResult, price: number) {
    // Convert to Player type
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
    
    this.draftHistory.push({
      pickNumber: ++this.pickNumber,
      teamId: team.id,
      player: playerData,
      price,
      timestamp: new Date()
    });
    
    // Remove from available
    this.availablePlayers = this.availablePlayers.filter(p => 
      p.playerId !== player.playerId
    );
  }

  async runDraft() {
    console.log('\n=== STARTING DRAFT SIMULATION ===\n');
    
    // Continue until teams are full or no good players left
    while (this.pickNumber < 192 && this.availablePlayers.length > 0) {
      const player = this.getRandomAvailablePlayer();
      if (!player) break;
      
      const result = this.simulateAuction(player);
      if (result) {
        this.awardPlayer(result.winner, player, result.price);
        
        if (result.winner.isUser) {
          console.log(`USER: ${player.playerName} (${player.position}) for $${result.price}`);
        } else if (this.pickNumber % 10 === 0) {
          console.log(`Pick ${this.pickNumber}: ${player.playerName} to ${result.winner.name} for $${result.price}`);
        }
      }
      
      // Stop if all teams have enough players
      const allFull = this.teams.every(t => t.roster.length >= 15);
      if (allFull) break;
    }
    
    console.log(`\nDraft complete after ${this.pickNumber} picks\n`);
    this.analyzeResults();
  }

  private analyzeResults() {
    console.log('=== DRAFT RESULTS ===\n');
    
    for (const team of this.teams) {
      const posCounts: Record<string, number> = {};
      let totalPoints = 0;
      
      team.roster.forEach(p => {
        posCounts[p.position] = (posCounts[p.position] || 0) + 1;
        totalPoints += p.projectedPoints || 0;
      });
      
      console.log(`\n${team.name} (${team.strategy})`);
      console.log(`  Spent: $${team.spent}/$200`);
      console.log(`  Players: ${team.roster.length}`);
      console.log(`  Positions: QB:${posCounts.QB || 0} RB:${posCounts.RB || 0} WR:${posCounts.WR || 0} TE:${posCounts.TE || 0}`);
      console.log(`  Projected Points: ${totalPoints.toFixed(0)}`);
      
      if (team.isUser) {
        console.log('\n  USER ROSTER:');
        team.roster.forEach(p => {
          const pick = this.draftHistory.find(d => d.player.id === p.id);
          console.log(`    ${p.name} (${p.position}) - $${pick?.price || 0} - ${p.tier}`);
        });
        
        // Check if roster meets requirements
        const meetsReqs = 
          (posCounts.QB || 0) >= 1 &&
          (posCounts.RB || 0) >= 2 &&
          (posCounts.WR || 0) >= 2 &&
          (posCounts.TE || 0) >= 1;
        
        console.log(`\n  Meets minimum requirements: ${meetsReqs ? '✅' : '❌'}`);
        console.log(`  Budget efficiency: ${team.spent >= 190 ? '✅' : '❌'} ($${team.spent} spent)`);
      }
    }
  }
}

// Run simulation
async function main() {
  try {
    const sim = new SimpleDraftSim();
    await sim.initialize();
    await sim.runDraft();
  } catch (error) {
    console.error('Simulation failed:', error);
  }
}

main();