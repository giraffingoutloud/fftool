/**
 * Draft Simulator for Testing Robust RB Strategy
 */

import { bidAdvisorService } from './bidAdvisorService';
import { calibratedValuationService } from './calibratedValuationService';
import type { ValuationResult } from './calibratedValuationService';
import type { Player, Team, DraftContext } from '../types';

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

export interface SimulationResult {
  userTeam: SimTeam;
  allTeams: SimTeam[];
  draftHistory: DraftPick[];
  analysis: {
    meetsRequirements: boolean;
    budgetEfficient: boolean;
    rbHeavy: boolean;
    eliteRBCount: number;
    totalSpent: number;
    rbSpend: number;
    rbSpendPercent: number;
    projectedPoints: number;
    leagueRank: number;
    positionCounts: Record<string, number>;
    positionSpend: Record<string, number>;
  };
}

export class DraftSimulator {
  private allPlayers: ValuationResult[] = [];
  private availablePlayers: ValuationResult[] = [];
  private teams: SimTeam[] = [];
  private draftHistory: DraftPick[] = [];
  private pickNumber = 0;
  private nominationOrder = 0;

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
    // Load data and get valuations
    let valuations: ValuationResult[] = [];
    
    // Try to get from exposed valuations first (browser environment)
    if (typeof window !== 'undefined' && (window as any).__playerValuations && (window as any).__playerValuations.length > 0) {
      valuations = (window as any).__playerValuations;
      console.log(`Loaded ${valuations.length} players from app data`);
    } else {
      // Use mock data for testing
      // Using mock data for simulation
      valuations = this.createMockValuations();
    }
    
    // Filter to draftable players and sort by value
    this.allPlayers = valuations
      .filter(p => p.value && p.value > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 300); // Top 300 players
    
    this.availablePlayers = [...this.allPlayers];
  }
  
  private createMockValuations(): ValuationResult[] {
    // Create realistic mock data for testing
    const mockPlayers: ValuationResult[] = [];
    
    // Add elite RBs - INCREASED VALUES for proper budget spending
    const eliteRBs = [
      { playerName: 'Christian McCaffrey', position: 'RB', tier: 'elite', value: 75, marketValue: 72, projectedPoints: 320 },
      { playerName: 'Breece Hall', position: 'RB', tier: 'elite', value: 68, marketValue: 65, projectedPoints: 305 },
      { playerName: 'Bijan Robinson', position: 'RB', tier: 'elite', value: 65, marketValue: 62, projectedPoints: 300 },
    ];
    
    // Add tier1 RBs - INCREASED VALUES
    const tier1RBs = [
      { playerName: 'Saquon Barkley', position: 'RB', tier: 'tier1', value: 52, marketValue: 48, projectedPoints: 285 },
      { playerName: 'Jonathan Taylor', position: 'RB', tier: 'tier1', value: 48, marketValue: 45, projectedPoints: 280 },
      { playerName: 'Jahmyr Gibbs', position: 'RB', tier: 'tier1', value: 46, marketValue: 43, projectedPoints: 275 },
      { playerName: 'Travis Etienne', position: 'RB', tier: 'tier1', value: 42, marketValue: 40, projectedPoints: 270 },
    ];
    
    // Add elite WRs
    const eliteWRs = [
      { playerName: 'CeeDee Lamb', position: 'WR', tier: 'elite', value: 55, marketValue: 53, projectedPoints: 290 },
      { playerName: 'Tyreek Hill', position: 'WR', tier: 'elite', value: 52, marketValue: 50, projectedPoints: 285 },
      { playerName: 'Amon-Ra St. Brown', position: 'WR', tier: 'elite', value: 50, marketValue: 48, projectedPoints: 280 },
    ];
    
    // Add more players for each position - MORE RBs for depth
    const tier2RBs = [
      { playerName: 'Derrick Henry', position: 'RB', tier: 'tier2', value: 38, marketValue: 35, projectedPoints: 250 },
      { playerName: 'James Cook', position: 'RB', tier: 'tier2', value: 35, marketValue: 32, projectedPoints: 240 },
      { playerName: 'Kyren Williams', position: 'RB', tier: 'tier2', value: 32, marketValue: 30, projectedPoints: 235 },
      { playerName: 'Rachaad White', position: 'RB', tier: 'tier2', value: 28, marketValue: 26, projectedPoints: 230 },
      { playerName: 'Kenneth Walker', position: 'RB', tier: 'tier2', value: 26, marketValue: 24, projectedPoints: 225 },
    ];
    
    const tier2WRs = [
      { playerName: 'Mike Evans', position: 'WR', tier: 'tier2', value: 38, marketValue: 36, projectedPoints: 255 },
      { playerName: 'Chris Olave', position: 'WR', tier: 'tier2', value: 35, marketValue: 33, projectedPoints: 245 },
      { playerName: 'Nico Collins', position: 'WR', tier: 'tier2', value: 32, marketValue: 30, projectedPoints: 240 },
    ];
    
    // Add QBs
    const qbs = [
      { playerName: 'Josh Allen', position: 'QB', tier: 'elite', value: 35, marketValue: 33, projectedPoints: 380 },
      { playerName: 'Jalen Hurts', position: 'QB', tier: 'elite', value: 32, marketValue: 30, projectedPoints: 370 },
      { playerName: 'Lamar Jackson', position: 'QB', tier: 'tier1', value: 28, marketValue: 26, projectedPoints: 360 },
      { playerName: 'Dak Prescott', position: 'QB', tier: 'tier2', value: 15, marketValue: 13, projectedPoints: 330 },
    ];
    
    // Add TEs
    const tes = [
      { playerName: 'Travis Kelce', position: 'TE', tier: 'elite', value: 35, marketValue: 33, projectedPoints: 220 },
      { playerName: 'T.J. Hockenson', position: 'TE', tier: 'tier1', value: 22, marketValue: 20, projectedPoints: 180 },
      { playerName: 'Mark Andrews', position: 'TE', tier: 'tier1', value: 20, marketValue: 18, projectedPoints: 175 },
    ];
    
    // Add value players with realistic names
    const tier3RBs = [
      { playerName: 'Tony Pollard', position: 'RB', tier: 'tier3', value: 18, marketValue: 16, projectedPoints: 200 },
      { playerName: 'Najee Harris', position: 'RB', tier: 'tier3', value: 16, marketValue: 14, projectedPoints: 195 },
      { playerName: 'Joe Mixon', position: 'RB', tier: 'tier3', value: 14, marketValue: 12, projectedPoints: 190 },
      { playerName: 'Alvin Kamara', position: 'RB', tier: 'tier3', value: 12, marketValue: 10, projectedPoints: 185 },
      { playerName: 'Rhamondre Stevenson', position: 'RB', tier: 'tier3', value: 10, marketValue: 9, projectedPoints: 180 },
    ];
    
    const valueRBs = [
      { playerName: 'Brian Robinson', position: 'RB', tier: 'tier4', value: 8, marketValue: 7, projectedPoints: 160 },
      { playerName: 'Jaylen Warren', position: 'RB', tier: 'tier4', value: 6, marketValue: 5, projectedPoints: 150 },
      { playerName: 'Tyjae Spears', position: 'RB', tier: 'tier4', value: 5, marketValue: 4, projectedPoints: 140 },
      { playerName: 'Zach Charbonnet', position: 'RB', tier: 'tier4', value: 4, marketValue: 3, projectedPoints: 130 },
      { playerName: 'Tank Bigsby', position: 'RB', tier: 'tier5', value: 3, marketValue: 2, projectedPoints: 120 },
      { playerName: 'Roschon Johnson', position: 'RB', tier: 'tier5', value: 2, marketValue: 2, projectedPoints: 110 },
      { playerName: 'Khalil Herbert', position: 'RB', tier: 'tier5', value: 2, marketValue: 1, projectedPoints: 100 },
      { playerName: 'Chase Brown', position: 'RB', tier: 'tier5', value: 1, marketValue: 1, projectedPoints: 90 },
    ];
    
    const tier3WRs = [
      { playerName: 'Calvin Ridley', position: 'WR', tier: 'tier3', value: 25, marketValue: 23, projectedPoints: 220 },
      { playerName: 'Terry McLaurin', position: 'WR', tier: 'tier3', value: 22, marketValue: 20, projectedPoints: 210 },
      { playerName: 'DeAndre Hopkins', position: 'WR', tier: 'tier3', value: 20, marketValue: 18, projectedPoints: 200 },
      { playerName: 'Amari Cooper', position: 'WR', tier: 'tier3', value: 18, marketValue: 16, projectedPoints: 195 },
      { playerName: 'Christian Kirk', position: 'WR', tier: 'tier3', value: 16, marketValue: 14, projectedPoints: 190 },
    ];
    
    const valueWRs = [
      { playerName: 'Diontae Johnson', position: 'WR', tier: 'tier4', value: 12, marketValue: 10, projectedPoints: 180 },
      { playerName: 'Michael Pittman', position: 'WR', tier: 'tier4', value: 10, marketValue: 9, projectedPoints: 175 },
      { playerName: 'Jaxon Smith-Njigba', position: 'WR', tier: 'tier4', value: 8, marketValue: 7, projectedPoints: 170 },
      { playerName: 'Khalil Shakir', position: 'WR', tier: 'tier4', value: 6, marketValue: 5, projectedPoints: 165 },
      { playerName: 'Rashid Shaheed', position: 'WR', tier: 'tier4', value: 5, marketValue: 4, projectedPoints: 160 },
      { playerName: 'Josh Downs', position: 'WR', tier: 'tier5', value: 4, marketValue: 3, projectedPoints: 150 },
      { playerName: 'Quentin Johnston', position: 'WR', tier: 'tier5', value: 3, marketValue: 2, projectedPoints: 140 },
      { playerName: 'Romeo Doubs', position: 'WR', tier: 'tier5', value: 2, marketValue: 2, projectedPoints: 130 },
      { playerName: 'Wan\'Dale Robinson', position: 'WR', tier: 'tier5', value: 2, marketValue: 1, projectedPoints: 120 },
      { playerName: 'Darnell Mooney', position: 'WR', tier: 'tier5', value: 1, marketValue: 1, projectedPoints: 110 },
    ];
    
    // Add DST and K
    const dsts = [
      { playerName: 'Ravens DST', position: 'DST', tier: 'tier1', value: 3, marketValue: 2, projectedPoints: 120 },
      { playerName: 'Cowboys DST', position: 'DST', tier: 'tier2', value: 2, marketValue: 1, projectedPoints: 110 },
    ];
    
    const kickers = [
      { playerName: 'Justin Tucker', position: 'K', tier: 'tier1', value: 2, marketValue: 1, projectedPoints: 140 },
      { playerName: 'Harrison Butker', position: 'K', tier: 'tier1', value: 1, marketValue: 1, projectedPoints: 135 },
    ];
    
    // Combine all players
    mockPlayers.push(
      ...eliteRBs, ...tier1RBs, ...eliteWRs, ...tier2RBs, ...tier2WRs,
      ...tier3RBs, ...tier3WRs, ...qbs, ...tes, ...valueRBs, ...valueWRs, ...dsts, ...kickers
    );
    
    // Add required fields for ValuationResult
    return mockPlayers.map((p, idx) => ({
      ...p,
      playerId: `player_${idx}`,
      team: 'TEAM',
      auctionValue: p.value,
      intrinsicValue: p.value,
      edge: (p.value || 0) - (p.marketValue || 0),
      vorp: p.value || 0,
      maxBid: (p.value || 0) * 1.1,
      marketPrice: p.marketValue
    } as ValuationResult));
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
    if ((posCounts.DST || 0) < 1 && slotsLeft > 2) needs.push('DST');
    if ((posCounts.K || 0) < 1 && slotsLeft > 2) needs.push('K');
    
    // Fill out with best available after minimums
    if (needs.length === 0) {
      if ((posCounts.RB || 0) < 5) needs.push('RB');
      if ((posCounts.WR || 0) < 5) needs.push('WR');
      if ((posCounts.TE || 0) < 2) needs.push('TE');
      if ((posCounts.QB || 0) < 2) needs.push('QB');
    }

    return needs;
  }

  private nominatePlayer(nominatingTeam: SimTeam): ValuationResult | null {
    if (this.availablePlayers.length === 0) return null;
    
    const teamNeeds = this.getTeamNeeds(nominatingTeam);
    const draftProgress = this.pickNumber / 192;
    
    // User team nominates strategically for Robust RB
    if (nominatingTeam.isUser && draftProgress < 0.3) {
      // Early: nominate non-RB studs to drain other budgets
      const eliteNonRBs = this.availablePlayers.filter(p => 
        p.position !== 'RB' && p.tier === 'elite'
      );
      if (eliteNonRBs.length > 0) {
        return eliteNonRBs[0];
      }
    }
    
    // Nominate based on team needs
    if (teamNeeds.length > 0) {
      const neededPlayers = this.availablePlayers.filter(p => 
        teamNeeds.includes(p.position)
      );
      
      if (neededPlayers.length > 0) {
        return neededPlayers[0];
      }
    }
    
    // Late in draft, nominate cheaper players
    if (draftProgress > 0.7) {
      const cheapPlayers = this.availablePlayers.filter(p => (p.value || 0) <= 5);
      if (cheapPlayers.length > 0) {
        return cheapPlayers[Math.floor(Math.random() * Math.min(10, cheapPlayers.length))];
      }
    }
    
    // Otherwise top available with some randomness
    const topN = Math.min(20, this.availablePlayers.length);
    const idx = Math.floor(Math.random() * topN);
    return this.availablePlayers[idx];
  }

  private simulateAuction(player: ValuationResult): { winner: SimTeam; price: number } | null {
    let currentBid = 1;
    let leadingTeam: SimTeam | null = null;
    const baseValue = player.value || 1;
    
    // Track bidding rounds
    let biddingRounds = 0;
    const maxRounds = 10;
    
    while (biddingRounds < maxRounds) {
      let newBidder: SimTeam | null = null;
      let highestBid = currentBid;
      
      for (const team of this.teams) {
        if (team === leadingTeam) continue;
        
        const budget = team.budget - team.spent;
        const slotsLeft = 16 - team.roster.length;
        const maxAfford = budget - (slotsLeft - 1);
        
        if (maxAfford <= currentBid) continue;
        
        const teamNeeds = this.getTeamNeeds(team);
        const needsPlayer = teamNeeds.includes(player.position);
        
        let teamMax = baseValue;
        
        if (team.isUser) {
          // User team uses recommendation system
          const context = this.buildContext(team);
          const rec = bidAdvisorService.getRecommendation(player, context, currentBid);
          
          if (rec.action === 'strong-buy') {
            teamMax = rec.maxBid;
          } else if (rec.action === 'consider') {
            teamMax = rec.maxBid * 0.95;
          } else {
            continue;
          }
        } else {
          // AI teams use strategy-based bidding
          const positionCounts: Record<string, number> = {};
          team.roster.forEach(p => {
            positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
          });
          
          if (needsPlayer && slotsLeft <= 5) {
            teamMax = baseValue * 1.3;
          } else if (team.strategy === 'stars' && player.tier === 'elite') {
            teamMax = baseValue * 1.25;
          } else if (team.strategy === 'zero-rb' && player.position === 'RB') {
            teamMax = baseValue * 0.6;
          } else if (team.strategy === 'balanced') {
            teamMax = baseValue * (0.95 + Math.random() * 0.15);
          } else {
            teamMax = baseValue * (0.9 + Math.random() * 0.25);
          }
          
          // Scarcity adjustments
          if (player.position === 'QB' && (positionCounts.QB || 0) === 0) {
            teamMax *= 1.15;
          }
          if (player.position === 'TE' && (positionCounts.TE || 0) === 0 && player.tier !== 'replacement') {
            teamMax *= 1.1;
          }
        }
        
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
        break;
      }
    }
    
    if (leadingTeam) {
      return { winner: leadingTeam, price: currentBid };
    }
    
    // Force sale to needy team
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

  private buildContext(team: SimTeam): DraftContext {
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
        RB: { min: 2, max: 6, optimal: 5 },
        WR: { min: 2, max: 6, optimal: 6 },
        TE: { min: 1, max: 3, optimal: 1 },
        DST: { min: 1, max: 2, optimal: 1 },
        K: { min: 1, max: 2, optimal: 1 },
        FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
        BENCH: 6
      }
    };
  }

  private awardPlayer(team: SimTeam, player: ValuationResult, price: number) {
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
    
    this.availablePlayers = this.availablePlayers.filter(p => 
      p.playerId !== player.playerId
    );
  }

  async runDraft(): Promise<SimulationResult> {
    // Run the draft
    while (this.teams.some(t => t.roster.length < 16) && this.availablePlayers.length > 0) {
      const nominatingTeam = this.teams[this.nominationOrder % 12];
      const player = this.nominatePlayer(nominatingTeam);
      if (!player) break;
      
      const result = this.simulateAuction(player);
      if (result) {
        this.awardPlayer(result.winner, player, result.price);
      }
      
      this.nominationOrder++;
    }
    
    return this.analyzeResults();
  }

  private analyzeResults(): SimulationResult {
    const userTeam = this.teams.find(t => t.isUser)!;
    
    // Calculate metrics
    const posCounts: Record<string, number> = {};
    const posSpend: Record<string, number> = {};
    let totalPoints = 0;
    
    userTeam.roster.forEach(p => {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1;
      totalPoints += p.projectedPoints || 0;
      
      const pick = this.draftHistory.find(d => d.player.id === p.id);
      if (pick) {
        posSpend[p.position] = (posSpend[p.position] || 0) + pick.price;
      }
    });
    
    const rbSpend = posSpend.RB || 0;
    const rbSpendPercent = userTeam.spent > 0 ? (rbSpend / userTeam.spent * 100) : 0;
    
    // Check requirements
    const meetsRequirements = 
      (posCounts.QB || 0) >= 1 &&
      (posCounts.RB || 0) >= 2 &&
      (posCounts.WR || 0) >= 2 &&
      (posCounts.TE || 0) >= 1 &&
      (posCounts.DST || 0) >= 1 &&
      (posCounts.K || 0) >= 1;
    
    const budgetEfficient = userTeam.spent >= 190;
    const rbHeavy = rbSpendPercent >= 50;
    
    // Count elite RBs
    const eliteRBs = userTeam.roster.filter(p => 
      p.position === 'RB' && (p.tier === 'elite' || p.tier === 'tier1')
    );
    
    // Calculate league rank
    const teamPoints = this.teams.map(t => {
      let pts = 0;
      t.roster.forEach(p => pts += p.projectedPoints || 0);
      return { team: t, points: pts };
    });
    teamPoints.sort((a, b) => b.points - a.points);
    const leagueRank = teamPoints.findIndex(t => t.team.isUser) + 1;
    
    return {
      userTeam,
      allTeams: this.teams,
      draftHistory: this.draftHistory,
      analysis: {
        meetsRequirements,
        budgetEfficient,
        rbHeavy,
        eliteRBCount: eliteRBs.length,
        totalSpent: userTeam.spent,
        rbSpend,
        rbSpendPercent,
        projectedPoints: totalPoints,
        leagueRank,
        positionCounts: posCounts,
        positionSpend: posSpend
      }
    };
  }
}

export async function runSimulations(count: number = 3): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];
  
  for (let i = 0; i < count; i++) {
    console.log(`Running simulation ${i + 1}...`);
    const sim = new DraftSimulator();
    await sim.initialize();
    const result = await sim.runDraft();
    results.push(result);
  }
  
  return results;
}