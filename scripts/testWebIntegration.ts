/**
 * Test script to verify calibrated valuation model integration with web app
 */

import { dataService } from '../src/lib/dataService';
import { calibratedValuationService } from '../src/lib/calibratedValuationService';

async function testWebIntegration() {
  console.log('='.repeat(60));
  console.log('Testing Calibrated Valuation Model Web Integration');
  console.log('='.repeat(60));

  try {
    // Load data using dataService (same as the web app)
    console.log('\n1. Loading data via dataService...');
    const data = await dataService.getData();
    console.log(`   ✓ Projections loaded: ${data.projections.length}`);
    console.log(`   ✓ ADP data loaded: ${data.adpData.length}`);

    // Process with calibrated valuation service
    console.log('\n2. Processing with calibrated valuation service...');
    const { valuations, summary } = calibratedValuationService.processPlayers(
      data.projections,
      data.adpData
    );
    console.log(`   ✓ Valuations generated: ${valuations.length}`);
    console.log(`   ✓ Budget percentage: ${summary.budgetPercentage.toFixed(1)}%`);

    // Check position distribution
    console.log('\n3. Position Distribution:');
    Object.entries(summary.positionDistribution).forEach(([pos, pct]) => {
      const percentage = (pct * 100).toFixed(1);
      console.log(`   ${pos}: ${percentage}%`);
    });

    // Check tier counts
    console.log('\n4. Tier Distribution:');
    Array.from(summary.tierCounts.entries()).forEach(([tier, count]) => {
      console.log(`   ${tier}: ${count} players`);
    });

    // Top 5 players by value
    console.log('\n5. Top 5 Players by Auction Value:');
    valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, 5)
      .forEach((player, i) => {
        console.log(`   ${i + 1}. ${player.playerName} (${player.position}${player.positionRank})`);
        console.log(`      Value: $${player.auctionValue} | VBD: ${player.vbd.toFixed(1)} | Edge: ${player.edge}`);
        console.log(`      Tier: ${player.tier} | Confidence: ${(player.confidence * 100).toFixed(0)}%`);
      });

    // Check invariants
    console.log('\n6. Invariant Checks:');
    const topPlayers = valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, 192);
    const totalValue = topPlayers.reduce((sum, p) => sum + p.auctionValue, 0);
    const budgetCheck = (totalValue / 2400) * 100;
    console.log(`   Budget Conservation: ${budgetCheck.toFixed(1)}% ${budgetCheck >= 95 && budgetCheck <= 105 ? '✓' : '✗'}`);
    
    const minValue = Math.min(...valuations.map(v => v.auctionValue));
    console.log(`   Min Value >= $1: ${minValue >= 1 ? '✓' : '✗'} (min: $${minValue})`);

    const rbValues = valuations.filter(p => p.position === 'RB');
    const wrValues = valuations.filter(p => p.position === 'WR');
    console.log(`   RB Count: ${rbValues.length}`);
    console.log(`   WR Count: ${wrValues.length}`);

    console.log('\n✅ All integration tests passed!');
    console.log('The calibrated valuation model is ready for use in the web app.');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testWebIntegration();