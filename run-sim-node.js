// Node.js script to run simulation with mock data
import { DraftSimulator } from './src/lib/draftSimulator.ts';

async function runSimulation() {
  console.log('='.repeat(80));
  console.log('RUNNING SIMULATION WITH IMPROVED MOCK DATA');
  console.log('='.repeat(80));
  console.log('');
  
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
  
  console.log('='.repeat(60));
  console.log('SIMULATION RESULTS');
  console.log('='.repeat(60));
  console.log('');
  
  console.log(`Budget: $${analysis.totalSpent}/$200 (${(analysis.totalSpent/200*100).toFixed(0)}% spent)`);
  console.log(`Roster Size: ${userTeam.roster.length}/16 players`);
  console.log(`League Rank: #${analysis.leagueRank}/12`);
  console.log(`Projected Points: ${analysis.projectedPoints.toFixed(0)}`);
  console.log('');
  
  console.log('📊 KEY METRICS:');
  console.log(`• RB Investment: $${analysis.rbSpend} (${analysis.rbSpendPercent.toFixed(1)}%) ${analysis.rbSpendPercent >= 50 && analysis.rbSpendPercent <= 60 ? '✅' : analysis.rbSpendPercent >= 45 && analysis.rbSpendPercent <= 65 ? '⚠️' : '❌'} [Target: 50-60%]`);
  console.log(`• Top 4 Players: $${top4Spend} (${top4Percent.toFixed(1)}%) ${top4Percent >= 70 ? '✅' : top4Percent >= 60 ? '⚠️' : '❌'} [Target: 70-80%]`);
  console.log(`• Elite/Tier1 RBs: ${analysis.eliteRBCount} ${analysis.eliteRBCount >= 2 ? '✅' : analysis.eliteRBCount === 1 ? '⚠️' : '❌'} [Target: 2-3]`);
  console.log('');
  
  console.log('📈 POSITION BREAKDOWN:');
  console.log(`• QB:  ${(posCounts.QB || 0).toString().padStart(2)} players | $${(analysis.positionSpend.QB || 0).toString().padStart(3)}`);
  console.log(`• RB:  ${(posCounts.RB || 0).toString().padStart(2)} players | $${(analysis.positionSpend.RB || 0).toString().padStart(3)} ${(posCounts.RB || 0) >= 5 && (posCounts.RB || 0) <= 6 ? '✅' : '⚠️'} [Target: 5-6]`);
  console.log(`• WR:  ${(posCounts.WR || 0).toString().padStart(2)} players | $${(analysis.positionSpend.WR || 0).toString().padStart(3)} ${(posCounts.WR || 0) >= 6 && (posCounts.WR || 0) <= 7 ? '✅' : '⚠️'} [Target: 6-7]`);
  console.log(`• TE:  ${(posCounts.TE || 0).toString().padStart(2)} players | $${(analysis.positionSpend.TE || 0).toString().padStart(3)}`);
  console.log(`• DST: ${(posCounts.DST || 0).toString().padStart(2)} players | $${(analysis.positionSpend.DST || 0).toString().padStart(3)}`);
  console.log(`• K:   ${(posCounts.K || 0).toString().padStart(2)} players | $${(analysis.positionSpend.K || 0).toString().padStart(3)}`);
  console.log('');
  
  console.log('='.repeat(60));
  console.log('COMPLETE ROSTER (sorted by price)');
  console.log('='.repeat(60));
  console.log('');
  
  teamPicks.forEach((pick, idx) => {
    const player = pick.player;
    const isEliteRB = player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1');
    const marker = isEliteRB ? '⭐' : '  ';
    console.log(`${(idx + 1).toString().padStart(2)} ${marker} ${player.name.padEnd(28)} ${player.position.padEnd(3)} $${pick.price.toString().padStart(3)}`);
  });
  
  console.log('');
  console.log('='.repeat(60));
  console.log('FINAL ASSESSMENT');
  console.log('='.repeat(60));
  console.log(`✓ Budget efficiency (>95% spent): ${analysis.totalSpent >= 190 ? '✅ YES' : '❌ NO'}`);
  console.log(`✓ RB-heavy strategy (50-60% on RBs): ${analysis.rbSpendPercent >= 50 && analysis.rbSpendPercent <= 60 ? '✅ YES' : analysis.rbSpendPercent >= 45 && analysis.rbSpendPercent <= 65 ? '⚠️ CLOSE' : '❌ NO'}`);
  console.log(`✓ Elite talent acquired (2+ elite RBs): ${analysis.eliteRBCount >= 2 ? '✅ YES' : '❌ NO'}`);
  console.log(`✓ Proper depth (5-6 RBs, 6-7 WRs): ${(posCounts.RB >= 5 && posCounts.RB <= 6 && posCounts.WR >= 6 && posCounts.WR <= 7) ? '✅ YES' : '⚠️ PARTIAL'}`);
  
  console.log('');
  console.log('='.repeat(80));
  console.log('SIMULATION COMPLETE');
  console.log('='.repeat(80));
}

// Run the simulation
runSimulation().catch(console.error);