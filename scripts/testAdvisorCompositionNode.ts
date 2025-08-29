import { bidAdvisorService } from '../src/lib/bidAdvisorService';
import { calibratedValuationService } from '../src/lib/calibratedValuationService';
import type { Player, Position, DraftPick } from '../src/types';
import type { ValuationResult } from '../src/lib/calibratedValuationService';
import type { DraftContext } from '../src/lib/bidAdvisorService';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

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
  players: SimulatedPick[];
}

// Load data directly from CSV files
async function loadPlayersFromCSV(): Promise<Player[]> {
  const csvPath = path.join(process.cwd(), 'artifacts/clean_data/projections_2025_with_adp.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  const players: Player[] = records.map((row: any) => ({
    id: `${row.playerName}_${row.position}_${row.teamName}`.replace(/\s+/g, '_'),
    playerId: `${row.playerName}_${row.position}_${row.teamName}`.replace(/\s+/g, '_'),
    name: row.playerName,
    position: row.position as Position,
    team: row.teamName || 'FA',
    projectedPoints: parseFloat(row.fantasyPoints) || 0,
    auctionValue: parseFloat(row.auctionValue) || parseFloat(row.marketValue) || 0,
    marketValue: parseFloat(row.marketValue) || parseFloat(row.auctionValue) || 0,
    vorp: 0,
    tier: 'replacement'
  }));
  
  return players;
}

async function runDraftSimulation(simulationId: number): Promise<RosterAnalysis> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SIMULATION ${simulationId}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load real data
  const players = await loadPlayersFromCSV();
  const result = calibratedValuationService.processPlayers(players);
  const valuations = result.valuations;
  
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

  // Simulate 16 rounds
  while (roster.length < 16 && budget > roster.length) {
    // Get available players
    const available = valuations.filter(v => !draftedIds.has(v.playerId));
    
    // Find best available player based on edge
    const targetPlayer = available
      .filter(p => !currentPositions[p.position] || currentPositions[p.position] < positionNeeds[p.position])
      .sort((a, b) => (b.edge || 0) - (a.edge || 0))[0];
    
    if (!targetPlayer) {
      console.log(`Round ${round}: No suitable player found`);
      break;
    }
    
    // Create draft context for advisor
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
        // Add 11 opponent teams
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `team${i + 1}`,
          name: `Team ${i + 1}`,
          budget: 180, // avg opponent budget
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
    
    // Get recommendation from advisor service
    const recommendation = bidAdvisorService.getRecommendation(
      targetPlayer,
      draftContext,
      0 // current bid
    );
    
    if (!recommendation) {
      console.log(`Round ${round}: No recommendation available`);
      break;
    }
    
    // Calculate bid based on recommendation
    let bidAmount = recommendation.maxProfitableBid || targetPlayer.intrinsicValue || targetPlayer.auctionValue || 1;
    
    // Ensure we don't overspend
    const maxBid = budget - (16 - roster.length - 1); // Save $1 for each remaining slot
    bidAmount = Math.min(bidAmount, maxBid);
    
    // Skip if position is full
    const position = targetPlayer.position;
    if (currentPositions[position] >= positionNeeds[position]) {
      // Find next best available position
      const needPositions = Object.entries(positionNeeds)
        .filter(([pos, need]) => currentPositions[pos] < need)
        .map(([pos]) => pos);
      
      const alternativePlayer = available
        .filter(p => needPositions.includes(p.position))
        .sort((a, b) => (b.edge || 0) - (a.edge || 0))[0];
      
      if (alternativePlayer) {
        bidAmount = Math.min(alternativePlayer.intrinsicValue || alternativePlayer.auctionValue || 1, maxBid);
        roster.push({
          player: {
            id: alternativePlayer.playerId,
            name: alternativePlayer.playerName,
            position: alternativePlayer.position as Position,
            team: alternativePlayer.team,
            playerId: alternativePlayer.playerId,
            projectedPoints: alternativePlayer.projectedPoints || 0,
            auctionValue: alternativePlayer.auctionValue || 0,
            marketValue: alternativePlayer.marketValue || 0,
            vorp: alternativePlayer.vorp || 0,
            tier: alternativePlayer.tier || 'replacement'
          },
          price: bidAmount,
          round
        });
        
        budget -= bidAmount;
        currentPositions[alternativePlayer.position]++;
        draftedIds.add(alternativePlayer.playerId);
        
        console.log(`Round ${round}: Drafted ${alternativePlayer.playerName} (${alternativePlayer.position}) for $${bidAmount} - ${alternativePlayer.tier} [ALT]`);
      }
    } else {
      // Draft the target player
      roster.push({
        player: {
          id: targetPlayer.playerId,
          name: targetPlayer.playerName,
          position: targetPlayer.position as Position,
          team: targetPlayer.team,
          playerId: targetPlayer.playerId,
          projectedPoints: targetPlayer.projectedPoints || 0,
          auctionValue: targetPlayer.auctionValue || 0,
          marketValue: targetPlayer.marketValue || 0,
          vorp: targetPlayer.vorp || 0,
          tier: targetPlayer.tier || 'replacement'
        },
        price: bidAmount,
        round
      });
      
      budget -= bidAmount;
      currentPositions[position]++;
      draftedIds.add(targetPlayer.playerId);
      
      // Add to draft history
      draftHistory.push({
        player: {
          id: targetPlayer.playerId,
          name: targetPlayer.playerName,
          position: targetPlayer.position as Position,
          team: targetPlayer.team,
          playerId: targetPlayer.playerId,
          projectedPoints: targetPlayer.projectedPoints || 0,
          auctionValue: targetPlayer.auctionValue || 0,
          marketValue: targetPlayer.marketValue || 0,
          vorp: targetPlayer.vorp || 0,
          tier: targetPlayer.tier || 'replacement'
        },
        price: bidAmount,
        team: 'user',
        timestamp: Date.now()
      });
      
      console.log(`Round ${round}: Drafted ${targetPlayer.playerName} (${position}) for $${bidAmount} - ${targetPlayer.tier}`);
    }
    
    round++;
  }
  
  // Fill remaining spots with $1 players if needed
  while (roster.length < 16 && budget > 0) {
    const available = valuations.filter(v => !draftedIds.has(v.playerId));
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
        auctionValue: fillPlayer.auctionValue || 0,
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
    
    console.log(`Round ${round}: Filled ${fillPlayer.playerName} (${fillPlayer.position}) for $1`);
    round++;
  }
  
  // Calculate analysis
  const positionSpending: Record<string, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0
  };
  
  let eliteRBs = 0;
  let tier1RBs = 0;
  
  roster.forEach(pick => {
    positionSpending[pick.player.position] = (positionSpending[pick.player.position] || 0) + pick.price;
    
    if (pick.player.position === 'RB') {
      if (pick.player.tier === 'elite') eliteRBs++;
      if (pick.player.tier === 'tier1') tier1RBs++;
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
    players: roster
  };
}

async function main() {
  console.log("Testing Advisor Service Roster Composition");
  console.log("Using REAL data from artifacts/clean_data/");
  
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
        console.log(`  ${pos}: $${amount} (${pct}%)`);
      });
    
    // RB Analysis
    console.log(`\n${'='.repeat(80)}`);
    console.log('ROBUST RB STRATEGY ANALYSIS');
    console.log(`${'='.repeat(80)}`);
    console.log(`Elite RBs: ${result.eliteRBs}`);
    console.log(`Tier 1 RBs: ${result.tier1RBs}`);
    console.log(`Total RBs: ${result.positionCounts.RB}`);
    console.log(`RB Spending: $${result.positionSpending.RB} (${((result.positionSpending.RB / result.totalSpent) * 100).toFixed(1)}%)`);
    
    const targetMet = result.positionSpending.RB >= result.totalSpent * 0.5;
    console.log(`\nRobust RB Target (50-60% on RBs): ${targetMet ? '✅ MET' : '❌ NOT MET'}`);
  }
  
  // Summary across all simulations
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY ACROSS ALL SIMULATIONS');
  console.log(`${'='.repeat(80)}`);
  
  const avgRBSpending = simulations.reduce((sum, s) => sum + (s.positionSpending.RB / s.totalSpent), 0) / simulations.length;
  const avgEliteRBs = simulations.reduce((sum, s) => sum + s.eliteRBs, 0) / simulations.length;
  const avgTier1RBs = simulations.reduce((sum, s) => sum + s.tier1RBs, 0) / simulations.length;
  
  console.log(`Average RB Spending: ${(avgRBSpending * 100).toFixed(1)}%`);
  console.log(`Average Elite RBs: ${avgEliteRBs.toFixed(1)}`);
  console.log(`Average Tier 1 RBs: ${avgTier1RBs.toFixed(1)}`);
  
  const successRate = simulations.filter(s => s.positionSpending.RB >= s.totalSpent * 0.5).length / simulations.length;
  console.log(`\nRobust RB Success Rate: ${(successRate * 100).toFixed(0)}%`);
}

main().catch(console.error);