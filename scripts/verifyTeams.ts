import { cleanDataLoader } from '../src/lib/cleanDataLoader';

async function verifyTeams() {
  console.log('Loading clean data...');
  
  const result = await cleanDataLoader.loadAllCleanData();
  
  if (!result.success || !result.data) {
    console.error('Failed to load data:', result.errors);
    return;
  }
  
  const projections = result.data.projections;
  
  // Get unique teams from projections
  const uniqueTeams = new Set(projections.map(p => p.team).filter(Boolean));
  const teamArray = Array.from(uniqueTeams).sort();
  
  console.log('\n=== TEAM VERIFICATION RESULTS ===');
  console.log(`Total players: ${projections.length}`);
  console.log(`Unique teams: ${uniqueTeams.size}`);
  console.log(`Teams found: ${teamArray.join(', ')}`);
  
  // Expected NFL teams
  const expectedTeams = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
  ];
  
  const missingTeams = expectedTeams.filter(team => !uniqueTeams.has(team));
  const extraTeams = teamArray.filter(team => !expectedTeams.includes(team));
  
  if (missingTeams.length > 0) {
    console.log(`\nMISSING TEAMS: ${missingTeams.join(', ')}`);
  } else {
    console.log('\n✅ All 32 NFL teams are present');
  }
  
  if (extraTeams.length > 0) {
    console.log(`\nUNEXPECTED TEAMS: ${extraTeams.join(', ')}`);
  }
  
  // Sample players from different teams
  console.log('\n=== SAMPLE PLAYERS BY TEAM ===');
  for (const team of ['KC', 'BUF', 'DAL', 'GB', 'SEA']) {
    const teamPlayers = projections
      .filter(p => p.team === team)
      .slice(0, 3)
      .map(p => p.name);
    console.log(`${team}: ${teamPlayers.join(', ')}`);
  }
  
  // Check for players with missing teams
  const noTeamPlayers = projections.filter(p => !p.team || p.team === '');
  if (noTeamPlayers.length > 0) {
    console.log(`\n⚠️ Players without team: ${noTeamPlayers.length}`);
    console.log('First 5:', noTeamPlayers.slice(0, 5).map(p => p.name).join(', '));
  }
}

verifyTeams().catch(console.error);