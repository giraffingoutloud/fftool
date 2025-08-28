// Verify that our parsing correctly loads all players from all files
import { DataLoaderV2 } from './dataLoaderV2';

async function verifyParsing() {
  console.log('=== Verifying Data Loading ===\n');
  
  const loader = new DataLoaderV2();
  
  // Load all data
  console.log('Loading all data sources...');
  const data = await loader.loadAllData();
  
  // Expected counts from files:
  const expectedCounts = {
    'FantasyPros_RB': 178,
    'FantasyPros_WR': 214,
    'FantasyPros_TE': 145,
    'FantasyPros_FLX': 527, // Contains duplicates of RB/WR/TE
    'CBS_QB': 73,
    'CBS_RB': 99,
    'CBS_WR': 100,
    'CBS_TE': 99,
    'projections_2025': 572
  };
  
  console.log('\n=== File Counts ===');
  console.log('Total expected unique players across all files:');
  console.log('- FantasyPros (RB+WR+TE): ' + (178 + 214 + 145) + ' = 537 players');
  console.log('- CBS (QB+RB+WR+TE): ' + (73 + 99 + 100 + 99) + ' = 371 players');
  console.log('- projections_2025: 572 players');
  console.log('- FLX file: 527 (duplicates, should be ignored or low weight)');
  
  console.log('\n=== Loaded Data ===');
  console.log('Total projections loaded:', data.projections.length);
  console.log('Total ADP entries:', data.adpData.length);
  console.log('Total players:', data.players.length);
  
  // Count by position
  const positionCounts: {[key: string]: number} = {};
  data.projections.forEach(p => {
    positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
  });
  
  console.log('\n=== Position Breakdown ===');
  Object.entries(positionCounts).sort().forEach(([pos, count]) => {
    console.log(`${pos}: ${count}`);
  });
  
  // Check for duplicates
  const namePositionMap = new Map<string, string[]>();
  data.projections.forEach(p => {
    const key = `${p.name}_${p.position}`;
    if (!namePositionMap.has(key)) {
      namePositionMap.set(key, []);
    }
    namePositionMap.get(key)!.push(p.team);
  });
  
  const duplicates = Array.from(namePositionMap.entries())
    .filter(([_, teams]) => teams.length > 1);
  
  if (duplicates.length > 0) {
    console.log('\n=== Duplicate Players Found ===');
    duplicates.slice(0, 10).forEach(([player, teams]) => {
      console.log(`${player}: ${teams.join(', ')}`);
    });
    console.log(`Total duplicates: ${duplicates.length}`);
  }
  
  // Check projection value ranges
  const valueRanges: {[key: string]: number} = {
    '0-50': 0,
    '50-100': 0,
    '100-200': 0,
    '200-300': 0,
    '300-400': 0,
    '400-500': 0,
    '500+': 0
  };
  
  data.projections.forEach(p => {
    const pts = p.projectedPoints || 0;
    if (pts <= 0) return;
    if (pts <= 50) valueRanges['0-50']++;
    else if (pts <= 100) valueRanges['50-100']++;
    else if (pts <= 200) valueRanges['100-200']++;
    else if (pts <= 300) valueRanges['200-300']++;
    else if (pts <= 400) valueRanges['300-400']++;
    else if (pts <= 500) valueRanges['400-500']++;
    else valueRanges['500+']++;
  });
  
  console.log('\n=== Projection Value Ranges ===');
  Object.entries(valueRanges).forEach(([range, count]) => {
    console.log(`${range} points: ${count} players`);
  });
  
  // Show top 10 players by projected points
  console.log('\n=== Top 10 Players by Projected Points ===');
  data.projections
    .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
    .slice(0, 10)
    .forEach((p, i) => {
      console.log(`${i+1}. ${p.name} (${p.position}, ${p.team}): ${p.projectedPoints?.toFixed(1)} pts`);
    });
  
  // Check for missing positions
  console.log('\n=== Coverage Check ===');
  const hasQB = positionCounts['QB'] > 0;
  const hasRB = positionCounts['RB'] > 0;
  const hasWR = positionCounts['WR'] > 0;
  const hasTE = positionCounts['TE'] > 0;
  const hasK = positionCounts['K'] > 0;
  const hasDST = positionCounts['DST'] > 0 || positionCounts['DEF'] > 0;
  
  console.log('QB:', hasQB ? `✓ (${positionCounts['QB']})` : '✗ MISSING');
  console.log('RB:', hasRB ? `✓ (${positionCounts['RB']})` : '✗ MISSING');
  console.log('WR:', hasWR ? `✓ (${positionCounts['WR']})` : '✗ MISSING');
  console.log('TE:', hasTE ? `✓ (${positionCounts['TE']})` : '✗ MISSING');
  console.log('K:', hasK ? `✓ (${positionCounts['K'] || 0})` : '✗ MISSING');
  console.log('DST/DEF:', hasDST ? `✓ (${(positionCounts['DST'] || 0) + (positionCounts['DEF'] || 0)})` : '✗ MISSING');
  
  // Check for invalid data
  const invalidPlayers = data.projections.filter(p => 
    !p.name || 
    !p.position || 
    !p.projectedPoints || 
    p.projectedPoints <= 0 || 
    p.projectedPoints > 500
  );
  
  if (invalidPlayers.length > 0) {
    console.log('\n=== Invalid Players ===');
    console.log(`Found ${invalidPlayers.length} players with invalid data`);
    invalidPlayers.slice(0, 5).forEach(p => {
      console.log(`- ${p.name || 'NO NAME'} (${p.position || 'NO POS'}): ${p.projectedPoints || 0} pts`);
    });
  }
  
  console.log('\n=== Summary ===');
  const uniquePlayers = namePositionMap.size;
  console.log(`Unique players (name+position): ${uniquePlayers}`);
  console.log(`Expected unique players: ~600-700 (accounting for overlaps)`);
  console.log(`Data quality: ${invalidPlayers.length === 0 ? '✓ Good' : '⚠ Issues found'}`);
}

// Run verification
verifyParsing().catch(console.error);