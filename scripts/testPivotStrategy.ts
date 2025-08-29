import { bidAdvisorService } from '../src/lib/bidAdvisorService';
import type { Player, Position, DraftPick } from '../src/types';
import type { ValuationResult } from '../src/lib/calibratedValuationService';
import type { DraftContext } from '../src/lib/bidAdvisorService';

// Create mock players with INFLATED RB prices to trigger pivot
function createInflatedMarketPlayers(): ValuationResult[] {
  const players: ValuationResult[] = [
    // Elite RBs with INFLATED market prices (30-40% over value)
    { id: '1', playerId: '1', playerName: 'Bijan Robinson', name: 'Bijan Robinson', position: 'RB', team: 'ATL', 
      projectedPoints: 327, points: 327, positionRank: 1, vbd: 150, vorp: 150,
      auctionValue: 57, value: 57, marketPrice: 75, marketValue: 75, edge: -18, intrinsicValue: 57,
      confidence: 85, tier: 'elite', minBid: 45, targetBid: 52, maxBid: 57, rank: 1, adp: 3.1 },
    
    { id: '2', playerId: '2', playerName: 'Breece Hall', name: 'Breece Hall', position: 'RB', team: 'NYJ',
      projectedPoints: 318, points: 318, positionRank: 2, vbd: 141, vorp: 141,
      auctionValue: 28, value: 28, marketPrice: 68, marketValue: 68, edge: -40, intrinsicValue: 28,
      confidence: 80, tier: 'elite', minBid: 25, targetBid: 28, maxBid: 30, rank: 2, adp: 4.5 },
    
    { id: '3', playerId: '3', playerName: 'Christian McCaffrey', name: 'Christian McCaffrey', position: 'RB', team: 'SF',
      projectedPoints: 312, points: 312, positionRank: 3, vbd: 135, vorp: 135,
      auctionValue: 45, value: 45, marketPrice: 72, marketValue: 72, edge: -27, intrinsicValue: 45,
      confidence: 75, tier: 'elite', minBid: 40, targetBid: 45, maxBid: 50, rank: 3, adp: 2.1 },
    
    { id: '4', playerId: '4', playerName: 'Saquon Barkley', name: 'Saquon Barkley', position: 'RB', team: 'PHI',
      projectedPoints: 305, points: 305, positionRank: 4, vbd: 128, vorp: 128,
      auctionValue: 42, value: 42, marketPrice: 62, marketValue: 62, edge: -20, intrinsicValue: 42,
      confidence: 78, tier: 'tier1', minBid: 35, targetBid: 42, maxBid: 45, rank: 5, adp: 6.2 },
    
    // Elite WRs with NORMAL market prices (value opportunities)
    { id: '6', playerId: '6', playerName: 'CeeDee Lamb', name: 'CeeDee Lamb', position: 'WR', team: 'DAL',
      projectedPoints: 295, points: 295, positionRank: 1, vbd: 130, vorp: 130,
      auctionValue: 45, value: 45, marketPrice: 42, marketValue: 42, edge: 3, intrinsicValue: 45,
      confidence: 82, tier: 'elite', minBid: 40, targetBid: 45, maxBid: 48, rank: 4, adp: 5.3 },
    
    { id: '7', playerId: '7', playerName: 'Tyreek Hill', name: 'Tyreek Hill', position: 'WR', team: 'MIA',
      projectedPoints: 290, points: 290, positionRank: 2, vbd: 125, vorp: 125,
      auctionValue: 42, value: 42, marketPrice: 38, marketValue: 38, edge: 4, intrinsicValue: 42,
      confidence: 80, tier: 'elite', minBid: 38, targetBid: 42, maxBid: 46, rank: 6, adp: 7.1 },
    
    { id: '8', playerId: '8', playerName: 'Ja\'Marr Chase', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN',
      projectedPoints: 288, points: 288, positionRank: 3, vbd: 123, vorp: 123,
      auctionValue: 41, value: 41, marketPrice: 36, marketValue: 36, edge: 5, intrinsicValue: 41,
      confidence: 81, tier: 'elite', minBid: 36, targetBid: 41, maxBid: 44, rank: 7, adp: 8.2 },
    
    { id: '9', playerId: '9', playerName: 'Justin Jefferson', name: 'Justin Jefferson', position: 'WR', team: 'MIN',
      projectedPoints: 285, points: 285, positionRank: 4, vbd: 120, vorp: 120,
      auctionValue: 40, value: 40, marketPrice: 37, marketValue: 37, edge: 3, intrinsicValue: 40,
      confidence: 75, tier: 'elite', minBid: 35, targetBid: 40, maxBid: 45, rank: 9, adp: 10.1 },
    
    // Value RBs later (for Zero RB strategy)
    { id: '20', playerId: '20', playerName: 'Rachaad White', name: 'Rachaad White', position: 'RB', team: 'TB',
      projectedPoints: 240, points: 240, positionRank: 12, vbd: 63, vorp: 63,
      auctionValue: 15, value: 15, marketPrice: 12, marketValue: 12, edge: 3, intrinsicValue: 15,
      confidence: 70, tier: 'tier3', minBid: 10, targetBid: 15, maxBid: 18, rank: 35, adp: 40.2 },
    
    { id: '21', playerId: '21', playerName: 'James Conner', name: 'James Conner', position: 'RB', team: 'ARI',
      projectedPoints: 235, points: 235, positionRank: 13, vbd: 58, vorp: 58,
      auctionValue: 12, value: 12, marketPrice: 10, marketValue: 10, edge: 2, intrinsicValue: 12,
      confidence: 68, tier: 'tier3', minBid: 8, targetBid: 12, maxBid: 15, rank: 38, adp: 42.5 },
    
    // Other positions
    { id: '14', playerId: '14', playerName: 'Travis Kelce', name: 'Travis Kelce', position: 'TE', team: 'KC',
      projectedPoints: 220, points: 220, positionRank: 1, vbd: 85, vorp: 85,
      auctionValue: 25, value: 25, marketPrice: 28, marketValue: 28, edge: -3, intrinsicValue: 25,
      confidence: 78, tier: 'elite', minBid: 22, targetBid: 25, maxBid: 28, rank: 20, adp: 22.1 },
    
    { id: '15', playerId: '15', playerName: 'Josh Allen', name: 'Josh Allen', position: 'QB', team: 'BUF',
      projectedPoints: 380, points: 380, positionRank: 1, vbd: 60, vorp: 60,
      auctionValue: 18, value: 18, marketPrice: 22, marketValue: 22, edge: -4, intrinsicValue: 18,
      confidence: 72, tier: 'elite', minBid: 15, targetBid: 18, maxBid: 22, rank: 25, adp: 28.5 }
  ];
  
  return players;
}

async function simulateInflatedMarket(): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SCENARIO: INFLATED RB MARKET (Testing Pivot Logic)`);
  console.log(`${'='.repeat(80)}\n`);
  
  const availablePlayers = createInflatedMarketPlayers();
  console.log('Elite RB Market Prices:');
  availablePlayers
    .filter(p => p.position === 'RB' && (p.tier === 'elite' || p.tier === 'tier1'))
    .slice(0, 4)
    .forEach(p => {
      const inflation = Math.round(((p.marketValue - p.intrinsicValue!) / p.intrinsicValue!) * 100);
      console.log(`  ${p.playerName}: Market=$${p.marketValue}, Value=$${p.intrinsicValue}, Inflation=+${inflation}%`);
    });
  
  console.log('\nElite WR Market Prices:');
  availablePlayers
    .filter(p => p.position === 'WR' && p.tier === 'elite')
    .slice(0, 4)
    .forEach(p => {
      const diff = p.marketValue - p.intrinsicValue!;
      console.log(`  ${p.playerName}: Market=$${p.marketValue}, Value=$${p.intrinsicValue}, Edge=$${diff}`);
    });
  
  // Initialize draft state
  let budget = 200;
  let roster: any[] = [];
  const draftedIds = new Set<string>();
  let round = 1;
  const draftHistory: DraftPick[] = [];
  
  // Simulate other teams already getting elite RBs at inflated prices
  console.log('\n--- Simulating Other Teams Getting Elite RBs ---');
  
  // Team 1 gets Bijan at inflated price
  draftHistory.push({
    player: {
      id: '1', playerId: '1', name: 'Bijan Robinson', position: 'RB' as Position,
      team: 'ATL', projectedPoints: 327, auctionValue: 57, marketValue: 75,
      vorp: 150, tier: 'elite'
    },
    price: 75,
    team: 'team1',
    timestamp: Date.now()
  });
  draftedIds.add('1');
  console.log('Team 1: Bijan Robinson for $75 (32% over value)');
  
  // Team 2 gets CMC at inflated price
  draftHistory.push({
    player: {
      id: '3', playerId: '3', name: 'Christian McCaffrey', position: 'RB' as Position,
      team: 'SF', projectedPoints: 312, auctionValue: 45, marketValue: 72,
      vorp: 135, tier: 'elite'
    },
    price: 72,
    team: 'team2',
    timestamp: Date.now()
  });
  draftedIds.add('3');
  console.log('Team 2: Christian McCaffrey for $72 (60% over value)');
  
  console.log('\n--- Our Draft Begins (Should Trigger Pivot) ---\n');
  
  // Now simulate our drafting
  while (roster.length < 8 && budget > roster.length) {
    const available = availablePlayers.filter(v => !draftedIds.has(v.playerId));
    
    // Create draft context showing inflated market
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
        {
          id: 'team1',
          name: 'Team 1',
          budget: 125, // Spent 75 on Bijan
          players: [{
            id: '1', playerId: '1', name: 'Bijan Robinson', position: 'RB' as Position,
            team: 'ATL', projectedPoints: 327, auctionValue: 57, marketValue: 75,
            vorp: 150, tier: 'elite'
          }]
        },
        {
          id: 'team2',
          name: 'Team 2',
          budget: 128, // Spent 72 on CMC
          players: [{
            id: '3', playerId: '3', name: 'Christian McCaffrey', position: 'RB' as Position,
            team: 'SF', projectedPoints: 312, auctionValue: 45, marketValue: 72,
            vorp: 135, tier: 'elite'
          }]
        }
      ],
      draftHistory: draftHistory,
      availablePlayers: available,
      currentBid: 0,
      totalBudget: 200,
      rosterRequirements: {
        QB: { min: 1, max: 2, optimal: 1 },
        RB: { min: 2, max: 6, optimal: 5 },
        WR: { min: 2, max: 7, optimal: 5 },
        TE: { min: 1, max: 2, optimal: 2 },
        DST: { min: 1, max: 1, optimal: 1 },
        K: { min: 1, max: 1, optimal: 1 },
        FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
        BENCH: 7
      }
    };
    
    // Get best available player
    const candidates = available
      .sort((a, b) => {
        const tierOrder = { elite: 5, tier1: 4, tier2: 3, tier3: 2, replacement: 1 };
        const aTier = tierOrder[a.tier] || 0;
        const bTier = tierOrder[b.tier] || 0;
        if (aTier !== bTier) return bTier - aTier;
        return (b.edge || 0) - (a.edge || 0);
      })
      .slice(0, 3);
    
    let bestRecommendation = null;
    let bestPlayer = null;
    let bestScore = -Infinity;
    
    for (const candidate of candidates) {
      const rec = bidAdvisorService.getRecommendation(
        candidate,
        draftContext,
        candidate.marketValue || 0
      );
      
      if (rec && rec.confidence > bestScore) {
        bestScore = rec.confidence;
        bestRecommendation = rec;
        bestPlayer = candidate;
      }
    }
    
    if (!bestPlayer || !bestRecommendation) break;
    
    // Check if strategy pivot occurred
    if (bestRecommendation.strategyPivotAlert) {
      console.log(`\n${bestRecommendation.strategyPivotAlert}\n`);
    }
    
    const bidAmount = Math.min(
      bestRecommendation.maxProfitableBid || bestPlayer.intrinsicValue || 1,
      budget - (8 - roster.length - 1)
    );
    
    roster.push({
      player: bestPlayer,
      price: bidAmount,
      round
    });
    
    budget -= bidAmount;
    draftedIds.add(bestPlayer.playerId);
    
    console.log(`Round ${round}: ${bestPlayer.playerName.padEnd(20)} (${bestPlayer.position}) for $${bidAmount.toString().padStart(3)} - Strategy: ${bestRecommendation.activeStrategy}`);
    
    round++;
  }
  
  // Show final analysis
  console.log(`\n${'='.repeat(80)}`);
  console.log('PIVOT STRATEGY RESULTS');
  console.log(`${'='.repeat(80)}`);
  
  const rbSpending = roster.filter(r => r.player.position === 'RB').reduce((sum, r) => sum + r.price, 0);
  const wrSpending = roster.filter(r => r.player.position === 'WR').reduce((sum, r) => sum + r.price, 0);
  const totalSpent = roster.reduce((sum, r) => sum + r.price, 0);
  
  console.log('\nRoster Composition:');
  const positions = ['RB', 'WR', 'TE', 'QB'];
  positions.forEach(pos => {
    const players = roster.filter(r => r.player.position === pos);
    if (players.length > 0) {
      console.log(`\n${pos}s (${players.length}):`);
      players.forEach(p => {
        console.log(`  $${p.price.toString().padStart(3)} - ${p.player.playerName} [${p.player.tier}]`);
      });
    }
  });
  
  console.log('\nSpending Analysis:');
  console.log(`  RB: $${rbSpending} (${((rbSpending / totalSpent) * 100).toFixed(1)}%)`);
  console.log(`  WR: $${wrSpending} (${((wrSpending / totalSpent) * 100).toFixed(1)}%)`);
  
  const pivotSuccess = wrSpending > rbSpending || (rbSpending / totalSpent) < 0.4;
  console.log(`\nPivot Success: ${pivotSuccess ? '✅ Successfully pivoted away from expensive RBs' : '❌ Still overspent on RBs'}`);
}

async function simulateNormalMarket(): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SCENARIO: NORMAL MARKET (Should Maintain Robust RB)`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Reset the service for a fresh test
  (bidAdvisorService as any).activeStrategy = 'robust-rb';
  (bidAdvisorService as any).strategyPivoted = false;
  
  // Use normal market prices
  const players: ValuationResult[] = [
    // Elite RBs with NORMAL prices
    { id: '1', playerId: '1', playerName: 'Bijan Robinson', name: 'Bijan Robinson', position: 'RB', team: 'ATL', 
      projectedPoints: 327, points: 327, positionRank: 1, vbd: 150, vorp: 150,
      auctionValue: 57, value: 57, marketPrice: 52, marketValue: 52, edge: 5, intrinsicValue: 57,
      confidence: 85, tier: 'elite', minBid: 45, targetBid: 52, maxBid: 57, rank: 1, adp: 3.1 },
    
    { id: '2', playerId: '2', playerName: 'Breece Hall', name: 'Breece Hall', position: 'RB', team: 'NYJ',
      projectedPoints: 318, points: 318, positionRank: 2, vbd: 141, vorp: 141,
      auctionValue: 28, value: 28, marketPrice: 48, marketValue: 48, edge: -20, intrinsicValue: 28,
      confidence: 80, tier: 'elite', minBid: 25, targetBid: 28, maxBid: 30, rank: 2, adp: 4.5 },
    
    // WRs
    { id: '6', playerId: '6', playerName: 'CeeDee Lamb', name: 'CeeDee Lamb', position: 'WR', team: 'DAL',
      projectedPoints: 295, points: 295, positionRank: 1, vbd: 130, vorp: 130,
      auctionValue: 45, value: 45, marketPrice: 48, marketValue: 48, edge: -3, intrinsicValue: 45,
      confidence: 82, tier: 'elite', minBid: 40, targetBid: 45, maxBid: 48, rank: 4, adp: 5.3 }
  ];
  
  const draftContext: DraftContext = {
    myTeam: {
      id: 'user',
      name: 'My Team',
      budget: 200,
      players: [],
      isUser: true
    },
    allTeams: [
      {
        id: 'user',
        name: 'My Team',
        budget: 200,
        players: [],
        isUser: true
      }
    ],
    draftHistory: [],
    availablePlayers: players,
    currentBid: 0,
    totalBudget: 200,
    rosterRequirements: {
      QB: { min: 1, max: 2, optimal: 1 },
      RB: { min: 2, max: 6, optimal: 5 },
      WR: { min: 2, max: 7, optimal: 5 },
      TE: { min: 1, max: 2, optimal: 2 },
      DST: { min: 1, max: 1, optimal: 1 },
      K: { min: 1, max: 1, optimal: 1 },
      FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
      BENCH: 7
    }
  };
  
  const rec = bidAdvisorService.getRecommendation(
    players[0], // Bijan
    draftContext,
    52 // market price
  );
  
  console.log('Recommendation for Bijan Robinson:');
  console.log(`  Strategy: ${rec.activeStrategy}`);
  console.log(`  Action: ${rec.action}`);
  console.log(`  Max Bid: $${rec.maxProfitableBid}`);
  console.log(`  Should maintain Robust RB strategy: ${rec.activeStrategy === 'robust-rb' ? '✅' : '❌'}`);
}

async function main() {
  console.log('Testing BidAdvisor Pivot Strategy Logic');
  console.log('=' .repeat(80));
  
  await simulateInflatedMarket();
  await simulateNormalMarket();
}

main().catch(console.error);