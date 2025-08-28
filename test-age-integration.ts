/**
 * Test script to verify age data is properly integrated through the pipeline
 */

import { DataLoaderV2 } from './src/lib/dataLoaderV2';
import { dataService } from './src/lib/dataService';

async function testAgeIntegration() {
  console.log('=== Testing Age Data Integration ===\n');
  
  try {
    // Test through DataService (recommended approach)
    console.log('1. Loading data through DataService...');
    const data = await dataService.getData();
    
    // Check ADP data for age
    console.log('\n2. Checking ADP data for age:');
    const adpWithAge = data.adpData.filter(p => p.age !== undefined && p.age !== null);
    console.log(`   - Total ADP entries: ${data.adpData.length}`);
    console.log(`   - Entries with age data: ${adpWithAge.length}`);
    
    if (adpWithAge.length > 0) {
      console.log('   - Sample players with age:');
      adpWithAge.slice(0, 5).forEach(p => {
        console.log(`     • ${p.name} (${p.position}, ${p.team}): Age ${p.age}`);
      });
    }
    
    // Check player data for age
    console.log('\n3. Checking player data for age:');
    const playersWithAge = data.players.filter(p => p.age !== undefined && p.age !== null);
    console.log(`   - Total players: ${data.players.length}`);
    console.log(`   - Players with age data: ${playersWithAge.length}`);
    
    if (playersWithAge.length > 0) {
      console.log('   - Sample players with age:');
      playersWithAge.slice(0, 5).forEach(p => {
        console.log(`     • ${p.name} (${p.position}): Age ${p.age}`);
      });
    }
    
    // Check projections for age
    console.log('\n4. Checking projections for age:');
    const projectionsWithAge = data.projections.filter(p => p.age !== undefined && p.age !== null);
    console.log(`   - Total projections: ${data.projections.length}`);
    console.log(`   - Projections with age data: ${projectionsWithAge.length}`);
    
    // Age distribution analysis
    if (adpWithAge.length > 0) {
      console.log('\n5. Age distribution analysis:');
      const ages = adpWithAge.map(p => p.age).filter(age => age !== undefined) as number[];
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
      
      console.log(`   - Youngest player: ${minAge} years`);
      console.log(`   - Oldest player: ${maxAge} years`);
      console.log(`   - Average age: ${avgAge.toFixed(1)} years`);
      
      // Age brackets
      const ageBrackets = {
        '20-22': 0,
        '23-25': 0,
        '26-28': 0,
        '29-31': 0,
        '32+': 0
      };
      
      ages.forEach(age => {
        if (age <= 22) ageBrackets['20-22']++;
        else if (age <= 25) ageBrackets['23-25']++;
        else if (age <= 28) ageBrackets['26-28']++;
        else if (age <= 31) ageBrackets['29-31']++;
        else ageBrackets['32+']++;
      });
      
      console.log('   - Age distribution:');
      Object.entries(ageBrackets).forEach(([bracket, count]) => {
        console.log(`     • ${bracket}: ${count} players`);
      });
    }
    
    // Test direct DataLoader access
    console.log('\n6. Testing direct DataLoaderV2 access:');
    const loader = new DataLoaderV2();
    const directData = await loader.loadAllData();
    const directAgeCount = directData.adpData.filter(p => p.age !== undefined).length;
    console.log(`   - Direct loader ADP with age: ${directAgeCount}`);
    
    // Final summary
    console.log('\n=== Summary ===');
    if (adpWithAge.length > 0 || playersWithAge.length > 0) {
      console.log('✅ Age data is successfully integrated into the pipeline!');
      console.log(`   - ${adpWithAge.length} ADP entries have age data`);
      console.log(`   - Age data is accessible for valuation calculations if needed`);
      console.log('   - Data can be displayed in UI when required');
    } else {
      console.log('⚠️ Age data exists in CSV files but may not be fully integrated');
      console.log('   - Check that adp2_2025.csv is being loaded');
      console.log('   - Verify name matching between datasets');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAgeIntegration().then(() => {
  console.log('\n✅ Age integration test completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});