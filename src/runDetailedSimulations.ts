/**
 * Detailed Simulation Runner - Shows Full 16-Player Rosters
 */

import { DraftSimulator } from './lib/draftSimulator';

async function runDetailedSimulations() {
  console.log('='.repeat(80));
  console.log('RUNNING 2 DETAILED DRAFT SIMULATIONS WITH FULL ROSTERS');
  console.log('='.repeat(80));
  console.log('\nStrategy: Robust RB (50-60% on RBs, 70-80% on top 3-4 players)');
  console.log('Targets: 5-6 RBs, 6-7 WRs, 2-3 elite RBs, $190+ spent\n');
  
  // Check if real data is available
  const hasRealData = (window as any).__playerValuations && (window as any).__playerValuations.length > 0;
  if (!hasRealData) {
    console.warn('⚠️ WARNING: Using mock data. For best results, wait for app data to load first.');
  } else {
    console.log(`✅ Using real player data: ${(window as any).__playerValuations.length} players loaded`);
  }
  
  for (let simNum = 1; simNum <= 2; simNum++) {
    console.log('\n' + '#'.repeat(80));
    console.log(`SIMULATION ${simNum}`);
    console.log('#'.repeat(80));
    
    const sim = new DraftSimulator();
    await sim.initialize();
    const result = await sim.runDraft();
    
    const userTeam = result.userTeam;
    const analysis = result.analysis;
    const posCounts = analysis.positionCounts;
    
    // Get all picks for this team sorted by price
    const teamPicks = result.draftHistory
      .filter(p => p.teamId === userTeam.id)
      .sort((a, b) => b.price - a.price);
    
    // Calculate top players spending
    const top4Spend = teamPicks.slice(0, 4).reduce((sum, p) => sum + p.price, 0);
    const top4Percent = analysis.totalSpent > 0 ? (top4Spend / analysis.totalSpent * 100) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('ROSTER SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\nBudget: $${analysis.totalSpent}/$200 (${(analysis.totalSpent/200*100).toFixed(0)}% spent)`);
    console.log(`Roster Size: ${userTeam.roster.length}/16 players`);
    console.log(`League Rank: #${analysis.leagueRank}/12`);
    console.log(`Projected Points: ${analysis.projectedPoints.toFixed(0)}`);
    
    console.log('\n📊 KEY METRICS:');
    console.log(`• RB Investment: $${analysis.rbSpend} (${analysis.rbSpendPercent.toFixed(1)}%) ${analysis.rbSpendPercent >= 50 && analysis.rbSpendPercent <= 60 ? '✅' : analysis.rbSpendPercent >= 45 && analysis.rbSpendPercent <= 65 ? '⚠️' : '❌'} [Target: 50-60%]`);
    console.log(`• Top 4 Players: $${top4Spend} (${top4Percent.toFixed(1)}%) ${top4Percent >= 70 ? '✅' : top4Percent >= 60 ? '⚠️' : '❌'} [Target: 70-80%]`);
    console.log(`• Elite/Tier1 RBs: ${analysis.eliteRBCount} ${analysis.eliteRBCount >= 2 ? '✅' : analysis.eliteRBCount === 1 ? '⚠️' : '❌'} [Target: 2-3]`);
    
    console.log('\n📈 POSITION BREAKDOWN:');
    console.log(`• QB:  ${(posCounts.QB || 0).toString().padStart(2)} players | $${(analysis.positionSpend.QB || 0).toString().padStart(3)}`);
    console.log(`• RB:  ${(posCounts.RB || 0).toString().padStart(2)} players | $${(analysis.positionSpend.RB || 0).toString().padStart(3)} ${(posCounts.RB || 0) >= 5 && (posCounts.RB || 0) <= 6 ? '✅' : '⚠️'} [Target: 5-6]`);
    console.log(`• WR:  ${(posCounts.WR || 0).toString().padStart(2)} players | $${(analysis.positionSpend.WR || 0).toString().padStart(3)} ${(posCounts.WR || 0) >= 6 && (posCounts.WR || 0) <= 7 ? '✅' : '⚠️'} [Target: 6-7]`);
    console.log(`• TE:  ${(posCounts.TE || 0).toString().padStart(2)} players | $${(analysis.positionSpend.TE || 0).toString().padStart(3)}`);
    console.log(`• DST: ${(posCounts.DST || 0).toString().padStart(2)} players | $${(analysis.positionSpend.DST || 0).toString().padStart(3)}`);
    console.log(`• K:   ${(posCounts.K || 0).toString().padStart(2)} players | $${(analysis.positionSpend.K || 0).toString().padStart(3)}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('COMPLETE 16-PLAYER ROSTER (sorted by price)');
    console.log('='.repeat(60));
    console.log('\n#  | Player Name                  | Pos | Tier       | Price | Pts  ');
    console.log('-'.repeat(70));
    
    teamPicks.forEach((pick, idx) => {
      const player = pick.player;
      const num = (idx + 1).toString().padStart(2);
      const name = player.name.substring(0, 28).padEnd(28);
      const pos = player.position.padEnd(3);
      const tier = (player.tier || 'unknown').substring(0, 10).padEnd(10);
      const price = ('$' + pick.price).padStart(5);
      const pts = player.projectedPoints.toFixed(0).padStart(4);
      
      // Highlight elite RBs
      const isEliteRB = player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1');
      const marker = isEliteRB ? '⭐' : '  ';
      
      console.log(`${num} ${marker}| ${name} | ${pos} | ${tier} | ${price} | ${pts}`);
    });
    
    // Group by position for clarity
    console.log('\n' + '='.repeat(60));
    console.log('ROSTER BY POSITION');
    console.log('='.repeat(60));
    
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    positions.forEach(pos => {
      const players = teamPicks.filter(p => p.player.position === pos);
      if (players.length > 0) {
        console.log(`\n${pos} (${players.length}):`);
        players.forEach(pick => {
          const tier = pick.player.tier === 'elite' ? '⭐ELITE' : 
                       pick.player.tier === 'tier1' ? '🔥TIER1' : 
                       pick.player.tier === 'tier2' ? 'TIER2' : 
                       pick.player.tier === 'tier3' ? 'TIER3' : 
                       pick.player.tier || 'unknown';
          console.log(`  • ${pick.player.name.padEnd(28)} - $${pick.price.toString().padStart(3)} - ${tier}`);
        });
      }
    });
    
    // Starting lineup suggestion
    console.log('\n' + '='.repeat(60));
    console.log('SUGGESTED STARTING LINEUP');
    console.log('='.repeat(60));
    
    const qbs = teamPicks.filter(p => p.player.position === 'QB').slice(0, 1);
    const rbs = teamPicks.filter(p => p.player.position === 'RB').slice(0, 2);
    const wrs = teamPicks.filter(p => p.player.position === 'WR').slice(0, 2);
    const tes = teamPicks.filter(p => p.player.position === 'TE').slice(0, 1);
    const flexCandidates = teamPicks.filter(p => 
      ['RB', 'WR', 'TE'].includes(p.player.position) &&
      !rbs.includes(p) && !wrs.includes(p) && !tes.includes(p)
    ).slice(0, 1);
    const dsts = teamPicks.filter(p => p.player.position === 'DST').slice(0, 1);
    const ks = teamPicks.filter(p => p.player.position === 'K').slice(0, 1);
    
    console.log('\nQB:  ' + (qbs[0] ? `${qbs[0].player.name} ($${qbs[0].price})` : 'MISSING'));
    console.log('RB1: ' + (rbs[0] ? `${rbs[0].player.name} ($${rbs[0].price})` : 'MISSING'));
    console.log('RB2: ' + (rbs[1] ? `${rbs[1].player.name} ($${rbs[1].price})` : 'MISSING'));
    console.log('WR1: ' + (wrs[0] ? `${wrs[0].player.name} ($${wrs[0].price})` : 'MISSING'));
    console.log('WR2: ' + (wrs[1] ? `${wrs[1].player.name} ($${wrs[1].price})` : 'MISSING'));
    console.log('TE:  ' + (tes[0] ? `${tes[0].player.name} ($${tes[0].price})` : 'MISSING'));
    console.log('FLX: ' + (flexCandidates[0] ? `${flexCandidates[0].player.name} (${flexCandidates[0].player.position}) ($${flexCandidates[0].price})` : 'MISSING'));
    console.log('DST: ' + (dsts[0] ? `${dsts[0].player.name} ($${dsts[0].price})` : 'MISSING'));
    console.log('K:   ' + (ks[0] ? `${ks[0].player.name} ($${ks[0].price})` : 'MISSING'));
    
    const startingPoints = [...qbs, ...rbs, ...wrs, ...tes, ...flexCandidates, ...dsts, ...ks]
      .reduce((sum, p) => sum + (p?.player.projectedPoints || 0), 0);
    console.log(`\nProjected Starting Lineup Points: ${startingPoints.toFixed(0)}`);
    
    // Check requirements
    const meetsReqs = 
      (posCounts.QB || 0) >= 1 &&
      (posCounts.RB || 0) >= 2 &&
      (posCounts.WR || 0) >= 2 &&
      (posCounts.TE || 0) >= 1 &&
      (posCounts.DST || 0) >= 1 &&
      (posCounts.K || 0) >= 1;
    
    console.log('\n' + '='.repeat(60));
    console.log('FINAL ASSESSMENT');
    console.log('='.repeat(60));
    console.log(`\n✓ Meets minimum position requirements: ${meetsReqs ? '✅ YES' : '❌ NO'}`);
    console.log(`✓ Budget efficiency (>95% spent): ${analysis.totalSpent >= 190 ? '✅ YES' : '❌ NO'}`);
    console.log(`✓ RB-heavy strategy (50-60% on RBs): ${analysis.rbSpendPercent >= 50 && analysis.rbSpendPercent <= 60 ? '✅ YES' : analysis.rbSpendPercent >= 45 && analysis.rbSpendPercent <= 65 ? '⚠️ CLOSE' : '❌ NO'}`);
    console.log(`✓ Elite talent acquired (2+ elite RBs): ${analysis.eliteRBCount >= 2 ? '✅ YES' : '❌ NO'}`);
    console.log(`✓ Proper depth (5-6 RBs, 6-7 WRs): ${(posCounts.RB >= 5 && posCounts.RB <= 6 && posCounts.WR >= 6 && posCounts.WR <= 7) ? '✅ YES' : '⚠️ PARTIAL'}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(80));
}

// Export and make available
export { runDetailedSimulations };

if (typeof window !== 'undefined') {
  (window as any).runDetailedSimulations = runDetailedSimulations;
}

// Note: removed require.main check as it's not compatible with ES modules