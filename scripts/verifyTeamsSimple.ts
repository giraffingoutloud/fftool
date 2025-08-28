import fs from 'fs';
import Papa from 'papaparse';
import path from 'path';

const csvPath = path.join(process.cwd(), 'artifacts/clean_data/projections_2025_with_adp.csv');

console.log('Reading CSV from:', csvPath);

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const parsed = Papa.parse(csvContent, { header: true });

const data = parsed.data as any[];

// Get unique teams
const uniqueTeams = new Set(data.map(row => row.teamName).filter(Boolean));
const teamArray = Array.from(uniqueTeams).sort();

console.log('\n=== CSV DATA VERIFICATION ===');
console.log(`Total rows: ${data.length}`);
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
  console.log('\n✅ All 32 NFL teams are present in CSV');
}

if (extraTeams.length > 0) {
  console.log(`\nUNEXPECTED TEAMS: ${extraTeams.join(', ')}`);
}

// Sample players from different teams
console.log('\n=== SAMPLE PLAYERS BY TEAM (from CSV) ===');
for (const team of ['KC', 'BUF', 'DAL', 'GB', 'SEA']) {
  const teamPlayers = data
    .filter(row => row.teamName === team)
    .slice(0, 3)
    .map(row => row.playerName);
  console.log(`${team}: ${teamPlayers.join(', ')}`);
}

// Check DST entries
const dstPlayers = data.filter(row => row.position === 'DST');
console.log(`\n=== DST TEAMS ===`);
console.log(`Total DST entries: ${dstPlayers.length}`);
console.log('DST teams:', dstPlayers.map(d => d.playerName).join(', '));