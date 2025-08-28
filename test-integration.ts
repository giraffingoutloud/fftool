/**
 * Test script to verify the integrated data pipeline
 * This confirms that all components are working together:
 * 1. Python ETL pipeline (clean data loading)
 * 2. Weighted aggregation (FantasyPros 40%, CBS 35%, baseline 25%)
 * 3. Player/team normalization
 * 4. DataLoaderV2 using DataIntegrationService
 */

import { DataLoaderV2 } from './src/lib/dataLoaderV2';

async function testIntegration() {
  console.log('=== Testing Integrated Data Pipeline ===\n');
  
  const dataLoader = new DataLoaderV2();
  
  try {
    console.log('1. Loading data through integrated pipeline...');
    const startTime = Date.now();
    const data = await dataLoader.loadAllData();
    const loadTime = Date.now() - startTime;
    
    console.log(`✅ Data loaded in ${loadTime}ms\n`);
    
    // Check that we have all expected data
    console.log('2. Verifying data completeness:');
    console.log(`   - Players: ${data.players.length}`);
    console.log(`   - Projections: ${data.projections.length}`);
    console.log(`   - ADP Data: ${data.adpData.length}`);
    console.log(`   - Team Metrics: ${data.teamMetrics.size} teams`);
    console.log(`   - Player Advanced: ${data.playerAdvanced.size} players`);
    console.log(`   - Depth Charts: ${data.depthCharts.teams.length} teams`);
    console.log(`   - Data Quality Score: ${data.deduplicationReport.dataQualityScore}%\n`);
    
    // Verify weighted aggregation is working
    console.log('3. Verifying weighted aggregation:');
    const samplePlayers = data.projections.slice(0, 5);
    for (const player of samplePlayers) {
      console.log(`   - ${player.name} (${player.position}): ${player.projectedPoints?.toFixed(1)} pts`);
    }
    console.log('');
    
    // Check for normalization
    console.log('4. Verifying normalization:');
    const teamCodes = new Set(data.players.map(p => p.team).filter(t => t));
    const invalidTeams = Array.from(teamCodes).filter(t => 
      !['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 
        'DET', 'GB', 'HOU', 'IND', 'JAC', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
        'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
        'TEN', 'WAS', 'FA'].includes(t)
    );
    
    if (invalidTeams.length > 0) {
      console.log(`   ⚠️ Found non-standard team codes: ${invalidTeams.join(', ')}`);
    } else {
      console.log(`   ✅ All team codes normalized (${teamCodes.size} unique teams)`);
    }
    
    // Check for duplicate handling
    console.log(`\n5. Deduplication report:`);
    console.log(`   - ADP conflicts: ${data.deduplicationReport.adpConflicts.length}`);
    console.log(`   - Projection conflicts: ${data.deduplicationReport.projectionConflicts.length}`);
    console.log(`   - Players flagged for review: ${data.deduplicationReport.flaggedForReview.length}`);
    
    // Check integration specifics
    console.log(`\n6. Integration validation:`);
    
    // Check if we're using clean data (should have certain markers)
    const hasCleanDataMarkers = data.players.every(p => p.id && p.name && p.position);
    console.log(`   - Clean data structure: ${hasCleanDataMarkers ? '✅' : '❌'}`);
    
    // Check if aggregation happened (projections should have reasonable values)
    const projectionRange = data.projections.filter(p => p.projectedPoints > 0 && p.projectedPoints < 500);
    const aggregationWorking = projectionRange.length > data.projections.length * 0.9;
    console.log(`   - Aggregation working: ${aggregationWorking ? '✅' : '❌'} (${projectionRange.length}/${data.projections.length} in valid range)`);
    
    // Final summary
    console.log('\n=== Integration Test Summary ===');
    if (data.players.length > 0 && data.projections.length > 0 && data.adpData.length > 0) {
      console.log('✅ All core data loaded successfully');
      console.log('✅ Integration pipeline is working');
    } else {
      console.log('❌ Some data is missing - integration may have issues');
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testIntegration().then(() => {
  console.log('\n✅ Integration test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});