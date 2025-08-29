/**
 * Roster Quality Test - Shows detailed rosters from simulations
 */

import { bidAdvisorService } from '../src/lib/bidAdvisorService.js';
import type { ValuationResult } from '../src/lib/calibratedValuationService.js';
import type { Player } from '../src/types.js';

// Create realistic player pool
function createPlayerPool(): ValuationResult[] {
  const players: ValuationResult[] = [];
  
  // Elite RBs (5)
  const eliteRBs = [
    { name: 'Christian McCaffrey', value: 75, tier: 'elite' },
    { name: 'Breece Hall', value: 70, tier: 'elite' },
    { name: 'Bijan Robinson', value: 68, tier: 'elite' },
    { name: 'Jonathan Taylor', value: 65, tier: 'elite' },
    { name: 'Saquon Barkley', value: 62, tier: 'elite' }
  ];
  
  // Tier 1 RBs (8)
  const tier1RBs = [
    { name: 'Jahmyr Gibbs', value: 48, tier: 'tier1' },
    { name: 'Travis Etienne', value: 45, tier: 'tier1' },
    { name: 'Josh Jacobs', value: 42, tier: 'tier1' },
    { name: 'Tony Pollard', value: 40, tier: 'tier1' },
    { name: 'Joe Mixon', value: 38, tier: 'tier1' },
    { name: 'Derrick Henry', value: 36, tier: 'tier1' },
    { name: 'Kenneth Walker', value: 34, tier: 'tier1' },
    { name: 'Rachaad White', value: 32, tier: 'tier1' }
  ];
  
  // Elite WRs (5)
  const eliteWRs = [
    { name: 'Justin Jefferson', value: 65, tier: 'elite' },
    { name: 'JaMarr Chase', value: 62, tier: 'elite' },
    { name: 'Tyreek Hill', value: 60, tier: 'elite' },
    { name: 'CeeDee Lamb', value: 58, tier: 'elite' },
    { name: 'Amon-Ra St. Brown', value: 55, tier: 'elite' }
  ];
  
  // Tier 1 WRs (10)
  const tier1WRs = [
    { name: 'Davante Adams', value: 42, tier: 'tier1' },
    { name: 'Stefon Diggs', value: 40, tier: 'tier1' },
    { name: 'AJ Brown', value: 38, tier: 'tier1' },
    { name: 'Garrett Wilson', value: 35, tier: 'tier1' },
    { name: 'Chris Olave', value: 33, tier: 'tier1' },
    { name: 'DK Metcalf', value: 31, tier: 'tier1' },
    { name: 'Mike Evans', value: 30, tier: 'tier1' },
    { name: 'Calvin Ridley', value: 28, tier: 'tier1' },
    { name: 'Jaylen Waddle', value: 26, tier: 'tier1' },
    { name: 'DeVonta Smith', value: 24, tier: 'tier1' }
  ];
  
  // QBs
  const qbs = [
    { name: 'Josh Allen', value: 32, tier: 'elite' },
    { name: 'Patrick Mahomes', value: 30, tier: 'elite' },
    { name: 'Jalen Hurts', value: 28, tier: 'tier1' },
    { name: 'Lamar Jackson', value: 25, tier: 'tier1' },
    { name: 'Joe Burrow', value: 20, tier: 'tier1' },
    { name: 'Dak Prescott', value: 15, tier: 'tier2' },
    { name: 'Justin Herbert', value: 12, tier: 'tier2' },
    { name: 'Trevor Lawrence', value: 10, tier: 'tier2' }
  ];
  
  // TEs
  const tes = [
    { name: 'Travis Kelce', value: 35, tier: 'elite' },
    { name: 'Mark Andrews', value: 22, tier: 'tier1' },
    { name: 'TJ Hockenson', value: 18, tier: 'tier1' },
    { name: 'Darren Waller', value: 15, tier: 'tier2' },
    { name: 'Kyle Pitts', value: 12, tier: 'tier2' },
    { name: 'Dallas Goedert', value: 10, tier: 'tier2' },
    { name: 'George Kittle', value: 14, tier: 'tier2' },
    { name: 'Pat Freiermuth', value: 8, tier: 'tier3' }
  ];
  
  // Tier 2/3 RBs (many)
  const tier2RBs = [
    { name: 'Najee Harris', value: 25, tier: 'tier2' },
    { name: 'Aaron Jones', value: 23, tier: 'tier2' },
    { name: 'Cam Akers', value: 20, tier: 'tier2' },
    { name: 'Miles Sanders', value: 18, tier: 'tier2' },
    { name: 'James Conner', value: 16, tier: 'tier2' },
    { name: 'Dameon Pierce', value: 14, tier: 'tier2' },
    { name: 'Alexander Mattison', value: 12, tier: 'tier3' },
    { name: 'Zack Moss', value: 10, tier: 'tier3' },
    { name: 'Samaje Perine', value: 8, tier: 'tier3' },
    { name: 'Khalil Herbert', value: 6, tier: 'tier3' }
  ];
  
  // Tier 2/3 WRs (many)
  const tier2WRs = [
    { name: 'DJ Moore', value: 22, tier: 'tier2' },
    { name: 'Terry McLaurin', value: 20, tier: 'tier2' },
    { name: 'Keenan Allen', value: 18, tier: 'tier2' },
    { name: 'Amari Cooper', value: 16, tier: 'tier2' },
    { name: 'Christian Watson', value: 14, tier: 'tier2' },
    { name: 'Jerry Jeudy', value: 12, tier: 'tier2' },
    { name: 'Michael Pittman', value: 15, tier: 'tier2' },
    { name: 'Tyler Lockett', value: 10, tier: 'tier3' },
    { name: 'Marquise Brown', value: 8, tier: 'tier3' },
    { name: 'Brandin Cooks', value: 7, tier: 'tier3' },
    { name: 'Jahan Dotson', value: 5, tier: 'tier3' },
    { name: 'Elijah Moore', value: 4, tier: 'tier3' }
  ];
  
  // DSTs and Kickers
  const dsts = [
    { name: 'Bills DST', value: 5, tier: 'tier1' },
    { name: '49ers DST', value: 4, tier: 'tier1' },
    { name: 'Cowboys DST', value: 3, tier: 'tier2' },
    { name: 'Eagles DST', value: 2, tier: 'tier2' },
    { name: 'Pats DST', value: 1, tier: 'tier3' }
  ];
  
  const kickers = [
    { name: 'Justin Tucker', value: 3, tier: 'tier1' },
    { name: 'Daniel Carlson', value: 2, tier: 'tier2' },
    { name: 'Tyler Bass', value: 1, tier: 'tier2' },
    { name: 'Jake Elliott', value: 1, tier: 'tier3' }
  ];
  
  // Combine all players
  const allGroups = [
    ...eliteRBs.map(p => ({ ...p, position: 'RB' })),
    ...tier1RBs.map(p => ({ ...p, position: 'RB' })),
    ...tier2RBs.map(p => ({ ...p, position: 'RB' })),
    ...eliteWRs.map(p => ({ ...p, position: 'WR' })),
    ...tier1WRs.map(p => ({ ...p, position: 'WR' })),
    ...tier2WRs.map(p => ({ ...p, position: 'WR' })),
    ...qbs.map(p => ({ ...p, position: 'QB' })),
    ...tes.map(p => ({ ...p, position: 'TE' })),
    ...dsts.map(p => ({ ...p, position: 'DST' })),
    ...kickers.map(p => ({ ...p, position: 'K' }))
  ];
  
  return allGroups.map((p, idx) => ({
    playerId: `player_${idx}`,
    playerName: p.name,
    position: p.position,
    team: 'TEAM',
    tier: p.tier as any,
    rank: idx + 1,
    value: p.value,
    auctionValue: p.value,
    marketValue: p.value - 2,
    intrinsicValue: p.value,
    edge: 2,
    projectedPoints: 200 - idx * 2,
    vorp: 100 - idx,
    adp: idx + 1,
    confidence: 8,
    vbd: 100 - idx
  }));
}

interface Team {
  id: string;
  name: string;
  budget: number;
  roster: Player[];
  strategy: string;
}

class DraftSimulator {
  private players: ValuationResult[] = [];
  private availablePlayers: ValuationResult[] = [];
  private teams: Team[] = [];
  private draftHistory: any[] = [];
  private pickCount = 0;

  constructor() {
    // Create 12 teams with different strategies
    const strategies = [
      'robust-rb',  // User team
      'balanced', 'stars', 'zero-rb', 'balanced', 'hero-rb',
      'balanced', 'stars', 'balanced', 'zero-rb', 'balanced', 'balanced'
    ];
    
    this.teams = strategies.map((strat, i) => ({
      id: `team_${i}`,
      name: i === 0 ? 'USER TEAM' : `Team ${i + 1}`,
      budget: 200,
      roster: [],
      strategy: strat
    }));
  }

  async runDraft(simNumber: number) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`SIMULATION ${simNumber}`);
    console.log('='.repeat(70));
    
    this.players = createPlayerPool();
    this.availablePlayers = [...this.players];
    this.pickCount = 0;
    
    // Reset teams
    this.teams.forEach(team => {
      team.budget = 200;
      team.roster = [];
    });
    this.draftHistory = [];
    
    // Run draft - nominate players randomly
    while (this.pickCount < 192 && this.availablePlayers.length > 0) {
      // Get random player from top available
      const topPlayers = this.availablePlayers.slice(0, Math.min(30, this.availablePlayers.length));
      const randomIdx = Math.floor(Math.random() * topPlayers.length);
      const nominatedPlayer = topPlayers[randomIdx];
      
      if (!nominatedPlayer) break;
      
      // Run auction for this player
      const winner = this.runAuction(nominatedPlayer);
      if (winner) {
        this.pickCount++;
      }
      
      // Check if teams are getting full
      const avgRosterSize = this.teams.reduce((sum, t) => sum + t.roster.length, 0) / this.teams.length;
      if (avgRosterSize >= 15) break;
    }
    
    // Show results
    this.showResults();
  }

  private runAuction(player: ValuationResult): Team | null {
    let highBid = 0;
    let winner: Team | null = null;
    
    for (const team of this.teams) {
      const slotsLeft = 16 - team.roster.length;
      const maxAfford = team.budget - slotsLeft + 1;
      
      if (maxAfford <= 0) continue;
      
      let teamBid = 0;
      
      if (team.name === 'USER TEAM') {
        // Use our recommendation system
        const context = this.buildContext(team);
        const rec = bidAdvisorService.getRecommendation(player, context, player.value || 1);
        
        if (rec.action === 'strong-buy' || rec.action === 'consider') {
          teamBid = Math.min(rec.maxBid, maxAfford);
        }
      } else {
        // Simple AI logic
        const baseValue = player.value || 1;
        
        // Strategy-based bidding
        if (team.strategy === 'stars' && player.tier === 'elite') {
          teamBid = baseValue * 1.2;
        } else if (team.strategy === 'zero-rb' && player.position === 'RB') {
          teamBid = baseValue * 0.6;
        } else if (team.strategy === 'hero-rb' && player.position === 'RB') {
          const hasEliteRB = team.roster.some(p => p.position === 'RB' && p.tier === 'elite');
          teamBid = hasEliteRB ? baseValue * 0.5 : baseValue * 1.1;
        } else {
          teamBid = baseValue * (0.85 + Math.random() * 0.25);
        }
        
        teamBid = Math.min(teamBid, maxAfford);
      }
      
      if (teamBid > highBid) {
        highBid = teamBid;
        winner = team;
      }
    }
    
    if (winner && highBid > 0) {
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
        team: winner.name
      });
      
      // Remove from available
      this.availablePlayers = this.availablePlayers.filter(p => p.playerId !== player.playerId);
      
      return winner;
    }
    
    return null;
  }

  private buildContext(team: Team) {
    return {
      myTeam: {
        id: team.id,
        name: team.name,
        budget: team.budget,
        players: team.roster,
        isUser: true,
        maxBid: team.budget,
        nominations: 0
      },
      allTeams: this.teams.map(t => ({
        id: t.id,
        name: t.name,
        budget: t.budget,
        players: t.roster,
        isUser: t.name === 'USER TEAM',
        maxBid: t.budget,
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

  private showResults() {
    const userTeam = this.teams[0];
    const spent = 200 - userTeam.budget;
    
    console.log('\n' + '─'.repeat(70));
    console.log('USER TEAM ROSTER (Robust RB Strategy)');
    console.log('─'.repeat(70));
    console.log(`Budget Used: $${spent}/200 (${(spent/200*100).toFixed(0)}%)`);
    console.log(`Players Drafted: ${userTeam.roster.length}/16\n`);
    
    // Group by position
    const positions = ['RB', 'WR', 'QB', 'TE', 'DST', 'K'];
    let totalProjected = 0;
    let rbSpend = 0;
    
    positions.forEach(pos => {
      const players = userTeam.roster.filter(p => p.position === pos);
      if (players.length > 0) {
        console.log(`${pos}s (${players.length}):`);
        players.forEach(p => {
          const pick = this.draftHistory.find(h => h.player.id === p.id);
          const price = pick?.price || 0;
          totalProjected += p.projectedPoints || 0;
          if (pos === 'RB') rbSpend += price;
          console.log(`  ${p.name.padEnd(25)} $${price.toString().padStart(3)} (${p.tier})`);
        });
        console.log('');
      }
    });
    
    // Analysis
    console.log('─'.repeat(70));
    console.log('ROSTER ANALYSIS:');
    console.log('─'.repeat(70));
    
    const posCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = {};
    
    userTeam.roster.forEach(p => {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1;
      tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
    });
    
    // Position requirements check
    const meetsReqs = 
      (posCounts.QB || 0) >= 1 &&
      (posCounts.RB || 0) >= 2 &&
      (posCounts.WR || 0) >= 2 &&
      (posCounts.TE || 0) >= 1 &&
      (posCounts.DST || 0) >= 1 &&
      (posCounts.K || 0) >= 1;
    
    console.log(`Position Requirements Met: ${meetsReqs ? '✅ YES' : '❌ NO'}`);
    console.log(`  QB: ${posCounts.QB || 0}/1+ | RB: ${posCounts.RB || 0}/2+ | WR: ${posCounts.WR || 0}/2+`);
    console.log(`  TE: ${posCounts.TE || 0}/1+ | DST: ${posCounts.DST || 0}/1 | K: ${posCounts.K || 0}/1\n`);
    
    console.log(`Tier Distribution:`);
    console.log(`  Elite: ${tierCounts.elite || 0} | Tier1: ${tierCounts.tier1 || 0} | Tier2: ${tierCounts.tier2 || 0} | Tier3: ${tierCounts.tier3 || 0}\n`);
    
    console.log(`RB Investment: $${rbSpend}/${spent} (${spent > 0 ? (rbSpend/spent*100).toFixed(0) : 0}%)`);
    console.log(`  Target: 50-65% for Robust RB strategy`);
    console.log(`  ${rbSpend/spent >= 0.5 ? '✅ Strategy goal achieved' : '❌ Below target'}\n`);
    
    console.log(`Projected Points: ${totalProjected.toFixed(0)}`);
    console.log(`Budget Efficiency: ${spent >= 190 ? '✅' : '❌'} (${((spent/200)*100).toFixed(0)}% used)`);
    console.log(`Roster Complete: ${userTeam.roster.length === 16 ? '✅' : '❌'} (${userTeam.roster.length}/16 players)`);
    
    // Elite RB check
    const eliteRBs = userTeam.roster.filter(p => p.position === 'RB' && p.tier === 'elite');
    console.log(`Elite RBs Acquired: ${eliteRBs.length} ${eliteRBs.length > 0 ? '✅' : '⚠️'}`);
    if (eliteRBs.length > 0) {
      eliteRBs.forEach(rb => {
        const pick = this.draftHistory.find(h => h.player.id === rb.id);
        console.log(`  - ${rb.name} for $${pick?.price || 0}`);
      });
    }
  }
}

// Run simulations
async function main() {
  const simulator = new DraftSimulator();
  
  for (let i = 1; i <= 1; i++) {
    await simulator.runDraft(i);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);