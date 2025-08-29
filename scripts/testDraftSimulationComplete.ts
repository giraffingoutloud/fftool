/**
 * Complete Draft Simulation Test
 * Ensures all rosters are filled with proper position requirements
 */

// Set up environment variable for BASE_URL before imports
process.env.BASE_URL = '/';

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
  nominations: number;
}

interface DraftPick {
  pickNumber: number;
  teamId: string;
  player: Player;
  price: number;
  timestamp: Date;
}

class CompleteDraftSim {
  private allPlayers: ValuationResult[] = [];
  private availablePlayers: ValuationResult[] = [];
  private teams: SimTeam[] = [];
  private draftHistory: DraftPick[] = [];
  private pickNumber = 0;
  private nominationOrder: number = 0;

  constructor() {
    // Initialize 12 teams
    this.teams = Array.from({ length: 12 }, (_, i) => ({
      id: `team_${i}`,
      name: i === 0 ? 'User Team' : `Team ${i + 1}`,
      budget: 200,
      spent: 0,
      roster: [],
      strategy: i === 0 ? 'robust-rb' : ['balanced', 'stars', 'zero-rb'][i % 3],
      isUser: i === 0,
      nominations: 0
    }));
  }

  async initialize() {
    console.log('Loading player data...');
    
    // Load clean data using the cleanDataLoader
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
      .slice(0, 300); // Top 300 players to ensure enough for all teams
    
    this.availablePlayers = [...this.allPlayers];
    
    console.log(`Loaded ${this.allPlayers.length} draftable players`);
  }

  private getTeamNeeds(team: SimTeam): string[] {
    const posCounts: Record<string, number> = {};
    team.roster.forEach(p => {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1;
    });

    const needs: string[] = [];
    const slotsLeft = 16 - team.roster.length;
    
    // Priority order based on requirements
    if ((posCounts.QB || 0) < 1) needs.push('QB');
    if ((posCounts.RB || 0) < 2) needs.push('RB');
    if ((posCounts.WR || 0) < 2) needs.push('WR');
    if ((posCounts.TE || 0) < 1) needs.push('TE');
    if ((posCounts.DST || 0) < 1 && slotsLeft > 1) needs.push('DST');
    if ((posCounts.K || 0) < 1 && slotsLeft > 1) needs.push('K');
    
    // Fill out with best available after minimums
    if (needs.length === 0) {
      if ((posCounts.RB || 0) < 5) needs.push('RB');
      if ((posCounts.WR || 0) < 5) needs.push('WR');
      if ((posCounts.TE || 0) < 2) needs.push('TE');
      if ((posCounts.QB || 0) < 2) needs.push('QB');
    }

    return needs;
  }

  private nominatePlayer(): ValuationResult | null {
    const nominatingTeam = this.teams[this.nominationOrder % 12];
    const teamNeeds = this.getTeamNeeds(nominatingTeam);
    
    // First try to nominate based on team needs
    if (teamNeeds.length > 0) {
      const neededPlayers = this.availablePlayers.filter(p => 
        teamNeeds.includes(p.position)
      );
      
      if (neededPlayers.length > 0) {
        // Nominate top player for needed position
        return neededPlayers[0];
      }
    }
    
    // Otherwise nominate best available
    if (this.availablePlayers.length > 0) {
      // Late in draft, nominate cheaper players
      const draftProgress = this.pickNumber / 192;
      if (draftProgress > 0.7) {
        // Find players worth $5 or less
        const cheapPlayers = this.availablePlayers.filter(p => (p.value || 0) <= 5);
        if (cheapPlayers.length > 0) {
          return cheapPlayers[Math.floor(Math.random() * Math.min(10, cheapPlayers.length))];
        }
      }
      
      // Otherwise top 20 available with some randomness
      const topN = Math.min(20, this.availablePlayers.length);
      const idx = Math.floor(Math.random() * topN);
      return this.availablePlayers[idx];
    }
    
    return null;
  }

  private simulateAuction(player: ValuationResult): { winner: SimTeam; price: number } | null {
    let currentBid = 1;
    let leadingTeam: SimTeam | null = null;
    const baseValue = player.value || 1;
    
    // Track bidding rounds to simulate back-and-forth
    let biddingRounds = 0;
    const maxRounds = 10;
    
    while (biddingRounds < maxRounds) {
      let newBidder: SimTeam | null = null;
      let highestBid = currentBid;
      
      // Each team evaluates if they want to bid higher
      for (const team of this.teams) {
        if (team === leadingTeam) continue; // Can't outbid yourself
        
        const budget = team.budget - team.spent;
        const slotsLeft = 16 - team.roster.length;
        
        // Must save $1 per remaining slot
        const maxAfford = budget - (slotsLeft - 1);
        if (maxAfford <= currentBid) continue;
        
        // Get team needs
        const teamNeeds = this.getTeamNeeds(team);
        const needsPlayer = teamNeeds.includes(player.position);
        
        // Determine team's max bid based on strategy
        let teamMax = baseValue;
        
        if (team.isUser) {
          // User team uses our recommendation system
          const context = this.buildContext(team);
          const rec = bidAdvisorService.getRecommendation(player, context, currentBid);
          
          // Bid based on recommendation
          if (rec.action === 'strong-buy') {
            teamMax = rec.maxBid;
          } else if (rec.action === 'consider') {
            teamMax = rec.maxBid * 0.95; // Slightly less aggressive for consider
          } else {
            continue; // Skip if not recommended
          }
        } else {
          // AI teams use strategy-based bidding
          const positionCounts: Record<string, number> = {};
          team.roster.forEach(p => {
            positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
          });
          
          // Adjust based on needs
          if (needsPlayer && slotsLeft <= 5) {
            teamMax = baseValue * 1.3; // Pay up for needs late
          } else if (team.strategy === 'stars' && player.tier === 'elite') {
            teamMax = baseValue * 1.25;
          } else if (team.strategy === 'zero-rb' && player.position === 'RB') {
            teamMax = baseValue * 0.6;
          } else if (team.strategy === 'balanced') {
            teamMax = baseValue * (0.95 + Math.random() * 0.15);
          } else {
            teamMax = baseValue * (0.9 + Math.random() * 0.25);
          }
          
          // Be more aggressive for scarce positions
          if (player.position === 'QB' && (positionCounts.QB || 0) === 0) {
            teamMax *= 1.15;
          }
          if (player.position === 'TE' && (positionCounts.TE || 0) === 0 && player.tier !== 'replacement') {
            teamMax *= 1.1;
          }
        }
        
        // Determine bid increment
        const increment = currentBid < 10 ? 1 : currentBid < 30 ? 2 : 3;
        const bidAmount = Math.min(currentBid + increment, Math.floor(teamMax), maxAfford);
        
        if (bidAmount > highestBid) {
          highestBid = bidAmount;
          newBidder = team;
        }
      }
      
      if (newBidder) {
        currentBid = highestBid;
        leadingTeam = newBidder;
        biddingRounds++;
      } else {
        break; // No more bids
      }
    }
    
    if (leadingTeam) {
      return { winner: leadingTeam, price: currentBid };
    }
    
    // If no one bid, force sale for $1 to team with most budget and need
    const needyTeams = this.teams
      .filter(t => t.roster.length < 16 && t.budget - t.spent >= 16 - t.roster.length)
      .sort((a, b) => {
        const aNeeds = this.getTeamNeeds(a);
        const bNeeds = this.getTeamNeeds(b);
        if (aNeeds.includes(player.position) && !bNeeds.includes(player.position)) return -1;
        if (!aNeeds.includes(player.position) && bNeeds.includes(player.position)) return 1;
        return (b.budget - b.spent) - (a.budget - a.spent);
      });
    
    if (needyTeams.length > 0) {
      return { winner: needyTeams[0], price: 1 };
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
        maxBid: team.budget - team.spent - (16 - team.roster.length - 1),
        nominations: team.nominations
      },
      allTeams: this.teams.map(t => ({
        id: t.id,
        name: t.name,
        budget: t.budget - t.spent,
        players: t.roster,
        isUser: t.isUser,
        maxBid: t.budget - t.spent - (16 - t.roster.length - 1),
        nominations: t.nominations
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
    console.log('\n=== STARTING COMPLETE DRAFT SIMULATION ===\n');
    
    // Continue until all teams have 16 players
    while (this.teams.some(t => t.roster.length < 16) && this.availablePlayers.length > 0) {
      const player = this.nominatePlayer();
      if (!player) break;
      
      const result = this.simulateAuction(player);
      if (result) {
        this.awardPlayer(result.winner, player, result.price);
        
        if (result.winner.isUser) {
          const posCounts: Record<string, number> = {};
          result.winner.roster.forEach(p => {
            posCounts[p.position] = (posCounts[p.position] || 0) + 1;
          });
          console.log(`USER [${result.winner.roster.length}/16]: ${player.playerName} (${player.position}/${player.tier}) for $${result.price} | RB:${posCounts.RB || 0} WR:${posCounts.WR || 0} QB:${posCounts.QB || 0} TE:${posCounts.TE || 0}`);
        } else if (this.pickNumber % 15 === 0) {
          console.log(`Pick ${this.pickNumber}: ${player.playerName} to ${result.winner.name} for $${result.price}`);
        }
      }
      
      // Increment nomination order
      this.nominationOrder++;
    }
    
    console.log(`\nDraft complete after ${this.pickNumber} picks\n`);
    this.analyzeResults();
  }

  private analyzeResults() {
    console.log('=== FINAL DRAFT RESULTS ===\n');
    
    // Sort teams by projected points for ranking
    const teamResults: Array<{team: SimTeam, points: number, rbSpend: number}> = [];
    
    for (const team of this.teams) {
      const posCounts: Record<string, number> = {};
      const posSpend: Record<string, number> = {};
      let totalPoints = 0;
      
      team.roster.forEach(p => {
        posCounts[p.position] = (posCounts[p.position] || 0) + 1;
        totalPoints += p.projectedPoints || 0;
        
        const pick = this.draftHistory.find(d => d.player.id === p.id);
        if (pick) {
          posSpend[p.position] = (posSpend[p.position] || 0) + pick.price;
        }
      });
      
      const rbSpend = posSpend.RB || 0;
      teamResults.push({ team, points: totalPoints, rbSpend });
      
      if (team.isUser) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`USER TEAM RESULTS (${team.strategy})`);
        console.log(`${'='.repeat(50)}`);
        console.log(`\nBudget: $${team.spent}/$200 (${(team.spent/200*100).toFixed(0)}% spent)`);
        console.log(`Players: ${team.roster.length}/16`);
        console.log(`\nPosition Breakdown:`);
        console.log(`  QB: ${posCounts.QB || 0} players, $${posSpend.QB || 0}`);
        console.log(`  RB: ${posCounts.RB || 0} players, $${posSpend.RB || 0} (${(rbSpend/team.spent*100).toFixed(0)}% of budget)`);
        console.log(`  WR: ${posCounts.WR || 0} players, $${posSpend.WR || 0} (${((posSpend.WR || 0)/team.spent*100).toFixed(0)}% of budget)`);
        console.log(`  TE: ${posCounts.TE || 0} players, $${posSpend.TE || 0}`);
        console.log(`  DST: ${posCounts.DST || 0} players, $${posSpend.DST || 0}`);
        console.log(`  K: ${posCounts.K || 0} players, $${posSpend.K || 0}`);
        
        console.log(`\nFull Roster:`);
        
        // Sort by price for display
        const sortedRoster = [...team.roster].sort((a, b) => {
          const pickA = this.draftHistory.find(d => d.player.id === a.id);
          const pickB = this.draftHistory.find(d => d.player.id === b.id);
          return (pickB?.price || 0) - (pickA?.price || 0);
        });
        
        sortedRoster.forEach(p => {
          const pick = this.draftHistory.find(d => d.player.id === p.id);
          console.log(`  ${p.name.padEnd(25)} ${p.position.padEnd(3)} ${p.tier.padEnd(11)} $${(pick?.price || 0).toString().padStart(3)} ${p.projectedPoints.toFixed(0).padStart(4)}pts`);
        });
        
        // Check requirements
        const meetsReqs = 
          (posCounts.QB || 0) >= 1 &&
          (posCounts.RB || 0) >= 2 &&
          (posCounts.WR || 0) >= 2 &&
          (posCounts.TE || 0) >= 1 &&
          (posCounts.DST || 0) >= 1 &&
          (posCounts.K || 0) >= 1;
        
        console.log(`\nRoster Analysis:`);
        console.log(`  Meets requirements: ${meetsReqs ? '✅' : '❌'}`);
        console.log(`  Budget efficiency: ${team.spent >= 190 ? '✅' : '⚠️'} ($${200 - team.spent} remaining)`);
        console.log(`  RB-heavy strategy: ${rbSpend >= team.spent * 0.5 ? '✅' : '❌'} (${(rbSpend/team.spent*100).toFixed(0)}% on RBs)`);
        
        // Count elite/tier1 RBs
        const eliteRBs = team.roster.filter(p => p.position === 'RB' && (p.tier === 'elite' || p.tier === 'tier1'));
        console.log(`  Elite/Tier1 RBs: ${eliteRBs.length} ${eliteRBs.length >= 2 ? '✅' : '⚠️'}`);
        if (eliteRBs.length > 0) {
          eliteRBs.forEach(rb => {
            const pick = this.draftHistory.find(d => d.player.id === rb.id);
            console.log(`    - ${rb.name} ($${pick?.price || 0})`);
          });
        }
        
        console.log(`\n  Projected Points: ${totalPoints.toFixed(0)}`);
      }
    }
    
    // Show league rankings
    teamResults.sort((a, b) => b.points - a.points);
    console.log(`\n${'='.repeat(50)}`);
    console.log('LEAGUE STANDINGS (by projected points)');
    console.log(`${'='.repeat(50)}`);
    teamResults.forEach((tr, idx) => {
      const userTag = tr.team.isUser ? ' 👤' : '';
      console.log(`${(idx + 1).toString().padStart(2)}. ${tr.team.name.padEnd(15)} ${tr.points.toFixed(0).padStart(4)}pts  $${tr.team.spent.padStart(3)} spent${userTag}`);
    });
  }
}

// Run multiple simulations
async function main() {
  console.log('Running complete draft simulations...\n');
  
  for (let i = 0; i < 3; i++) {
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`SIMULATION ${i + 1}`);
    console.log(`${'#'.repeat(60)}`);
    
    try {
      const sim = new CompleteDraftSim();
      await sim.initialize();
      await sim.runDraft();
    } catch (error) {
      console.error('Simulation failed:', error);
    }
    
    if (i < 2) {
      console.log('\n\nWaiting before next simulation...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main();