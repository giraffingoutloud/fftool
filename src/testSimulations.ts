/**
 * Test Script for Draft Simulations
 * Compares results against strategy guidelines
 */

import { runSimulations } from './lib/draftSimulator';

async function testSimulations() {
  console.log('Starting draft simulations test...\n');
  
  // Run 3 simulations
  const results = await runSimulations(3);
  
  // Strategy guidelines from strat.md
  const guidelines = {
    rbSpendTarget: { min: 50, max: 60, ideal: 55 },
    totalBudgetTarget: { min: 190, max: 200, ideal: 195 },
    rbCountTarget: { min: 5, max: 6 },
    wrCountTarget: { min: 6, max: 7 },
    eliteRBTarget: { min: 2, max: 3 },
    topPlayersSpend: { min: 70, max: 80 } // % on top 3-4 players
  };
  
  console.log('========== SIMULATION RESULTS vs GUIDELINES ==========\n');
  console.log('GUIDELINES FROM strat.md:');
  console.log('- 50-60% budget on 2-3 elite RBs');
  console.log('- 70-80% on top 3-4 players total');
  console.log('- 5-6 total RBs, 6-7 total WRs');
  console.log('- Spend 95%+ of budget ($190+)');
  console.log('- Target 1 Tier 1 elite + 1 Tier 2 high-end RB\n');
  
  const allResults = {
    budgetSpent: [] as number[],
    rbSpendPercent: [] as number[],
    eliteRBCount: [] as number[],
    leagueRank: [] as number[],
    rbCount: [] as number[],
    wrCount: [] as number[]
  };
  
  results.forEach((result, idx) => {
    console.log(`\n============ SIMULATION ${idx + 1} ============`);
    
    const analysis = result.analysis;
    const posCounts = analysis.positionCounts;
    
    // Track for averages
    allResults.budgetSpent.push(analysis.totalSpent);
    allResults.rbSpendPercent.push(analysis.rbSpendPercent);
    allResults.eliteRBCount.push(analysis.eliteRBCount);
    allResults.leagueRank.push(analysis.leagueRank);
    allResults.rbCount.push(posCounts.RB || 0);
    allResults.wrCount.push(posCounts.WR || 0);
    
    // Check against guidelines
    const checks = {
      budgetEfficient: analysis.totalSpent >= guidelines.totalBudgetTarget.min,
      rbSpendInRange: analysis.rbSpendPercent >= guidelines.rbSpendTarget.min && 
                      analysis.rbSpendPercent <= guidelines.rbSpendTarget.max + 10, // Allow some flexibility
      rbCountGood: (posCounts.RB || 0) >= guidelines.rbCountTarget.min && 
                   (posCounts.RB || 0) <= guidelines.rbCountTarget.max,
      wrCountGood: (posCounts.WR || 0) >= guidelines.wrCountTarget.min && 
                   (posCounts.WR || 0) <= guidelines.wrCountTarget.max,
      eliteRBsGood: analysis.eliteRBCount >= guidelines.eliteRBTarget.min,
      meetsRequirements: analysis.meetsRequirements
    };
    
    // Calculate top players spend
    const sortedPicks = result.draftHistory
      .filter(p => p.teamId === result.userTeam.id)
      .sort((a, b) => b.price - a.price);
    const top4Spend = sortedPicks.slice(0, 4).reduce((sum, p) => sum + p.price, 0);
    const top4Percent = analysis.totalSpent > 0 ? (top4Spend / analysis.totalSpent * 100) : 0;
    
    console.log('\n📊 KEY METRICS:');
    console.log(`Budget: $${analysis.totalSpent}/200 (${(analysis.totalSpent/200*100).toFixed(0)}%) ${checks.budgetEfficient ? '✅' : '❌'}`);
    console.log(`RB Spend: $${analysis.rbSpend} (${analysis.rbSpendPercent.toFixed(1)}%) ${checks.rbSpendInRange ? '✅' : '❌'} [Target: 50-60%]`);
    console.log(`Top 4 Players: $${top4Spend} (${top4Percent.toFixed(1)}%) ${top4Percent >= 70 ? '✅' : '⚠️'} [Target: 70-80%]`);
    
    console.log('\n📈 ROSTER COMPOSITION:');
    console.log(`RBs: ${posCounts.RB || 0} ${checks.rbCountGood ? '✅' : '❌'} [Target: 5-6]`);
    console.log(`WRs: ${posCounts.WR || 0} ${checks.wrCountGood ? '✅' : '❌'} [Target: 6-7]`);
    console.log(`Elite/Tier1 RBs: ${analysis.eliteRBCount} ${checks.eliteRBsGood ? '✅' : '❌'} [Target: 2-3]`);
    
    console.log('\n🏆 COMPETITIVE POSITION:');
    console.log(`League Rank: #${analysis.leagueRank}/12 ${analysis.leagueRank <= 3 ? '✅' : '⚠️'}`);
    console.log(`Projected Points: ${analysis.projectedPoints.toFixed(0)}`);
    
    console.log('\n👥 FULL POSITION BREAKDOWN:');
    console.log(`QB: ${posCounts.QB || 0}, RB: ${posCounts.RB || 0}, WR: ${posCounts.WR || 0}, TE: ${posCounts.TE || 0}, DST: ${posCounts.DST || 0}, K: ${posCounts.K || 0}`);
    
    console.log('\n💰 TOP 5 PLAYERS:');
    const top5 = sortedPicks.slice(0, 5);
    top5.forEach((pick, i) => {
      const player = pick.player;
      console.log(`  ${i+1}. ${player.name} (${player.position}/${player.tier}) - $${pick.price}`);
    });
    
    // Elite RB details
    const eliteRBPicks = sortedPicks.filter(p => 
      p.player.position === 'RB' && (p.player.tier === 'elite' || p.player.tier === 'tier1')
    );
    if (eliteRBPicks.length > 0) {
      console.log('\n🌟 ELITE RBs ACQUIRED:');
      eliteRBPicks.forEach(pick => {
        console.log(`  ${pick.player.name} (${pick.player.tier}) - $${pick.price}`);
      });
    }
    
    const passCount = Object.values(checks).filter(v => v).length;
    const totalChecks = Object.values(checks).length;
    console.log(`\n📋 OVERALL: ${passCount}/${totalChecks} checks passed`);
    
    if (passCount === totalChecks) {
      console.log('✅ EXCELLENT - Meets all guidelines!');
    } else if (passCount >= totalChecks - 1) {
      console.log('👍 GOOD - Minor adjustments needed');
    } else {
      console.log('⚠️  NEEDS IMPROVEMENT - Multiple areas off target');
    }
  });
  
  // Calculate and display averages
  console.log('\n\n========== AVERAGES ACROSS ALL SIMULATIONS ==========\n');
  
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  
  const avgBudget = avg(allResults.budgetSpent);
  const avgRBSpend = avg(allResults.rbSpendPercent);
  const avgEliteRBs = avg(allResults.eliteRBCount);
  const avgRank = avg(allResults.leagueRank);
  const avgRBCount = avg(allResults.rbCount);
  const avgWRCount = avg(allResults.wrCount);
  
  console.log(`Average Budget Spent: $${avgBudget.toFixed(0)} (${(avgBudget/200*100).toFixed(0)}%)`);
  console.log(`Average RB Spend: ${avgRBSpend.toFixed(1)}% ${avgRBSpend >= 50 && avgRBSpend <= 60 ? '✅' : '❌'} [Target: 50-60%]`);
  console.log(`Average Elite RBs: ${avgEliteRBs.toFixed(1)} ${avgEliteRBs >= 2 ? '✅' : '❌'} [Target: 2-3]`);
  console.log(`Average RB Count: ${avgRBCount.toFixed(1)} ${avgRBCount >= 5 && avgRBCount <= 6 ? '✅' : '❌'} [Target: 5-6]`);
  console.log(`Average WR Count: ${avgWRCount.toFixed(1)} ${avgWRCount >= 6 && avgWRCount <= 7 ? '✅' : '❌'} [Target: 6-7]`);
  console.log(`Average League Rank: ${avgRank.toFixed(1)} ${avgRank <= 3 ? '✅' : '⚠️'} [Target: Top 3]`);
  
  // Recommendations
  console.log('\n\n========== RECOMMENDATIONS ==========\n');
  
  if (avgRBSpend < 50) {
    console.log('❗ RB spending too low - Need to be more aggressive on elite RBs');
    console.log('   - Increase bonuses for elite/tier1 RBs');
    console.log('   - Consider raising max bid thresholds early in draft');
  } else if (avgRBSpend > 70) {
    console.log('❗ RB spending too high - May lack balance');
    console.log('   - Ensure WR depth is maintained');
    console.log('   - Set harder caps on non-elite RBs');
  } else {
    console.log('✅ RB spending in good range');
  }
  
  if (avgEliteRBs < 2) {
    console.log('❗ Not acquiring enough elite RBs');
    console.log('   - Increase aggressiveness on tier1/elite RBs');
    console.log('   - Consider nominating non-RB elites early to drain budgets');
  }
  
  if (avgRBCount < 5) {
    console.log('❗ Not enough RB depth');
    console.log('   - Target more value RBs ($5-15 range)');
  }
  
  if (avgWRCount < 6) {
    console.log('❗ Not enough WR depth');
    console.log('   - Ensure filling WR spots after RB core secured');
  }
  
  if (avgRank > 3) {
    console.log('⚠️  League competitiveness could be better');
    console.log('   - May need to target higher ceiling players');
  }
  
  console.log('\n✅ Test complete!');
}

// Add to window for browser testing
if (typeof window !== 'undefined') {
  (window as any).testSimulations = testSimulations;
}

export { testSimulations };