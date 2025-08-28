/**
 * Test script to verify all data integrations
 */

// Run this in the browser console to test integrations

async function testDataIntegration() {
  console.log('🧪 Testing Data Integration...\n');
  
  try {
    // Get the data service
    const { dataService } = await import('./src/lib/dataService.ts');
    const { rosterDataLoader } = await import('./src/lib/rosterDataLoader.ts');
    const { sosLoader } = await import('./src/lib/sosLoader.ts');
    
    // Load all data
    console.log('📊 Loading comprehensive data...');
    const data = await dataService.getData();
    
    // Test 1: Check injury status integration
    console.log('\n✅ Test 1: Injury Status Integration');
    const injuredPlayers = data.adpData.filter(p => p.injuryStatus && p.injuryStatus !== null);
    console.log(`Found ${injuredPlayers.length} players with injury status`);
    if (injuredPlayers.length > 0) {
      console.log('Sample injured players:', injuredPlayers.slice(0, 3).map(p => ({
        name: p.name,
        status: p.injuryStatus
      })));
    }
    
    // Test 2: Check age integration
    console.log('\n✅ Test 2: Age Integration');
    const playersWithAge = data.adpData.filter(p => p.age && p.age > 0);
    console.log(`Found ${playersWithAge.length} players with age data`);
    console.log(`Coverage: ${((playersWithAge.length / data.adpData.length) * 100).toFixed(1)}%`);
    if (playersWithAge.length > 0) {
      console.log('Sample players with age:', playersWithAge.slice(0, 3).map(p => ({
        name: p.name,
        age: p.age
      })));
    }
    
    // Test 3: Check height/weight integration
    console.log('\n✅ Test 3: Height/Weight Integration');
    await rosterDataLoader.loadRosterData();
    const playersWithPhysical = data.projections.filter(p => p.height || p.weight);
    console.log(`Found ${playersWithPhysical.length} players with physical attributes`);
    if (playersWithPhysical.length > 0) {
      console.log('Sample players with physical data:', playersWithPhysical.slice(0, 3).map(p => ({
        name: p.name,
        height: p.height,
        weight: p.weight
      })));
    }
    
    // Test 4: Check college/draft integration
    console.log('\n✅ Test 4: College/Draft Integration');
    const playersWithCollege = data.projections.filter(p => p.college);
    const playersWithDraft = data.projections.filter(p => p.draftYear || p.draftRound);
    console.log(`Found ${playersWithCollege.length} players with college data`);
    console.log(`Found ${playersWithDraft.length} players with draft data`);
    if (playersWithCollege.length > 0) {
      console.log('Sample college data:', playersWithCollege.slice(0, 3).map(p => ({
        name: p.name,
        college: p.college,
        draftYear: p.draftYear
      })));
    }
    
    // Test 5: Check SOS integration
    console.log('\n✅ Test 5: Strength of Schedule Integration');
    await sosLoader.loadSOSData();
    const playersWithSOS = data.projections.filter(p => p.teamSeasonSOS !== undefined);
    console.log(`Found ${playersWithSOS.length} players with SOS data`);
    if (playersWithSOS.length > 0) {
      // Group by team to show SOS
      const teamSOS = new Map();
      playersWithSOS.forEach(p => {
        if (!teamSOS.has(p.team)) {
          teamSOS.set(p.team, {
            team: p.team,
            seasonSOS: p.teamSeasonSOS,
            playoffSOS: p.teamPlayoffSOS
          });
        }
      });
      console.log('Sample team SOS:', Array.from(teamSOS.values()).slice(0, 5));
    }
    
    // Summary
    console.log('\n📋 Integration Summary:');
    console.log(`Total Players: ${data.players.length}`);
    console.log(`Total Projections: ${data.projections.length}`);
    console.log(`Total ADP Entries: ${data.adpData.length}`);
    console.log(`Data Quality Score: ${data.deduplicationReport.dataQualityScore}`);
    
    // Field coverage report
    console.log('\n📊 Field Coverage Report:');
    const coverage = {
      age: ((playersWithAge.length / data.adpData.length) * 100).toFixed(1),
      injury: ((injuredPlayers.length / data.adpData.length) * 100).toFixed(1),
      physical: ((playersWithPhysical.length / data.projections.length) * 100).toFixed(1),
      college: ((playersWithCollege.length / data.projections.length) * 100).toFixed(1),
      draft: ((playersWithDraft.length / data.projections.length) * 100).toFixed(1),
      sos: ((playersWithSOS.length / data.projections.length) * 100).toFixed(1)
    };
    console.table(coverage);
    
    console.log('\n✅ All integration tests complete!');
    
    return {
      success: true,
      coverage,
      totalPlayers: data.players.length
    };
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for use in console
window.testDataIntegration = testDataIntegration;

console.log('Test script loaded. Run testDataIntegration() to test all integrations.');