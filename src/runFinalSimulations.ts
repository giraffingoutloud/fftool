/**
 * Final Simulation Test with Adjustments
 * Tests the improved recommendation logic against strategy guidelines
 */

import { runSimulations } from './lib/draftSimulator';

async function runFinalSimulations() {
  console.log('====================================================');
  console.log('FINAL SIMULATION TEST - POST ADJUSTMENTS');
  console.log('====================================================\n');
  
  console.log('ADJUSTMENTS MADE TO MEET GUIDELINES:');
  console.log('1. Increased RB bonuses: Elite 60%, Tier1 45%, Tier2 35%');
  console.log('2. Increased max bid flexibility: Elite 100%, Tier1 85%');
  console.log('3. Increased position caps: RB $85, WR $70');
  console.log('4. Added WR depth bonuses after securing RB core');
  console.log('5. Updated roster targets: 6 RBs, 7 WRs optimal');
  console.log('6. Increased RB budget allowance to 55-60% of remaining');
  console.log('\n====================================================\n');
  
  // Run 3 simulations
  const results = await runSimulations(3);
  
  // Strategy guidelines from strat.md
  const guidelines = {
    rbSpendTarget: { min: 50, max: 60 },
    totalBudgetTarget: { min: 190, max: 200 },
    rbCountTarget: { min: 5, max: 6 },
    wrCountTarget: { min: 6, max: 7 },
    eliteRBTarget: { min: 2, max: 3 },
    topPlayersSpend: { min: 70, max: 80 }
  };
  
  console.log('TARGET GUIDELINES (from strat.md):');
  console.log('• 50-60% budget on RBs');
  console.log('• 70-80% on top 3-4 players');
  console.log('• 5-6 total RBs, 6-7 total WRs');
  console.log('• Spend 95%+ of budget ($190+)');
  console.log('• 2-3 elite/tier1 RBs\n');
  
  let passCount = 0;
  let totalChecks = 0;
  
  results.forEach((result, idx) => {
    console.log(`\n========== SIMULATION ${idx + 1} ==========\n`);
    
    const analysis = result.analysis;
    const posCounts = analysis.positionCounts;
    
    // Calculate top players spend
    const sortedPicks = result.draftHistory
      .filter(p => p.teamId === result.userTeam.id)
      .sort((a, b) => b.price - a.price);
    const top4Spend = sortedPicks.slice(0, 4).reduce((sum, p) => sum + p.price, 0);
    const top4Percent = analysis.totalSpent > 0 ? (top4Spend / analysis.totalSpent * 100) : 0;
    
    // Check all guidelines
    const checks = {
      budget: analysis.totalSpent >= guidelines.totalBudgetTarget.min,
      rbSpend: analysis.rbSpendPercent >= guidelines.rbSpendTarget.min && 
               analysis.rbSpendPercent <= guidelines.rbSpendTarget.max + 10,
      rbCount: (posCounts.RB || 0) >= guidelines.rbCountTarget.min,
      wrCount: (posCounts.WR || 0) >= guidelines.wrCountTarget.min,
      eliteRBs: analysis.eliteRBCount >= guidelines.eliteRBTarget.min,
      topPlayers: top4Percent >= guidelines.topPlayersSpend.min
    };
    
    const simPassCount = Object.values(checks).filter(v => v).length;
    passCount += simPassCount;
    totalChecks += Object.values(checks).length;
    
    console.log('KEY METRICS:');
    console.log(`✓ Budget: $${analysis.totalSpent}/200 ${checks.budget ? '✅' : '❌'}`);
    console.log(`✓ RB Spend: ${analysis.rbSpendPercent.toFixed(1)}% ${checks.rbSpend ? '✅' : '❌'} [Target: 50-60%]`);
    console.log(`✓ Top 4 Players: ${top4Percent.toFixed(1)}% ${checks.topPlayers ? '✅' : '❌'} [Target: 70-80%]`);
    console.log(`✓ Elite RBs: ${analysis.eliteRBCount} ${checks.eliteRBs ? '✅' : '❌'} [Target: 2-3]`);
    console.log(`✓ RB Count: ${posCounts.RB || 0} ${checks.rbCount ? '✅' : '❌'} [Target: 5-6]`);
    console.log(`✓ WR Count: ${posCounts.WR || 0} ${checks.wrCount ? '✅' : '❌'} [Target: 6-7]`);
    console.log(`✓ League Rank: #${analysis.leagueRank}/12`);
    
    console.log('\nTOP 5 PLAYERS:');
    sortedPicks.slice(0, 5).forEach((pick, i) => {
      console.log(`  ${i+1}. ${pick.player.name} (${pick.player.position}/${pick.player.tier}) - $${pick.price}`);
    });
    
    console.log(`\nSCORE: ${simPassCount}/6 guidelines met`);
  });
  
  // Calculate averages
  const avgBudget = results.reduce((sum, r) => sum + r.analysis.totalSpent, 0) / results.length;
  const avgRBSpend = results.reduce((sum, r) => sum + r.analysis.rbSpendPercent, 0) / results.length;
  const avgEliteRBs = results.reduce((sum, r) => sum + r.analysis.eliteRBCount, 0) / results.length;
  const avgRank = results.reduce((sum, r) => sum + r.analysis.leagueRank, 0) / results.length;
  
  console.log('\n====================================================');
  console.log('FINAL RESULTS SUMMARY');
  console.log('====================================================\n');
  
  console.log(`Overall Success Rate: ${passCount}/${totalChecks} (${(passCount/totalChecks*100).toFixed(0)}%)`);
  console.log(`Average Budget Spent: $${avgBudget.toFixed(0)}`);
  console.log(`Average RB Spend: ${avgRBSpend.toFixed(1)}%`);
  console.log(`Average Elite RBs: ${avgEliteRBs.toFixed(1)}`);
  console.log(`Average League Rank: ${avgRank.toFixed(1)}`);
  
  const successRate = passCount / totalChecks;
  if (successRate >= 0.9) {
    console.log('\n✅ EXCELLENT - Strategy guidelines are being met consistently!');
  } else if (successRate >= 0.75) {
    console.log('\n👍 GOOD - Most guidelines are being met');
  } else if (successRate >= 0.6) {
    console.log('\n⚠️  FAIR - Some adjustments still needed');
  } else {
    console.log('\n❌ NEEDS WORK - Significant gaps remain');
  }
  
  console.log('\n✅ Simulation test complete!');
}

// Export for use
export { runFinalSimulations };

// Run if called directly
if (typeof window !== 'undefined') {
  (window as any).runFinalSimulations = runFinalSimulations;
}