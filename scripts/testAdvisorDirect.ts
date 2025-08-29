import { bidAdvisorService } from '../src/lib/bidAdvisorService';
import type { Player, Position, DraftPick } from '../src/types';
import type { ValuationResult } from '../src/lib/calibratedValuationService';
import type { DraftContext } from '../src/lib/bidAdvisorService';

interface SimulatedPick {
  player: Player;
  price: number;
  round: number;
}

interface RosterAnalysis {
  totalSpent: number;
  remainingBudget: number;
  positionCounts: Record<string, number>;
  positionSpending: Record<string, number>;
  eliteRBs: number;
  tier1RBs: number;
  tier2RBs: number;
  eliteWRs: number;
  tier1WRs: number;
  players: SimulatedPick[];
}

// Create mock players with realistic market values matching the UI table
function createMockPlayers(): ValuationResult[] {
  const players: ValuationResult[] = [
    // Elite RBs (50-60% budget target = $100-120 total)
    { id: '1', playerId: '1', playerName: 'Bijan Robinson', name: 'Bijan Robinson', position: 'RB', team: 'ATL', 
      projectedPoints: 327, points: 327, positionRank: 1, vbd: 150, vorp: 150,
      auctionValue: 57, value: 57, marketPrice: 52, marketValue: 52, edge: 5, intrinsicValue: 57,
      confidence: 85, tier: 'elite', minBid: 45, targetBid: 52, maxBid: 57, rank: 1, adp: 3.1 },
    
    { id: '2', playerId: '2', playerName: 'Breece Hall', name: 'Breece Hall', position: 'RB', team: 'NYJ',
      projectedPoints: 318, points: 318, positionRank: 2, vbd: 141, vorp: 141,
      auctionValue: 28, value: 28, marketPrice: 48, marketValue: 48, edge: -20, intrinsicValue: 28,
      confidence: 80, tier: 'elite', minBid: 25, targetBid: 28, maxBid: 30, rank: 2, adp: 4.5 },
    
    { id: '3', playerId: '3', playerName: 'Christian McCaffrey', name: 'Christian McCaffrey', position: 'RB', team: 'SF',
      projectedPoints: 312, points: 312, positionRank: 3, vbd: 135, vorp: 135,
      auctionValue: 45, value: 45, marketPrice: 55, marketValue: 55, edge: -10, intrinsicValue: 45,
      confidence: 75, tier: 'elite', minBid: 40, targetBid: 45, maxBid: 50, rank: 3, adp: 2.1 },
    
    { id: '4', playerId: '4', playerName: 'Saquon Barkley', name: 'Saquon Barkley', position: 'RB', team: 'PHI',
      projectedPoints: 305, points: 305, positionRank: 4, vbd: 128, vorp: 128,
      auctionValue: 42, value: 42, marketPrice: 45, marketValue: 45, edge: -3, intrinsicValue: 42,
      confidence: 78, tier: 'tier1', minBid: 35, targetBid: 42, maxBid: 45, rank: 5, adp: 6.2 },
    
    { id: '5', playerId: '5', playerName: 'Jonathan Taylor', name: 'Jonathan Taylor', position: 'RB', team: 'IND',
      projectedPoints: 295, points: 295, positionRank: 5, vbd: 118, vorp: 118,
      auctionValue: 38, value: 38, marketPrice: 40, marketValue: 40, edge: -2, intrinsicValue: 38,
      confidence: 76, tier: 'tier1', minBid: 32, targetBid: 38, maxBid: 42, rank: 8, adp: 9.1 },
    
    // Elite WRs (25-35% budget target = $50-70 total)
    { id: '6', playerId: '6', playerName: 'CeeDee Lamb', name: 'CeeDee Lamb', position: 'WR', team: 'DAL',
      projectedPoints: 295, points: 295, positionRank: 1, vbd: 130, vorp: 130,
      auctionValue: 45, value: 45, marketPrice: 48, marketValue: 48, edge: -3, intrinsicValue: 45,
      confidence: 82, tier: 'elite', minBid: 40, targetBid: 45, maxBid: 48, rank: 4, adp: 5.3 },
    
    { id: '7', playerId: '7', playerName: 'Tyreek Hill', name: 'Tyreek Hill', position: 'WR', team: 'MIA',
      projectedPoints: 290, points: 290, positionRank: 2, vbd: 125, vorp: 125,
      auctionValue: 42, value: 42, marketPrice: 46, marketValue: 46, edge: -4, intrinsicValue: 42,
      confidence: 80, tier: 'elite', minBid: 38, targetBid: 42, maxBid: 46, rank: 6, adp: 7.1 },
    
    { id: '8', playerId: '8', playerName: 'Ja\'Marr Chase', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN',
      projectedPoints: 288, points: 288, positionRank: 3, vbd: 123, vorp: 123,
      auctionValue: 41, value: 41, marketPrice: 44, marketValue: 44, edge: -3, intrinsicValue: 41,
      confidence: 81, tier: 'elite', minBid: 36, targetBid: 41, maxBid: 44, rank: 7, adp: 8.2 },
    
    { id: '9', playerId: '9', playerName: 'Justin Jefferson', name: 'Justin Jefferson', position: 'WR', team: 'MIN',
      projectedPoints: 285, points: 285, positionRank: 4, vbd: 120, vorp: 120,
      auctionValue: 40, value: 40, marketPrice: 50, marketValue: 50, edge: -10, intrinsicValue: 40,
      confidence: 75, tier: 'elite', minBid: 35, targetBid: 40, maxBid: 45, rank: 9, adp: 10.1 },
    
    // Tier 1 RBs
    { id: '10', playerId: '10', playerName: 'Jahmyr Gibbs', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET',
      projectedPoints: 280, points: 280, positionRank: 6, vbd: 103, vorp: 103,
      auctionValue: 32, value: 32, marketPrice: 35, marketValue: 35, edge: -3, intrinsicValue: 32,
      confidence: 75, tier: 'tier1', minBid: 28, targetBid: 32, maxBid: 35, rank: 12, adp: 12.5 },
    
    { id: '11', playerId: '11', playerName: 'De\'Von Achane', name: 'De\'Von Achane', position: 'RB', team: 'MIA',
      projectedPoints: 275, points: 275, positionRank: 7, vbd: 98, vorp: 98,
      auctionValue: 30, value: 30, marketPrice: 32, marketValue: 32, edge: -2, intrinsicValue: 30,
      confidence: 74, tier: 'tier1', minBid: 26, targetBid: 30, maxBid: 33, rank: 14, adp: 14.2 },
    
    // Tier 1 WRs
    { id: '12', playerId: '12', playerName: 'Amon-Ra St. Brown', name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET',
      projectedPoints: 270, points: 270, positionRank: 5, vbd: 105, vorp: 105,
      auctionValue: 32, value: 32, marketPrice: 35, marketValue: 35, edge: -3, intrinsicValue: 32,
      confidence: 76, tier: 'tier1', minBid: 28, targetBid: 32, maxBid: 35, rank: 11, adp: 11.8 },
    
    { id: '13', playerId: '13', playerName: 'A.J. Brown', name: 'A.J. Brown', position: 'WR', team: 'PHI',
      projectedPoints: 265, points: 265, positionRank: 6, vbd: 100, vorp: 100,
      auctionValue: 30, value: 30, marketPrice: 33, marketValue: 33, edge: -3, intrinsicValue: 30,
      confidence: 75, tier: 'tier1', minBid: 26, targetBid: 30, maxBid: 33, rank: 13, adp: 13.5 },
    
    // Elite TE
    { id: '14', playerId: '14', playerName: 'Travis Kelce', name: 'Travis Kelce', position: 'TE', team: 'KC',
      projectedPoints: 220, points: 220, positionRank: 1, vbd: 85, vorp: 85,
      auctionValue: 25, value: 25, marketPrice: 28, marketValue: 28, edge: -3, intrinsicValue: 25,
      confidence: 78, tier: 'elite', minBid: 22, targetBid: 25, maxBid: 28, rank: 20, adp: 22.1 },
    
    // Elite QB
    { id: '15', playerId: '15', playerName: 'Josh Allen', name: 'Josh Allen', position: 'QB', team: 'BUF',
      projectedPoints: 380, points: 380, positionRank: 1, vbd: 60, vorp: 60,
      auctionValue: 18, value: 18, marketPrice: 22, marketValue: 22, edge: -4, intrinsicValue: 18,
      confidence: 72, tier: 'elite', minBid: 15, targetBid: 18, maxBid: 22, rank: 25, adp: 28.5 },
    
    // Tier 2 RBs
    { id: '16', playerId: '16', playerName: 'Josh Jacobs', name: 'Josh Jacobs', position: 'RB', team: 'GB',
      projectedPoints: 260, points: 260, positionRank: 8, vbd: 83, vorp: 83,
      auctionValue: 24, value: 24, marketPrice: 26, marketValue: 26, edge: -2, intrinsicValue: 24,
      confidence: 72, tier: 'tier2', minBid: 20, targetBid: 24, maxBid: 26, rank: 22, adp: 24.3 },
    
    { id: '17', playerId: '17', playerName: 'Derrick Henry', name: 'Derrick Henry', position: 'RB', team: 'BAL',
      projectedPoints: 255, points: 255, positionRank: 9, vbd: 78, vorp: 78,
      auctionValue: 22, value: 22, marketPrice: 24, marketValue: 24, edge: -2, intrinsicValue: 22,
      confidence: 70, tier: 'tier2', minBid: 18, targetBid: 22, maxBid: 24, rank: 26, adp: 26.8 },
    
    // Tier 2 WRs
    { id: '18', playerId: '18', playerName: 'Puka Nacua', name: 'Puka Nacua', position: 'WR', team: 'LAR',
      projectedPoints: 250, points: 250, positionRank: 7, vbd: 85, vorp: 85,
      auctionValue: 25, value: 25, marketPrice: 27, marketValue: 27, edge: -2, intrinsicValue: 25,
      confidence: 73, tier: 'tier2', minBid: 22, targetBid: 25, maxBid: 27, rank: 21, adp: 23.5 },
    
    { id: '19', playerId: '19', playerName: 'Garrett Wilson', name: 'Garrett Wilson', position: 'WR', team: 'NYJ',
      projectedPoints: 245, points: 245, positionRank: 8, vbd: 80, vorp: 80,
      auctionValue: 23, value: 23, marketPrice: 25, marketValue: 25, edge: -2, intrinsicValue: 23,
      confidence: 71, tier: 'tier2', minBid: 20, targetBid: 23, maxBid: 25, rank: 24, adp: 25.2 },
    
    // More tier 2/3 players for depth
    { id: '20', playerId: '20', playerName: 'Chris Olave', name: 'Chris Olave', position: 'WR', team: 'NO',
      projectedPoints: 235, points: 235, positionRank: 9, vbd: 70, vorp: 70,
      auctionValue: 18, value: 18, marketPrice: 20, marketValue: 20, edge: -2, intrinsicValue: 18,
      confidence: 68, tier: 'tier2', minBid: 15, targetBid: 18, maxBid: 20, rank: 30, adp: 32.1 },
    
    // Add more players to fill out roster needs...
    { id: '21', playerId: '21', playerName: 'Lamar Jackson', name: 'Lamar Jackson', position: 'QB', team: 'BAL',
      projectedPoints: 365, points: 365, positionRank: 2, vbd: 45, vorp: 45,
      auctionValue: 12, value: 12, marketPrice: 15, marketValue: 15, edge: -3, intrinsicValue: 12,
      confidence: 68, tier: 'tier1', minBid: 10, targetBid: 12, maxBid: 15, rank: 35, adp: 38.5 },
    
    { id: '22', playerId: '22', playerName: 'Sam LaPorta', name: 'Sam LaPorta', position: 'TE', team: 'DET',
      projectedPoints: 195, points: 195, positionRank: 2, vbd: 60, vorp: 60,
      auctionValue: 15, value: 15, marketPrice: 18, marketValue: 18, edge: -3, intrinsicValue: 15,
      confidence: 70, tier: 'tier1', minBid: 12, targetBid: 15, maxBid: 18, rank: 32, adp: 34.2 },
    
    // Add budget DST/K
    { id: '23', playerId: '23', playerName: 'Ravens DST', name: 'Ravens DST', position: 'DST', team: 'BAL',
      projectedPoints: 140, points: 140, positionRank: 1, vbd: 20, vorp: 20,
      auctionValue: 2, value: 2, marketPrice: 3, marketValue: 3, edge: -1, intrinsicValue: 2,
      confidence: 60, tier: 'tier1', minBid: 1, targetBid: 2, maxBid: 3, rank: 100, adp: 110 },
    
    { id: '24', playerId: '24', playerName: 'Justin Tucker', name: 'Justin Tucker', position: 'K', team: 'BAL',
      projectedPoints: 150, points: 150, positionRank: 1, vbd: 15, vorp: 15,
      auctionValue: 1, value: 1, marketPrice: 2, marketValue: 2, edge: -1, intrinsicValue: 1,
      confidence: 55, tier: 'tier1', minBid: 1, targetBid: 1, maxBid: 2, rank: 120, adp: 130 }
  ];
  
  return players;
}

async function runDraftSimulation(simulationId: number): Promise<RosterAnalysis> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SIMULATION ${simulationId}`);
  console.log(`${'='.repeat(80)}\n`);

  const availablePlayers = createMockPlayers();
  console.log(`Using ${availablePlayers.length} mock players with realistic market values`);
  
  // Initialize draft state
  let budget = 200;
  let roster: SimulatedPick[] = [];
  const draftedIds = new Set<string>();
  let round = 1;
  const draftHistory: DraftPick[] = [];
  
  // Position requirements
  const positionNeeds: Record<string, number> = {
    QB: 2,
    RB: 5,
    WR: 5,
    TE: 2,
    DST: 1,
    K: 1
  };
  
  const currentPositions: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    DST: 0,
    K: 0
  };

  // Simulate drafting
  while (roster.length < 16 && budget > roster.length) {
    const available = availablePlayers.filter(v => !draftedIds.has(v.playerId));
    
    // Create draft context
    const draftContext: DraftContext = {
      myTeam: {
        id: 'user',
        name: 'My Team',
        budget: budget,
        players: roster.map(r => r.player),
        isUser: true
      },
      allTeams: [
        {
          id: 'user',
          name: 'My Team', 
          budget: budget,
          players: roster.map(r => r.player),
          isUser: true
        },
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `team${i + 1}`,
          name: `Team ${i + 1}`,
          budget: Math.max(150, 200 - (round * 5)), // Simulated spending
          players: []
        }))
      ],
      draftHistory: draftHistory,
      availablePlayers: available,
      currentBid: 0,
      totalBudget: 200,
      rosterRequirements: {
        QB: { min: 1, max: 2, optimal: 1 },
        RB: { min: 2, max: 6, optimal: 5 }, // Target 5 RBs
        WR: { min: 2, max: 7, optimal: 5 }, // Target 5 WRs
        TE: { min: 1, max: 2, optimal: 2 },
        DST: { min: 1, max: 1, optimal: 1 },
        K: { min: 1, max: 1, optimal: 1 },
        FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
        BENCH: 7
      }
    };
    
    // Find best target
    let targetPlayer: ValuationResult | null = null;
    let bestRecommendation = null;
    let bestScore = -Infinity;
    
    // Prioritize based on roster needs and tier
    const candidates = available
      .filter(p => currentPositions[p.position] < positionNeeds[p.position])
      .sort((a, b) => {
        // In early rounds, prioritize elite RBs for Robust RB strategy
        if (round <= 3) {
          if (a.position === 'RB' && b.position !== 'RB') return -1;
          if (b.position === 'RB' && a.position !== 'RB') return 1;
        }
        
        const tierOrder = { elite: 5, tier1: 4, tier2: 3, tier3: 2, replacement: 1 };
        const aTier = tierOrder[a.tier] || 0;
        const bTier = tierOrder[b.tier] || 0;
        if (aTier !== bTier) return bTier - aTier;
        
        return (b.edge || 0) - (a.edge || 0);
      })
      .slice(0, 5);
    
    for (const candidate of candidates) {
      const rec = bidAdvisorService.getRecommendation(
        candidate,
        draftContext,
        candidate.marketValue || 0
      );
      
      if (rec && rec.confidence > bestScore) {
        bestScore = rec.confidence;
        bestRecommendation = rec;
        targetPlayer = candidate;
      }
    }
    
    if (!targetPlayer || !bestRecommendation) {
      console.log(`Round ${round}: No suitable player found`);
      break;
    }
    
    // Simulate competitive bidding
    let finalPrice = targetPlayer.marketValue || 1;
    
    // For elite/tier1 players, assume competitive bidding near market
    if (targetPlayer.tier === 'elite' || targetPlayer.tier === 'tier1') {
      // Add some variance to simulate bidding wars
      const variance = Math.random() * 0.1 - 0.05; // +/- 5%
      finalPrice = Math.round(finalPrice * (1 + variance));
    }
    
    // Cap at our max bid and remaining budget
    finalPrice = Math.min(
      finalPrice,
      bestRecommendation.maxProfitableBid || targetPlayer.intrinsicValue || 1,
      budget - (16 - roster.length - 1)
    );
    
    // Add to roster
    roster.push({
      player: {
        id: targetPlayer.playerId,
        name: targetPlayer.playerName,
        position: targetPlayer.position as Position,
        team: targetPlayer.team,
        playerId: targetPlayer.playerId,
        projectedPoints: targetPlayer.projectedPoints || 0,
        auctionValue: targetPlayer.intrinsicValue || 0,
        marketValue: targetPlayer.marketValue || 0,
        vorp: targetPlayer.vorp || 0,
        tier: targetPlayer.tier || 'replacement'
      },
      price: finalPrice,
      round
    });
    
    budget -= finalPrice;
    currentPositions[targetPlayer.position]++;
    draftedIds.add(targetPlayer.playerId);
    
    draftHistory.push({
      player: roster[roster.length - 1].player,
      price: finalPrice,
      team: 'user',
      timestamp: Date.now()
    });
    
    console.log(`Round ${String(round).padStart(2)}: ${targetPlayer.playerName.padEnd(20)} (${targetPlayer.position}) for $${String(finalPrice).padStart(3)} - ${targetPlayer.tier.padEnd(7)} - ${bestRecommendation.action}`);
    
    round++;
  }
  
  // Calculate analysis
  const positionSpending: Record<string, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0
  };
  
  let eliteRBs = 0, tier1RBs = 0, tier2RBs = 0;
  let eliteWRs = 0, tier1WRs = 0;
  
  roster.forEach(pick => {
    positionSpending[pick.player.position] = (positionSpending[pick.player.position] || 0) + pick.price;
    
    if (pick.player.position === 'RB') {
      if (pick.player.tier === 'elite') eliteRBs++;
      if (pick.player.tier === 'tier1') tier1RBs++;
      if (pick.player.tier === 'tier2') tier2RBs++;
    }
    
    if (pick.player.position === 'WR') {
      if (pick.player.tier === 'elite') eliteWRs++;
      if (pick.player.tier === 'tier1') tier1WRs++;
    }
  });
  
  const totalSpent = roster.reduce((sum, pick) => sum + pick.price, 0);
  
  return {
    totalSpent,
    remainingBudget: 200 - totalSpent,
    positionCounts: currentPositions,
    positionSpending,
    eliteRBs,
    tier1RBs,
    tier2RBs,
    eliteWRs,
    tier1WRs,
    players: roster
  };
}

async function main() {
  console.log("Testing Advisor Service with Realistic Market Values");
  console.log("Simulating Robust RB Strategy Implementation");
  console.log("=" .repeat(80));
  
  const simulations: RosterAnalysis[] = [];
  
  // Run 2 simulations
  for (let i = 1; i <= 2; i++) {
    const result = await runDraftSimulation(i);
    simulations.push(result);
    
    // Display roster
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FINAL ROSTER - SIMULATION ${i}`);
    console.log(`${'='.repeat(80)}`);
    
    const byPosition: Record<string, SimulatedPick[]> = {};
    result.players.forEach(pick => {
      if (!byPosition[pick.player.position]) {
        byPosition[pick.player.position] = [];
      }
      byPosition[pick.player.position].push(pick);
    });
    
    ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].forEach(pos => {
      if (byPosition[pos]) {
        console.log(`\n${pos}s (${byPosition[pos].length}):`);
        byPosition[pos]
          .sort((a, b) => b.price - a.price)
          .forEach(pick => {
            const tier = pick.player.tier === 'elite' ? ' [ELITE]' : 
                         pick.player.tier === 'tier1' ? ' [T1]' :
                         pick.player.tier === 'tier2' ? ' [T2]' : '';
            console.log(`  $${String(pick.price).padStart(3)} - ${pick.player.name}${tier}`);
          });
      }
    });
    
    // Budget analysis
    console.log(`\n${'='.repeat(80)}`);
    console.log('BUDGET ANALYSIS');
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Spent: $${result.totalSpent}`);
    console.log(`Remaining: $${result.remainingBudget}`);
    console.log('\nSpending by Position:');
    Object.entries(result.positionSpending)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pos, amount]) => {
        const pct = ((amount / result.totalSpent) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(amount / 5));
        console.log(`  ${pos.padEnd(3)}: $${String(amount).padStart(3)} (${pct.padStart(5)}%) ${bar}`);
      });
    
    // Strategy Analysis
    console.log(`\n${'='.repeat(80)}`);
    console.log('ROBUST RB STRATEGY ANALYSIS');
    console.log(`${'='.repeat(80)}`);
    console.log(`Elite RBs: ${result.eliteRBs}`);
    console.log(`Tier 1 RBs: ${result.tier1RBs}`);
    console.log(`Total RBs: ${result.positionCounts.RB}`);
    console.log(`RB Spending: $${result.positionSpending.RB} (${((result.positionSpending.RB / result.totalSpent) * 100).toFixed(1)}%)`);
    
    console.log(`\nElite WRs: ${result.eliteWRs}`);
    console.log(`Tier 1 WRs: ${result.tier1WRs}`);
    console.log(`Total WRs: ${result.positionCounts.WR}`);
    console.log(`WR Spending: $${result.positionSpending.WR} (${((result.positionSpending.WR / result.totalSpent) * 100).toFixed(1)}%)`);
    
    const rbTarget = result.positionSpending.RB >= result.totalSpent * 0.5 && 
                     result.positionSpending.RB <= result.totalSpent * 0.6;
    const wrTarget = result.positionSpending.WR >= result.totalSpent * 0.25 && 
                     result.positionSpending.WR <= result.totalSpent * 0.35;
    
    console.log(`\nRobust RB Target (50-60% on RBs): ${rbTarget ? '✅ MET' : '❌ NOT MET'}`);
    console.log(`WR Depth Target (25-35% on WRs): ${wrTarget ? '✅ MET' : '❌ NOT MET'}`);
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY ACROSS ALL SIMULATIONS');
  console.log(`${'='.repeat(80)}`);
  
  const avgRBSpending = simulations.reduce((sum, s) => sum + (s.positionSpending.RB / s.totalSpent), 0) / simulations.length;
  const avgWRSpending = simulations.reduce((sum, s) => sum + (s.positionSpending.WR / s.totalSpent), 0) / simulations.length;
  
  console.log(`Average RB Spending: ${(avgRBSpending * 100).toFixed(1)}%`);
  console.log(`Average WR Spending: ${(avgWRSpending * 100).toFixed(1)}%`);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('TARGET vs ACTUAL');
  console.log(`${'='.repeat(80)}`);
  console.log('Position | Target     | Actual');
  console.log('---------|------------|--------');
  console.log(`RB       | 50-60%     | ${(avgRBSpending * 100).toFixed(1)}%`);
  console.log(`WR       | 25-35%     | ${(avgWRSpending * 100).toFixed(1)}%`);
}

main().catch(console.error);