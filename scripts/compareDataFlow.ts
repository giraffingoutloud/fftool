import fs from 'fs';
import Papa from 'papaparse';
import path from 'path';

// Read CSV directly
const csvPath = path.join(process.cwd(), 'artifacts/clean_data/projections_2025_with_adp.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const parsed = Papa.parse(csvContent, { header: true });
const csvData = parsed.data as any[];

// Get unique teams and players from CSV
const csvTeams = new Set(csvData.map(row => row.teamName).filter(Boolean));
const csvPlayers = csvData.map(row => ({
  name: row.playerName,
  team: row.teamName,
  position: row.position,
  points: parseFloat(row.fantasyPoints)
})).filter(p => p.name && p.team);

console.log('=== CSV DATA ===');
console.log(`Total rows: ${csvData.length}`);
console.log(`Total players with teams: ${csvPlayers.length}`);
console.log(`Unique teams: ${csvTeams.size}`);
console.log(`Teams: ${Array.from(csvTeams).sort().join(', ')}`);

// Sample data from each team
console.log('\n=== PLAYERS PER TEAM (CSV) ===');
const teamCounts = new Map<string, number>();
for (const player of csvPlayers) {
  teamCounts.set(player.team, (teamCounts.get(player.team) || 0) + 1);
}

// Sort teams by player count
const sortedTeams = Array.from(teamCounts.entries())
  .sort((a, b) => b[1] - a[1]);

console.log('Teams by player count:');
for (const [team, count] of sortedTeams) {
  console.log(`  ${team}: ${count} players`);
}

// Check for anomalies
const avgPlayersPerTeam = csvPlayers.length / csvTeams.size;
console.log(`\nAverage players per team: ${avgPlayersPerTeam.toFixed(1)}`);

const teamsWithFewPlayers = sortedTeams.filter(([_, count]) => count < 10);
if (teamsWithFewPlayers.length > 0) {
  console.log('\n⚠️ Teams with fewer than 10 players:');
  for (const [team, count] of teamsWithFewPlayers) {
    console.log(`  ${team}: ${count} players`);
    const teamPlayers = csvPlayers.filter(p => p.team === team).map(p => p.name);
    console.log(`    Players: ${teamPlayers.join(', ')}`);
  }
}

// Check highest projected players from various teams
console.log('\n=== TOP PLAYER FROM EACH TEAM ===');
const sampleTeams = ['KC', 'BUF', 'DAL', 'SF', 'DET', 'MIA', 'CIN', 'PHI', 'BAL', 'GB'];
for (const team of sampleTeams) {
  const topPlayer = csvPlayers
    .filter(p => p.team === team)
    .sort((a, b) => b.points - a.points)[0];
  if (topPlayer) {
    console.log(`${team}: ${topPlayer.name} (${topPlayer.position}) - ${topPlayer.points.toFixed(1)} pts`);
  }
}