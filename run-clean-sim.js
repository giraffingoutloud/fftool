// Clean simulation runner - only show results
import { DraftSimulator } from './src/lib/draftSimulator.ts';

// Silence console logs temporarily
const originalLog = console.log;
const originalWarn = console.warn;
console.log = () => {};
console.warn = () => {};

async function runCleanSimulation() {
  const sim = new DraftSimulator();
  await sim.initialize();
  const result = await sim.runDraft();
  
  // Restore console
  console.log = originalLog;
  console.warn = originalWarn;
  
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
  
  console.log('================================================================================');
  console.log('DRAFT SIMULATION RESULTS - MOCK DATA');
  console.log('================================================================================');
  console.log('');
  console.log(`Budget Spent: $${analysis.totalSpent}/$200 (${(analysis.totalSpent/200*100).toFixed(0)}%)`);
  console.log(`Roster Size: ${userTeam.roster.length}/16 players`);
  console.log('');
  console.log('📊 KEY METRICS vs STRATEGY GUIDELINES:');
  console.log('----------------------------------------');
  console.log(`✓ Budget efficiency (>95% spent): ${analysis.totalSpent >= 190 ? '✅ YES' : '❌ NO'} ($${analysis.totalSpent})`);
  console.log(`✓ RB-heavy strategy (50-60% on RBs): ${analysis.rbSpendPercent >= 50 && analysis.rbSpendPercent <= 60 ? '✅ YES' : analysis.rbSpendPercent >= 45 && analysis.rbSpendPercent <= 65 ? '⚠️ CLOSE' : '❌ NO'} (${analysis.rbSpendPercent.toFixed(1)}%)`);
  console.log(`✓ Elite talent acquired (2+ elite RBs): ${analysis.eliteRBCount >= 2 ? '✅ YES' : '❌ NO'} (${analysis.eliteRBCount} elite RBs)`);
  console.log(`✓ Top 4 players (70-80% budget): ${top4Percent >= 70 ? '✅ YES' : top4Percent >= 60 ? '⚠️ CLOSE' : '❌ NO'} (${top4Percent.toFixed(1)}%)`);
  console.log(`✓ Proper depth (5-6 RBs, 6-7 WRs): ${(posCounts.RB >= 5 && posCounts.RB <= 6 && posCounts.WR >= 6 && posCounts.WR <= 7) ? '✅ YES' : '⚠️ PARTIAL'}`);
  console.log('');
  console.log('📈 POSITION COUNTS:');
  console.log('--------------------');
  console.log(`• QB:  ${(posCounts.QB || 0)} players`);
  console.log(`• RB:  ${(posCounts.RB || 0)} players ${(posCounts.RB || 0) >= 5 && (posCounts.RB || 0) <= 6 ? '✅' : '⚠️'} [Target: 5-6]`);
  console.log(`• WR:  ${(posCounts.WR || 0)} players ${(posCounts.WR || 0) >= 6 && (posCounts.WR || 0) <= 7 ? '✅' : '⚠️'} [Target: 6-7]`);
  console.log(`• TE:  ${(posCounts.TE || 0)} players`);
  console.log(`• DST: ${(posCounts.DST || 0)} players`);
  console.log(`• K:   ${(posCounts.K || 0)} players`);
  console.log('');
  console.log('💰 SPENDING BY POSITION:');
  console.log('-------------------------');
  console.log(`• QB:  $${(analysis.positionSpend.QB || 0)}`);
  console.log(`• RB:  $${(analysis.positionSpend.RB || 0)} (${analysis.rbSpendPercent.toFixed(1)}%)`);
  console.log(`• WR:  $${(analysis.positionSpend.WR || 0)}`);
  console.log(`• TE:  $${(analysis.positionSpend.TE || 0)}`);
  console.log(`• DST: $${(analysis.positionSpend.DST || 0)}`);
  console.log(`• K:   $${(analysis.positionSpend.K || 0)}`);
  console.log('');
  console.log('🏆 TOP 10 PLAYERS ACQUIRED:');
  console.log('----------------------------');
  teamPicks.slice(0, 10).forEach((pick, idx) => {
    const player = pick.player;
    const isEliteRB = player.position === 'RB' && (player.tier === 'elite' || player.tier === 'tier1');
    const marker = isEliteRB ? '⭐' : '  ';
    console.log(`${(idx + 1).toString().padStart(2)} ${marker} ${player.name.padEnd(25)} ${player.position.padEnd(3)} $${pick.price.toString().padStart(3)}`);
  });
  console.log('');
  console.log('================================================================================');
  console.log('OVERALL ASSESSMENT:');
  const passCount = [
    analysis.totalSpent >= 190,
    analysis.rbSpendPercent >= 50 && analysis.rbSpendPercent <= 60,
    analysis.eliteRBCount >= 2,
    top4Percent >= 70,
    (posCounts.RB >= 5 && posCounts.RB <= 6 && posCounts.WR >= 6 && posCounts.WR <= 7)
  ].filter(x => x).length;
  
  if (passCount === 5) {
    console.log('✅ EXCELLENT - All 5 strategy guidelines met!');
  } else if (passCount >= 3) {
    console.log(`⚠️ GOOD - ${passCount}/5 strategy guidelines met`);
  } else {
    console.log(`❌ NEEDS IMPROVEMENT - Only ${passCount}/5 strategy guidelines met`);
  }
  console.log('================================================================================');
}

// Run 2 simulations
async function runMultiple() {
  for (let i = 1; i <= 2; i++) {
    console.log(`\n\nSIMULATION ${i}:`);
    await runCleanSimulation();
  }
}

runMultiple().catch(console.error);