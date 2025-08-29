/**
 * Test Recommendation Logic Through Simulated Drafts
 * Standalone test that doesn't require browser environment
 */

import { bidAdvisorService } from '../src/lib/bidAdvisorService.js';
import type { ValuationResult } from '../src/lib/calibratedValuationService.js';
import type { Player } from '../src/types.js';
import * as fs from 'fs';
import * as path from 'path';

// Load test data directly from CSV
function loadTestPlayers(): ValuationResult[] {
  console.log('Loading test player data...');
  
  // Create mock players with realistic values
  const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
  const tiers = ['elite', 'tier1', 'tier2', 'tier3', 'replacement'];
  const players: ValuationResult[] = [];
  
  // Elite RBs
  ['CMC', 'Breece Hall', 'Bijan Robinson', 'Jonathan Taylor', 'Saquon Barkley'].forEach((name, i) => {
    players.push({
      playerId: `rb_elite_${i}`,
      playerName: name,
      position: 'RB',
      team: 'NYG',
      tier: 'elite',
      rank: i + 1,
      value: 75 - i * 5, // 75, 70, 65, 60, 55
      auctionValue: 75 - i * 5,
      marketValue: 73 - i * 5,
      intrinsicValue: 75 - i * 5,
      edge: 2,
      projectedPoints: 320 - i * 10,
      vorp: 150 - i * 10,
      adp: i + 1,
      confidence: 9,
      vbd: 150 - i * 10
    });
  });
  
  // Tier 1 RBs
  ['Gibbs', 'Etienne', 'Jacobs', 'Cook', 'Kamara', 'Mixon'].forEach((name, i) => {
    players.push({
      playerId: `rb_tier1_${i}`,
      playerName: name,
      position: 'RB',
      team: 'DET',
      tier: 'tier1',
      rank: 6 + i,
      value: 45 - i * 3,
      auctionValue: 45 - i * 3,
      marketValue: 43 - i * 3,
      intrinsicValue: 45 - i * 3,
      edge: 2,
      projectedPoints: 250 - i * 8,
      vorp: 80 - i * 5,
      adp: 15 + i,
      confidence: 8,
      vbd: 80 - i * 5
    });
  });
  
  // Elite WRs
  ['Jefferson', 'Chase', 'Lamb', 'Hill', 'St. Brown'].forEach((name, i) => {
    players.push({
      playerId: `wr_elite_${i}`,
      playerName: name,
      position: 'WR',
      team: 'MIN',
      tier: 'elite',
      rank: i + 1,
      value: 60 - i * 4,
      auctionValue: 60 - i * 4,
      marketValue: 58 - i * 4,
      intrinsicValue: 60 - i * 4,
      edge: 2,
      projectedPoints: 280 - i * 10,
      vorp: 120 - i * 8,
      adp: 5 + i,
      confidence: 9,
      vbd: 120 - i * 8
    });
  });
  
  // Tier 1 WRs
  ['Adams', 'Diggs', 'Brown', 'Wilson', 'Olave', 'Waddle'].forEach((name, i) => {
    players.push({
      playerId: `wr_tier1_${i}`,
      playerName: name,
      position: 'WR',
      team: 'LV',
      tier: 'tier1',
      rank: 6 + i,
      value: 35 - i * 2,
      auctionValue: 35 - i * 2,
      marketValue: 33 - i * 2,
      intrinsicValue: 35 - i * 2,
      edge: 2,
      projectedPoints: 220 - i * 7,
      vorp: 70 - i * 4,
      adp: 20 + i,
      confidence: 8,
      vbd: 70 - i * 4
    });
  });
  
  // QBs
  ['Allen', 'Mahomes', 'Hurts', 'Jackson', 'Burrow'].forEach((name, i) => {
    players.push({
      playerId: `qb_${i}`,
      playerName: name,
      position: 'QB',
      team: 'BUF',
      tier: i < 2 ? 'elite' : 'tier1',
      rank: i + 1,
      value: 25 - i * 3,
      auctionValue: 25 - i * 3,
      marketValue: 24 - i * 3,
      intrinsicValue: 25 - i * 3,
      edge: 1,
      projectedPoints: 380 - i * 15,
      vorp: 60 - i * 5,
      adp: 25 + i * 3,
      confidence: 8,
      vbd: 60 - i * 5
    });
  });
  
  // TEs
  ['Kelce', 'Andrews', 'Hockenson', 'Pitts', 'Waller'].forEach((name, i) => {
    players.push({
      playerId: `te_${i}`,
      playerName: name,
      position: 'TE',
      team: 'KC',
      tier: i === 0 ? 'elite' : i < 3 ? 'tier1' : 'tier2',
      rank: i + 1,
      value: i === 0 ? 30 : 15 - i * 2,
      auctionValue: i === 0 ? 30 : 15 - i * 2,
      marketValue: i === 0 ? 28 : 14 - i * 2,
      intrinsicValue: i === 0 ? 30 : 15 - i * 2,
      edge: 2,
      projectedPoints: 180 - i * 15,
      vorp: 50 - i * 8,
      adp: 30 + i * 5,
      confidence: 7,
      vbd: 50 - i * 8
    });
  });
  
  // Add more tier 2/3 players
  for (let i = 0; i < 100; i++) {
    const pos = positions[Math.floor(i / 20) % 4]; // RB, WR, TE, QB
    players.push({
      playerId: `player_${i}`,
      playerName: `Player${i}`,
      position: pos,
      team: 'FA',
      tier: i < 40 ? 'tier2' : i < 70 ? 'tier3' : 'replacement',
      rank: 50 + i,
      value: Math.max(1, 20 - Math.floor(i / 5)),
      auctionValue: Math.max(1, 20 - Math.floor(i / 5)),
      marketValue: Math.max(1, 19 - Math.floor(i / 5)),
      intrinsicValue: Math.max(1, 20 - Math.floor(i / 5)),
      edge: 1,
      projectedPoints: 150 - i,
      vorp: Math.max(0, 30 - i / 2),
      adp: 60 + i,
      confidence: 6,
      vbd: Math.max(0, 30 - i / 2)
    });
  }
  
  // Add DST and K
  for (let i = 0; i < 15; i++) {
    players.push({
      playerId: `dst_${i}`,
      playerName: `DST${i}`,
      position: 'DST',
      team: 'FA',
      tier: i < 3 ? 'tier1' : 'tier2',
      rank: 150 + i,
      value: Math.max(1, 5 - i),
      auctionValue: Math.max(1, 5 - i),
      marketValue: Math.max(1, 4 - i),
      intrinsicValue: Math.max(1, 5 - i),
      edge: 1,
      projectedPoints: 120 - i * 3,
      vorp: 10 - i,
      adp: 150 + i,
      confidence: 5,
      vbd: 10 - i
    });
    
    players.push({
      playerId: `k_${i}`,
      playerName: `K${i}`,
      position: 'K',
      team: 'FA',
      tier: i < 3 ? 'tier1' : 'tier2',
      rank: 170 + i,
      value: Math.max(1, 3 - i),
      auctionValue: Math.max(1, 3 - i),
      marketValue: Math.max(1, 2 - i),
      intrinsicValue: Math.max(1, 3 - i),
      edge: 1,
      projectedPoints: 130 - i * 2,
      vorp: 5 - i,
      adp: 170 + i,
      confidence: 5,
      vbd: 5 - i
    });
  }
  
  console.log(`Created ${players.length} test players`);
  return players;
}

interface SimTeam {
  id: string;
  name: string;
  budget: number;
  roster: Player[];
  strategy: string;
}

class RecommendationTester {
  private players: ValuationResult[] = [];
  private availablePlayers: ValuationResult[] = [];
  private teams: SimTeam[] = [];
  private draftHistory: any[] = [];
  private draftResults: any[] = [];

  constructor() {
    // Create 12 teams
    this.teams = Array.from({ length: 12 }, (_, i) => ({
      id: `team_${i}`,
      name: i === 0 ? 'User (Robust RB)' : `Team ${i + 1}`,
      budget: 200,
      roster: [],
      strategy: i === 0 ? 'robust-rb' : ['balanced', 'stars', 'zero-rb'][i % 3]
    }));
  }

  async runTest() {
    console.log('\n=== RECOMMENDATION SYSTEM TEST ===\n');
    
    this.players = loadTestPlayers();
    this.availablePlayers = [...this.players];
    
    // Simulate draft
    let pickNum = 0;
    while (pickNum < 192 && this.availablePlayers.length > 0) {
      // Get random available player
      const playerIdx = Math.floor(Math.random() * Math.min(20, this.availablePlayers.length));
      const player = this.availablePlayers[playerIdx];
      if (!player) break;
      
      // Simulate bidding
      const result = this.simulateBidding(player);
      if (result) {
        pickNum++;
        
        // Remove from available
        this.availablePlayers = this.availablePlayers.filter(p => p.playerId !== player.playerId);
        
        if (result.team.name.includes('User') && pickNum % 5 === 0) {
          console.log(`Pick ${pickNum}: User got ${player.playerName} (${player.position}) for $${result.price} - Action: ${result.recommendation}`);
        }
      }
      
      // Stop if teams are mostly full
      const avgRosterSize = this.teams.reduce((sum, t) => sum + t.roster.length, 0) / this.teams.length;
      if (avgRosterSize >= 15) break;
    }
    
    this.analyzeResults();
  }

  private simulateBidding(player: ValuationResult) {
    let highBid = 0;
    let winner: SimTeam | null = null;
    let userRec: string | null = null;
    
    for (const team of this.teams) {
      const budget = team.budget;
      const slotsLeft = 16 - team.roster.length;
      const maxAfford = budget - slotsLeft; // Save $1 per slot
      
      if (maxAfford <= 0) continue;
      
      let teamBid = 0;
      
      if (team.name.includes('User')) {
        // User team uses recommendations
        const context = {
          myTeam: {
            id: team.id,
            name: team.name,
            budget: budget,
            players: team.roster,
            isUser: true,
            maxBid: maxAfford,
            nominations: 0
          },
          allTeams: this.teams.map(t => ({
            id: t.id,
            name: t.name,
            budget: t.budget,
            players: t.roster,
            isUser: t.name.includes('User'),
            maxBid: t.budget - (16 - t.roster.length),
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
        
        // Test at different price points
        const testPrice = Math.min(player.value || 1, maxAfford);
        const rec = bidAdvisorService.getRecommendation(player, context, testPrice);
        
        userRec = rec.action;
        
        if (rec.action === 'strong-buy' || rec.action === 'consider') {
          teamBid = Math.min(rec.maxBid, maxAfford);
          // Log elite RB bids
          if (player.position === 'RB' && player.tier === 'elite') {
            console.log(`USER BID: ${player.playerName} - Action: ${rec.action}, MaxBid: $${rec.maxBid}, ActualBid: $${teamBid}`);
          }
        }
      } else {
        // Simple AI bidding
        const value = player.value || 1;
        teamBid = Math.min(value * (0.8 + Math.random() * 0.4), maxAfford);
      }
      
      if (teamBid > highBid) {
        highBid = teamBid;
        winner = team;
      }
    }
    
    if (winner && highBid > 0) {
      // Award player
      const playerObj: Player = {
        id: player.playerId || '',
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
      
      winner.roster.push(playerObj);
      winner.budget -= Math.round(highBid);
      
      this.draftHistory.push({
        player: playerObj,
        price: Math.round(highBid),
        teamId: winner.id
      });
      
      return {
        team: winner,
        price: Math.round(highBid),
        recommendation: userRec
      };
    }
    
    return null;
  }

  private analyzeResults() {
    console.log('\n=== ANALYSIS ===\n');
    
    for (const team of this.teams) {
      const posCounts: Record<string, number> = {};
      const tierCounts: Record<string, number> = {};
      let totalValue = 0;
      let totalPoints = 0;
      const spent = 200 - team.budget;
      
      team.roster.forEach(p => {
        posCounts[p.position] = (posCounts[p.position] || 0) + 1;
        tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
        totalValue += p.auctionValue || 0;
        totalPoints += p.projectedPoints || 0;
      });
      
      console.log(`\n${team.name}`);
      console.log(`  Strategy: ${team.strategy}`);
      console.log(`  Spent: $${spent}/200 (${(spent/200*100).toFixed(0)}%)`);
      console.log(`  Roster: ${team.roster.length}/16 players`);
      console.log(`  Positions: QB:${posCounts.QB || 0} RB:${posCounts.RB || 0} WR:${posCounts.WR || 0} TE:${posCounts.TE || 0} DST:${posCounts.DST || 0} K:${posCounts.K || 0}`);
      console.log(`  Tiers: Elite:${tierCounts.elite || 0} T1:${tierCounts.tier1 || 0} T2:${tierCounts.tier2 || 0}`);
      console.log(`  Total Value: $${totalValue} (${totalValue > spent ? '+' : ''}${(totalValue - spent).toFixed(0)} edge)`);
      console.log(`  Projected Points: ${totalPoints.toFixed(0)}`);
      
      // Check requirements for user team
      if (team.name.includes('User')) {
        const meetsReqs = 
          (posCounts.QB || 0) >= 1 &&
          (posCounts.RB || 0) >= 2 &&
          (posCounts.WR || 0) >= 2 &&
          (posCounts.TE || 0) >= 1 &&
          (posCounts.DST || 0) >= 1 &&
          (posCounts.K || 0) >= 1;
        
        const hasEliteRBs = team.roster.filter(p => 
          p.position === 'RB' && p.tier === 'elite'
        ).length;
        
        console.log(`\n  EVALUATION:`);
        console.log(`    Meets minimum requirements: ${meetsReqs ? '✅' : '❌'}`);
        console.log(`    Budget efficiency (>95%): ${spent >= 190 ? '✅' : '❌'}`);
        console.log(`    Roster complete (16): ${team.roster.length === 16 ? '✅' : '❌'}`);
        console.log(`    Elite RBs acquired: ${hasEliteRBs} ${hasEliteRBs >= 1 ? '✅' : '❌'}`);
        console.log(`    Robust RB (>50% on RBs): ${this.calculatePositionSpend(team, 'RB') > 50 ? '✅' : '❌'}`);
        
        // Show roster
        console.log(`\n  ROSTER DETAILS:`);
        team.roster
          .sort((a, b) => (b.auctionValue || 0) - (a.auctionValue || 0))
          .forEach(p => {
            const pick = this.draftHistory.find(h => h.player.id === p.id);
            console.log(`    ${p.name} (${p.position}/${p.tier}) - $${pick?.price || 0}`);
          });
      }
    }
    
    // Summary
    const userTeam = this.teams[0];
    const userPoints = userTeam.roster.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
    const avgPoints = this.teams.reduce((sum, t) => 
      sum + t.roster.reduce((s, p) => s + (p.projectedPoints || 0), 0), 0
    ) / this.teams.length;
    
    console.log('\n=== USER TEAM SUMMARY ===');
    console.log(`Projected finish: ${userPoints > avgPoints ? 'ABOVE' : 'BELOW'} average`);
    console.log(`Point differential: ${(userPoints - avgPoints).toFixed(0)}`);
  }

  private calculatePositionSpend(team: SimTeam, position: string): number {
    const spent = 200 - team.budget;
    const posSpend = this.draftHistory
      .filter(h => h.teamId === team.id && h.player.position === position)
      .reduce((sum, h) => sum + h.price, 0);
    
    return spent > 0 ? (posSpend / spent) * 100 : 0;
  }
}

// Run tests
async function main() {
  console.log('Testing recommendation system...\n');
  
  // Run multiple simulations
  for (let i = 0; i < 3; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SIMULATION ${i + 1}`);
    console.log('='.repeat(60));
    
    const tester = new RecommendationTester();
    await tester.runTest();
  }
}

main().catch(console.error);