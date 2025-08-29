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
  strategy: string;
}

// Create realistic mock players with normal market values
function createRealisticPlayers(): ValuationResult[] {
  const players: ValuationResult[] = [
    // Elite RBs - Normal market prices (should trigger Robust RB)
    { id: '1', playerId: '1', playerName: 'Bijan Robinson', name: 'Bijan Robinson', position: 'RB', team: 'ATL', 
      projectedPoints: 327, points: 327, positionRank: 1, vbd: 150, vorp: 150,
      auctionValue: 57, value: 57, marketPrice: 52, marketValue: 52, edge: 5, intrinsicValue: 57,
      confidence: 85, tier: 'elite', minBid: 45, targetBid: 52, maxBid: 57, rank: 1, adp: 3.1, byeWeek: 5 },
    
    { id: '2', playerId: '2', playerName: 'Breece Hall', name: 'Breece Hall', position: 'RB', team: 'NYJ',
      projectedPoints: 318, points: 318, positionRank: 2, vbd: 141, vorp: 141,
      auctionValue: 50, value: 50, marketPrice: 48, marketValue: 48, edge: 2, intrinsicValue: 50,
      confidence: 80, tier: 'elite', minBid: 45, targetBid: 48, maxBid: 52, rank: 2, adp: 4.5, byeWeek: 7 },
    
    { id: '3', playerId: '3', playerName: 'Christian McCaffrey', name: 'Christian McCaffrey', position: 'RB', team: 'SF',
      projectedPoints: 312, points: 312, positionRank: 3, vbd: 135, vorp: 135,
      auctionValue: 48, value: 48, marketPrice: 50, marketValue: 50, edge: -2, intrinsicValue: 48,
      confidence: 75, tier: 'elite', minBid: 42, targetBid: 48, maxBid: 52, rank: 3, adp: 2.1, byeWeek: 9 },
    
    { id: '4', playerId: '4', playerName: 'Saquon Barkley', name: 'Saquon Barkley', position: 'RB', team: 'PHI',
      projectedPoints: 305, points: 305, positionRank: 4, vbd: 128, vorp: 128,
      auctionValue: 42, value: 42, marketPrice: 43, marketValue: 43, edge: -1, intrinsicValue: 42,
      confidence: 78, tier: 'tier1', minBid: 38, targetBid: 42, maxBid: 45, rank: 5, adp: 6.2, byeWeek: 5 },
    
    { id: '5', playerId: '5', playerName: 'Jonathan Taylor', name: 'Jonathan Taylor', position: 'RB', team: 'IND',
      projectedPoints: 295, points: 295, positionRank: 5, vbd: 118, vorp: 118,
      auctionValue: 38, value: 38, marketPrice: 39, marketValue: 39, edge: -1, intrinsicValue: 38,
      confidence: 76, tier: 'tier1', minBid: 34, targetBid: 38, maxBid: 42, rank: 8, adp: 9.1, byeWeek: 11 },
    
    { id: '10', playerId: '10', playerName: 'Jahmyr Gibbs', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET',
      projectedPoints: 280, points: 280, positionRank: 6, vbd: 103, vorp: 103,
      auctionValue: 32, value: 32, marketPrice: 34, marketValue: 34, edge: -2, intrinsicValue: 32,
      confidence: 75, tier: 'tier1', minBid: 28, targetBid: 32, maxBid: 35, rank: 12, adp: 12.5, byeWeek: 5 },
    
    { id: '11', playerId: '11', playerName: 'De\'Von Achane', name: 'De\'Von Achane', position: 'RB', team: 'MIA',
      projectedPoints: 275, points: 275, positionRank: 7, vbd: 98, vorp: 98,
      auctionValue: 30, value: 30, marketPrice: 31, marketValue: 31, edge: -1, intrinsicValue: 30,
      confidence: 74, tier: 'tier1', minBid: 26, targetBid: 30, maxBid: 33, rank: 14, adp: 14.2, byeWeek: 6 },
    
    // Elite WRs
    { id: '6', playerId: '6', playerName: 'CeeDee Lamb', name: 'CeeDee Lamb', position: 'WR', team: 'DAL',
      projectedPoints: 295, points: 295, positionRank: 1, vbd: 130, vorp: 130,
      auctionValue: 45, value: 45, marketPrice: 46, marketValue: 46, edge: -1, intrinsicValue: 45,
      confidence: 82, tier: 'elite', minBid: 40, targetBid: 45, maxBid: 48, rank: 4, adp: 5.3, byeWeek: 7 },
    
    { id: '7', playerId: '7', playerName: 'Tyreek Hill', name: 'Tyreek Hill', position: 'WR', team: 'MIA',
      projectedPoints: 290, points: 290, positionRank: 2, vbd: 125, vorp: 125,
      auctionValue: 42, value: 42, marketPrice: 44, marketValue: 44, edge: -2, intrinsicValue: 42,
      confidence: 80, tier: 'elite', minBid: 38, targetBid: 42, maxBid: 46, rank: 6, adp: 7.1, byeWeek: 6 },
    
    { id: '8', playerId: '8', playerName: 'Ja\'Marr Chase', name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN',
      projectedPoints: 288, points: 288, positionRank: 3, vbd: 123, vorp: 123,
      auctionValue: 41, value: 41, marketPrice: 42, marketValue: 42, edge: -1, intrinsicValue: 41,
      confidence: 81, tier: 'elite', minBid: 36, targetBid: 41, maxBid: 44, rank: 7, adp: 8.2, byeWeek: 12 },
    
    { id: '9', playerId: '9', playerName: 'Justin Jefferson', name: 'Justin Jefferson', position: 'WR', team: 'MIN',
      projectedPoints: 285, points: 285, positionRank: 4, vbd: 120, vorp: 120,
      auctionValue: 40, value: 40, marketPrice: 45, marketValue: 45, edge: -5, intrinsicValue: 40,
      confidence: 75, tier: 'elite', minBid: 35, targetBid: 40, maxBid: 45, rank: 9, adp: 10.1, byeWeek: 6 },
    
    // Tier 1 WRs
    { id: '12', playerId: '12', playerName: 'Amon-Ra St. Brown', name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET',
      projectedPoints: 270, points: 270, positionRank: 5, vbd: 105, vorp: 105,
      auctionValue: 32, value: 32, marketPrice: 33, marketValue: 33, edge: -1, intrinsicValue: 32,
      confidence: 76, tier: 'tier1', minBid: 28, targetBid: 32, maxBid: 35, rank: 11, adp: 11.8, byeWeek: 5 },
    
    { id: '13', playerId: '13', playerName: 'A.J. Brown', name: 'A.J. Brown', position: 'WR', team: 'PHI',
      projectedPoints: 265, points: 265, positionRank: 6, vbd: 100, vorp: 100,
      auctionValue: 30, value: 30, marketPrice: 31, marketValue: 31, edge: -1, intrinsicValue: 30,
      confidence: 75, tier: 'tier1', minBid: 26, targetBid: 30, maxBid: 33, rank: 13, adp: 13.5, byeWeek: 5 },
    
    // Tier 2 RBs
    { id: '16', playerId: '16', playerName: 'Josh Jacobs', name: 'Josh Jacobs', position: 'RB', team: 'GB',
      projectedPoints: 260, points: 260, positionRank: 8, vbd: 83, vorp: 83,
      auctionValue: 24, value: 24, marketPrice: 25, marketValue: 25, edge: -1, intrinsicValue: 24,
      confidence: 72, tier: 'tier2', minBid: 20, targetBid: 24, maxBid: 26, rank: 22, adp: 24.3, byeWeek: 10 },
    
    { id: '17', playerId: '17', playerName: 'Derrick Henry', name: 'Derrick Henry', position: 'RB', team: 'BAL',
      projectedPoints: 255, points: 255, positionRank: 9, vbd: 78, vorp: 78,
      auctionValue: 22, value: 22, marketPrice: 23, marketValue: 23, edge: -1, intrinsicValue: 22,
      confidence: 70, tier: 'tier2', minBid: 18, targetBid: 22, maxBid: 24, rank: 26, adp: 26.8, byeWeek: 14 },
    
    { id: '28', playerId: '28', playerName: 'James Cook', name: 'James Cook', position: 'RB', team: 'BUF',
      projectedPoints: 245, points: 245, positionRank: 10, vbd: 68, vorp: 68,
      auctionValue: 18, value: 18, marketPrice: 19, marketValue: 19, edge: -1, intrinsicValue: 18,
      confidence: 68, tier: 'tier2', minBid: 15, targetBid: 18, maxBid: 20, rank: 30, adp: 32.1, byeWeek: 12 },
    
    // Tier 2 WRs
    { id: '18', playerId: '18', playerName: 'Puka Nacua', name: 'Puka Nacua', position: 'WR', team: 'LAR',
      projectedPoints: 250, points: 250, positionRank: 7, vbd: 85, vorp: 85,
      auctionValue: 25, value: 25, marketPrice: 26, marketValue: 26, edge: -1, intrinsicValue: 25,
      confidence: 73, tier: 'tier2', minBid: 22, targetBid: 25, maxBid: 27, rank: 21, adp: 23.5, byeWeek: 6 },
    
    { id: '19', playerId: '19', playerName: 'Garrett Wilson', name: 'Garrett Wilson', position: 'WR', team: 'NYJ',
      projectedPoints: 245, points: 245, positionRank: 8, vbd: 80, vorp: 80,
      auctionValue: 23, value: 23, marketPrice: 24, marketValue: 24, edge: -1, intrinsicValue: 23,
      confidence: 71, tier: 'tier2', minBid: 20, targetBid: 23, maxBid: 25, rank: 24, adp: 25.2, byeWeek: 7 },
    
    { id: '20', playerId: '20', playerName: 'Chris Olave', name: 'Chris Olave', position: 'WR', team: 'NO',
      projectedPoints: 235, points: 235, positionRank: 9, vbd: 70, vorp: 70,
      auctionValue: 18, value: 18, marketPrice: 19, marketValue: 19, edge: -1, intrinsicValue: 18,
      confidence: 68, tier: 'tier2', minBid: 15, targetBid: 18, maxBid: 20, rank: 30, adp: 32.1, byeWeek: 11 },
    
    // Elite TE
    { id: '14', playerId: '14', playerName: 'Travis Kelce', name: 'Travis Kelce', position: 'TE', team: 'KC',
      projectedPoints: 220, points: 220, positionRank: 1, vbd: 85, vorp: 85,
      auctionValue: 25, value: 25, marketPrice: 27, marketValue: 27, edge: -2, intrinsicValue: 25,
      confidence: 78, tier: 'elite', minBid: 22, targetBid: 25, maxBid: 28, rank: 20, adp: 22.1, byeWeek: 6 },
    
    { id: '22', playerId: '22', playerName: 'Sam LaPorta', name: 'Sam LaPorta', position: 'TE', team: 'DET',
      projectedPoints: 195, points: 195, positionRank: 2, vbd: 60, vorp: 60,
      auctionValue: 15, value: 15, marketPrice: 17, marketValue: 17, edge: -2, intrinsicValue: 15,
      confidence: 70, tier: 'tier1', minBid: 12, targetBid: 15, maxBid: 18, rank: 32, adp: 34.2, byeWeek: 5 },
    
    // Elite QB
    { id: '15', playerId: '15', playerName: 'Josh Allen', name: 'Josh Allen', position: 'QB', team: 'BUF',
      projectedPoints: 380, points: 380, positionRank: 1, vbd: 60, vorp: 60,
      auctionValue: 18, value: 18, marketPrice: 20, marketValue: 20, edge: -2, intrinsicValue: 18,
      confidence: 72, tier: 'elite', minBid: 15, targetBid: 18, maxBid: 22, rank: 25, adp: 28.5, byeWeek: 12 },
    
    { id: '21', playerId: '21', playerName: 'Lamar Jackson', name: 'Lamar Jackson', position: 'QB', team: 'BAL',
      projectedPoints: 365, points: 365, positionRank: 2, vbd: 45, vorp: 45,
      auctionValue: 12, value: 12, marketPrice: 14, marketValue: 14, edge: -2, intrinsicValue: 12,
      confidence: 68, tier: 'tier1', minBid: 10, targetBid: 12, maxBid: 15, rank: 35, adp: 38.5, byeWeek: 14 },
    
    // Value RBs (tier3/replacement)
    { id: '30', playerId: '30', playerName: 'Rachaad White', name: 'Rachaad White', position: 'RB', team: 'TB',
      projectedPoints: 220, points: 220, positionRank: 12, vbd: 43, vorp: 43,
      auctionValue: 10, value: 10, marketPrice: 11, marketValue: 11, edge: -1, intrinsicValue: 10,
      confidence: 65, tier: 'tier3', minBid: 8, targetBid: 10, maxBid: 12, rank: 45, adp: 48.2, byeWeek: 11 },
    
    { id: '31', playerId: '31', playerName: 'James Conner', name: 'James Conner', position: 'RB', team: 'ARI',
      projectedPoints: 215, points: 215, positionRank: 13, vbd: 38, vorp: 38,
      auctionValue: 8, value: 8, marketPrice: 9, marketValue: 9, edge: -1, intrinsicValue: 8,
      confidence: 63, tier: 'tier3', minBid: 6, targetBid: 8, maxBid: 10, rank: 48, adp: 52.5, byeWeek: 14 },
    
    // Budget DST/K
    { id: '23', playerId: '23', playerName: 'Ravens DST', name: 'Ravens DST', position: 'DST', team: 'BAL',
      projectedPoints: 140, points: 140, positionRank: 1, vbd: 20, vorp: 20,
      auctionValue: 2, value: 2, marketPrice: 2, marketValue: 2, edge: 0, intrinsicValue: 2,
      confidence: 60, tier: 'tier1', minBid: 1, targetBid: 2, maxBid: 3, rank: 100, adp: 110, byeWeek: 14 },
    
    { id: '24', playerId: '24', playerName: 'Justin Tucker', name: 'Justin Tucker', position: 'K', team: 'BAL',
      projectedPoints: 150, points: 150, positionRank: 1, vbd: 15, vorp: 15,
      auctionValue: 1, value: 1, marketPrice: 1, marketValue: 1, edge: 0, intrinsicValue: 1,
      confidence: 55, tier: 'tier1', minBid: 1, targetBid: 1, maxBid: 2, rank: 120, adp: 130, byeWeek: 14 }
  ];
  
  return players;
}

async function runDraftSimulation(simulationId: number): Promise<RosterAnalysis> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SIMULATION ${simulationId}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Reset the service to start fresh
  (bidAdvisorService as any).activeStrategy = 'robust-rb';
  (bidAdvisorService as any).strategyPivoted = false;

  const availablePlayers = createRealisticPlayers();
  console.log(`Using ${availablePlayers.length} players with realistic market values`);
  
  // Show market conditions
  const eliteRBs = availablePlayers.filter(p => p.position === 'RB' && p.tier === 'elite');
  const avgMarketInflation = eliteRBs.reduce((sum, p) => {
    const inflation = ((p.marketValue - p.intrinsicValue!) / p.intrinsicValue!) * 100;
    return sum + inflation;
  }, 0) / eliteRBs.length;
  
  console.log(`Market Conditions: Elite RB inflation = ${avgMarketInflation.toFixed(1)}% (should maintain Robust RB)\n`);
  
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
  
  let finalStrategy = 'robust-rb';

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
        // Simulate other teams with reasonable spending
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `team${i + 1}`,
          name: `Team ${i + 1}`,
          budget: Math.max(100, 200 - (round * 8)),
          players: []
        }))
      ],
      draftHistory: draftHistory,
      availablePlayers: available,
      currentBid: 0,
      totalBudget: 200,
      rosterRequirements: {
        QB: { min: 1, max: 2, optimal: 2 },
        RB: { min: 2, max: 6, optimal: 5 },
        WR: { min: 2, max: 7, optimal: 5 },
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
    
    // Get top candidates based on position needs
    const candidates = available
      .filter(p => currentPositions[p.position] < positionNeeds[p.position])
      .sort((a, b) => {
        // In early rounds, prioritize by tier and value
        if (round <= 3 && (bidAdvisorService as any).activeStrategy === 'robust-rb') {
          // Prioritize elite RBs for Robust RB
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
        finalStrategy = rec.activeStrategy || 'robust-rb';
      }
    }
    
    if (!targetPlayer || !bestRecommendation) {
      console.log(`Round ${round}: No suitable player found`);
      break;
    }
    
    // Check for strategy pivot
    if (bestRecommendation.strategyPivotAlert) {
      console.log(`\n${bestRecommendation.strategyPivotAlert}\n`);
    }
    
    // Calculate final price (simulate realistic bidding)
    let finalPrice = targetPlayer.marketValue || 1;
    
    // Add variance for realism
    if (targetPlayer.tier === 'elite' || targetPlayer.tier === 'tier1') {
      const variance = (Math.random() * 0.1 - 0.05); // +/- 5%
      finalPrice = Math.round(finalPrice * (1 + variance));
    }
    
    // Cap at max bid and budget
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
    
    console.log(`Round ${String(round).padStart(2)}: ${targetPlayer.playerName.padEnd(20)} (${targetPlayer.position}) for $${String(finalPrice).padStart(3)} - ${targetPlayer.tier.padEnd(7)}`);
    
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
    
    console.log(`Round ${String(round).padStart(2)}: ${fillPlayer.playerName.padEnd(20)} (${fillPlayer.position}) for $  1 - FILL`);
    round++;
  }
  
  // Calculate analysis
  const positionSpending: Record<string, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0
  };
  
  let eliteRBCount = 0, tier1RBCount = 0, tier2RBCount = 0;
  let eliteWRCount = 0, tier1WRCount = 0;
  
  roster.forEach(pick => {
    positionSpending[pick.player.position] = (positionSpending[pick.player.position] || 0) + pick.price;
    
    if (pick.player.position === 'RB') {
      if (pick.player.tier === 'elite') eliteRBCount++;
      if (pick.player.tier === 'tier1') tier1RBCount++;
      if (pick.player.tier === 'tier2') tier2RBCount++;
    }
    
    if (pick.player.position === 'WR') {
      if (pick.player.tier === 'elite') eliteWRCount++;
      if (pick.player.tier === 'tier1') tier1WRCount++;
    }
  });
  
  const totalSpent = roster.reduce((sum, pick) => sum + pick.price, 0);
  
  return {
    totalSpent,
    remainingBudget: 200 - totalSpent,
    positionCounts: currentPositions,
    positionSpending,
    eliteRBs: eliteRBCount,
    tier1RBs: tier1RBCount,
    tier2RBs: tier2RBCount,
    eliteWRs: eliteWRCount,
    tier1WRs: tier1WRCount,
    players: roster,
    strategy: finalStrategy
  };
}

async function main() {
  console.log("Final Test: Advisor Service with Pivot Logic");
  console.log("Testing Robust RB Strategy in Normal Market Conditions");
  console.log("=" .repeat(80));
  
  const simulations: RosterAnalysis[] = [];
  
  // Run 2 simulations
  for (let i = 1; i <= 2; i++) {
    const result = await runDraftSimulation(i);
    simulations.push(result);
    
    // Display roster
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FINAL ROSTER - SIMULATION ${i}`);
    console.log(`Strategy Used: ${result.strategy}`);
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
        const pct = result.totalSpent > 0 ? ((amount / result.totalSpent) * 100).toFixed(1) : '0.0';
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
    const rbPct = result.totalSpent > 0 ? ((result.positionSpending.RB / result.totalSpent) * 100).toFixed(1) : '0.0';
    console.log(`RB Spending: $${result.positionSpending.RB} (${rbPct}%)`);
    
    console.log(`\nElite WRs: ${result.eliteWRs}`);
    console.log(`Tier 1 WRs: ${result.tier1WRs}`);
    console.log(`Total WRs: ${result.positionCounts.WR}`);
    const wrPct = result.totalSpent > 0 ? ((result.positionSpending.WR / result.totalSpent) * 100).toFixed(1) : '0.0';
    console.log(`WR Spending: $${result.positionSpending.WR} (${wrPct}%)`);
    
    const rbTarget = result.positionSpending.RB >= result.totalSpent * 0.5 && 
                     result.positionSpending.RB <= result.totalSpent * 0.6;
    const wrTarget = result.positionSpending.WR >= result.totalSpent * 0.25 && 
                     result.positionSpending.WR <= result.totalSpent * 0.35;
    
    console.log(`\nRobust RB Target (50-60% on RBs): ${rbTarget ? '✅ MET' : '❌ NOT MET (Actual: ' + rbPct + '%)'}`);
    console.log(`WR Depth Target (25-35% on WRs): ${wrTarget ? '✅ MET' : '❌ NOT MET (Actual: ' + wrPct + '%)'}`);
    console.log(`Full 16-Player Roster: ${result.players.length === 16 ? '✅ COMPLETE' : '❌ INCOMPLETE (' + result.players.length + '/16)'}`);
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY ACROSS ALL SIMULATIONS');
  console.log(`${'='.repeat(80)}`);
  
  const avgRBSpending = simulations.reduce((sum, s) => 
    s.totalSpent > 0 ? sum + (s.positionSpending.RB / s.totalSpent) : sum, 0
  ) / simulations.length;
  const avgWRSpending = simulations.reduce((sum, s) => 
    s.totalSpent > 0 ? sum + (s.positionSpending.WR / s.totalSpent) : sum, 0
  ) / simulations.length;
  const avgEliteRBs = simulations.reduce((sum, s) => sum + s.eliteRBs, 0) / simulations.length;
  const avgTier1RBs = simulations.reduce((sum, s) => sum + s.tier1RBs, 0) / simulations.length;
  const avgRosterSize = simulations.reduce((sum, s) => sum + s.players.length, 0) / simulations.length;
  
  console.log(`Average RB Spending: ${(avgRBSpending * 100).toFixed(1)}%`);
  console.log(`Average WR Spending: ${(avgWRSpending * 100).toFixed(1)}%`);
  console.log(`Average Elite RBs: ${avgEliteRBs.toFixed(1)}`);
  console.log(`Average Tier 1 RBs: ${avgTier1RBs.toFixed(1)}`);
  console.log(`Average Roster Size: ${avgRosterSize.toFixed(1)}/16`);
  
  const successRate = simulations.filter(s => 
    s.positionSpending.RB >= s.totalSpent * 0.5 && 
    s.positionSpending.RB <= s.totalSpent * 0.6
  ).length / simulations.length;
  
  console.log(`\nRobust RB Success Rate: ${(successRate * 100).toFixed(0)}%`);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL VERDICT');
  console.log(`${'='.repeat(80)}`);
  
  const meetsTargets = avgRBSpending >= 0.5 && avgRBSpending <= 0.6 && 
                       avgWRSpending >= 0.25 && avgWRSpending <= 0.35 &&
                       avgRosterSize === 16;
  
  if (meetsTargets) {
    console.log('✅ SUCCESS: Advisor service produces desired Robust RB composition');
    console.log('   - RB spending within 50-60% target');
    console.log('   - WR spending within 25-35% target');
    console.log('   - Complete 16-player rosters');
  } else {
    console.log('⚠️  PARTIAL SUCCESS: Some adjustments needed');
    if (avgRBSpending < 0.5 || avgRBSpending > 0.6) {
      console.log(`   - RB spending outside target: ${(avgRBSpending * 100).toFixed(1)}%`);
    }
    if (avgWRSpending < 0.25 || avgWRSpending > 0.35) {
      console.log(`   - WR spending outside target: ${(avgWRSpending * 100).toFixed(1)}%`);
    }
    if (avgRosterSize < 16) {
      console.log(`   - Incomplete rosters: ${avgRosterSize.toFixed(1)}/16`);
    }
  }
}

main().catch(console.error);