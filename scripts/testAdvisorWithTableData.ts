import { bidAdvisorService } from '../src/lib/bidAdvisorService';
import { cleanDataLoader } from '../src/lib/cleanDataLoader';
import { dataIntegrationService } from '../src/lib/dataIntegrationService';
import { calibratedValuationService } from '../src/lib/calibratedValuationService';
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

async function runDraftSimulation(simulationId: number): Promise<RosterAnalysis> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SIMULATION ${simulationId}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load data the same way the UI does
  console.log('Loading data using the same pipeline as the UI...');
  const loadResult = await cleanDataLoader.load();
  
  // Process through data integration service (same as UI)
  const integratedPlayers = await dataIntegrationService.getIntegratedData();
  
  // Get valuations (same as UI)
  const valuations = calibratedValuationService.processPlayers(integratedPlayers.players);
  const availablePlayers = valuations.valuations;
  
  console.log(`Loaded ${availablePlayers.length} players with proper market values`);
  
  // Show sample of top players with their actual market values
  console.log('\nTop 5 players by market value:');
  const topByMarket = [...availablePlayers]
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
    .slice(0, 5);
  topByMarket.forEach(p => {
    console.log(`  ${p.playerName} (${p.position}): Market=$${p.marketValue}, Our Value=$${p.intrinsicValue?.toFixed(0)}, Edge=$${p.edge?.toFixed(0)}`);
  });
  
  // Initialize draft state
  let budget = 200;
  let roster: SimulatedPick[] = [];
  const draftedIds = new Set<string>();
  let round = 1;
  const draftHistory: DraftPick[] = [];
  
  // Position requirements (same as advisor service)
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

  // Simulate drafting with advisor recommendations
  while (roster.length < 16 && budget > roster.length) {
    // Get available players
    const available = availablePlayers.filter(v => !draftedIds.has(v.playerId));
    
    // Create proper draft context
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
        // Simulate 11 other teams with varying budgets
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `team${i + 1}`,
          name: `Team ${i + 1}`,
          budget: Math.max(150, 200 - (round * 3) + Math.random() * 20), // Varying budgets
          players: []
        }))
      ],
      draftHistory: draftHistory,
      availablePlayers: available,
      currentBid: 0,
      totalBudget: 200,
      rosterRequirements: {
        QB: { min: 1, max: 2, optimal: 1 },
        RB: { min: 2, max: 6, optimal: 6 },
        WR: { min: 2, max: 7, optimal: 7 },
        TE: { min: 1, max: 2, optimal: 1 },
        DST: { min: 1, max: 1, optimal: 1 },
        K: { min: 1, max: 1, optimal: 1 },
        FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
        BENCH: 7
      }
    };
    
    // Find best target based on advisor strategy
    let targetPlayer: ValuationResult | null = null;
    let recommendation = null;
    
    // Try to get recommendations for top available players
    const candidates = available
      .filter(p => {
        const pos = p.position;
        return currentPositions[pos] < positionNeeds[pos];
      })
      .sort((a, b) => {
        // Prioritize by a combination of edge and tier
        const tierOrder = { elite: 5, tier1: 4, tier2: 3, tier3: 2, replacement: 1 };
        const aTierScore = tierOrder[a.tier] || 0;
        const bTierScore = tierOrder[b.tier] || 0;
        
        if (aTierScore !== bTierScore) return bTierScore - aTierScore;
        return (b.edge || 0) - (a.edge || 0);
      })
      .slice(0, 5); // Check top 5 candidates
    
    // Get recommendations for each candidate and pick the best
    let bestRecommendation = null;
    let bestScore = -Infinity;
    
    for (const candidate of candidates) {
      const rec = bidAdvisorService.getRecommendation(
        candidate,
        draftContext,
        0
      );
      
      if (rec && rec.confidence > bestScore) {
        bestScore = rec.confidence;
        bestRecommendation = rec;
        targetPlayer = candidate;
      }
    }
    
    recommendation = bestRecommendation;
    
    if (!targetPlayer || !recommendation) {
      console.log(`Round ${round}: No suitable player found`);
      break;
    }
    
    // Calculate bid amount based on recommendation
    let bidAmount = Math.min(
      recommendation.maxProfitableBid || targetPlayer.intrinsicValue || targetPlayer.marketValue || 1,
      budget - (16 - roster.length - 1) // Save $1 for remaining slots
    );
    
    // Add the player to roster
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
      price: bidAmount,
      round
    });
    
    budget -= bidAmount;
    currentPositions[targetPlayer.position]++;
    draftedIds.add(targetPlayer.playerId);
    
    // Add to draft history
    draftHistory.push({
      player: roster[roster.length - 1].player,
      price: bidAmount,
      team: 'user',
      timestamp: Date.now()
    });
    
    console.log(`Round ${round}: ${targetPlayer.playerName} (${targetPlayer.position}) for $${bidAmount} - ${targetPlayer.tier} - ${recommendation.action}`);
    
    round++;
  }
  
  // Fill remaining spots with $1 players if needed
  while (roster.length < 16 && budget > 0) {
    const available = availablePlayers.filter(v => !draftedIds.has(v.playerId));
    const needPositions = Object.entries(positionNeeds)
      .filter(([pos, need]) => currentPositions[pos] < need)
      .map(([pos]) => pos);
    
    const fillPlayer = available
      .filter(p => needPositions.includes(p.position))
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))[0];
    
    if (!fillPlayer) break;
    
    roster.push({
      player: {
        id: fillPlayer.playerId,
        name: fillPlayer.playerName,
        position: fillPlayer.position as Position,
        team: fillPlayer.team,
        playerId: fillPlayer.playerId,
        projectedPoints: fillPlayer.projectedPoints || 0,
        auctionValue: fillPlayer.intrinsicValue || 0,
        marketValue: fillPlayer.marketValue || 0,
        vorp: fillPlayer.vorp || 0,
        tier: fillPlayer.tier || 'replacement'
      },
      price: 1,
      round
    });
    
    budget -= 1;
    currentPositions[fillPlayer.position]++;
    draftedIds.add(fillPlayer.playerId);
    
    console.log(`Round ${round}: ${fillPlayer.playerName} (${fillPlayer.position}) for $1 [FILL]`);
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
  console.log("Testing Advisor Service with Proper Table Data");
  console.log("Using same data pipeline as UI (with market values)");
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
    
    // Group by position
    const byPosition: Record<string, SimulatedPick[]> = {};
    result.players.forEach(pick => {
      if (!byPosition[pick.player.position]) {
        byPosition[pick.player.position] = [];
      }
      byPosition[pick.player.position].push(pick);
    });
    
    // Display by position
    ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].forEach(pos => {
      if (byPosition[pos]) {
        console.log(`\n${pos}s (${byPosition[pos].length}):`);
        byPosition[pos]
          .sort((a, b) => b.price - a.price)
          .forEach(pick => {
            const tier = pick.player.tier === 'elite' ? ' [ELITE]' : 
                         pick.player.tier === 'tier1' ? ' [T1]' :
                         pick.player.tier === 'tier2' ? ' [T2]' : 
                         pick.player.tier === 'tier3' ? ' [T3]' : '';
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
    
    // Robust RB Analysis
    console.log(`\n${'='.repeat(80)}`);
    console.log('ROBUST RB STRATEGY ANALYSIS');
    console.log(`${'='.repeat(80)}`);
    console.log(`Elite RBs: ${result.eliteRBs}`);
    console.log(`Tier 1 RBs: ${result.tier1RBs}`);
    console.log(`Tier 2 RBs: ${result.tier2RBs}`);
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
  
  // Summary across all simulations
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY ACROSS ALL SIMULATIONS');
  console.log(`${'='.repeat(80)}`);
  
  const avgRBSpending = simulations.reduce((sum, s) => sum + (s.positionSpending.RB / s.totalSpent), 0) / simulations.length;
  const avgWRSpending = simulations.reduce((sum, s) => sum + (s.positionSpending.WR / s.totalSpent), 0) / simulations.length;
  const avgEliteRBs = simulations.reduce((sum, s) => sum + s.eliteRBs, 0) / simulations.length;
  const avgTier1RBs = simulations.reduce((sum, s) => sum + s.tier1RBs, 0) / simulations.length;
  const avgEliteWRs = simulations.reduce((sum, s) => sum + s.eliteWRs, 0) / simulations.length;
  
  console.log(`Average RB Spending: ${(avgRBSpending * 100).toFixed(1)}%`);
  console.log(`Average WR Spending: ${(avgWRSpending * 100).toFixed(1)}%`);
  console.log(`Average Elite RBs: ${avgEliteRBs.toFixed(1)}`);
  console.log(`Average Tier 1 RBs: ${avgTier1RBs.toFixed(1)}`);
  console.log(`Average Elite WRs: ${avgEliteWRs.toFixed(1)}`);
  
  const rbSuccessRate = simulations.filter(s => 
    s.positionSpending.RB >= s.totalSpent * 0.5 && 
    s.positionSpending.RB <= s.totalSpent * 0.6
  ).length / simulations.length;
  
  console.log(`\nRobust RB Success Rate (50-60% on RBs): ${(rbSuccessRate * 100).toFixed(0)}%`);
  
  // Show ideal vs actual
  console.log(`\n${'='.repeat(80)}`);
  console.log('TARGET vs ACTUAL');
  console.log(`${'='.repeat(80)}`);
  console.log('Position | Target Range | Actual Average');
  console.log('---------|--------------|----------------');
  console.log(`RB       | 50-60%       | ${(avgRBSpending * 100).toFixed(1)}%`);
  console.log(`WR       | 25-35%       | ${(avgWRSpending * 100).toFixed(1)}%`);
}

main().catch(console.error);