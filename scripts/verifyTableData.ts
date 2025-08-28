import fs from 'fs';
import Papa from 'papaparse';

// Load and check key player data
async function verifyData() {
  // Load ADP data to check market values
  const adpCsv = fs.readFileSync('artifacts/clean_data/adp1_2025.csv', 'utf8');
  const adpData = Papa.parse(adpCsv, { header: true }).data;
  
  // Load projections to check points
  const projCsv = fs.readFileSync('artifacts/clean_data/projections_2025.csv', 'utf8');
  const projData = Papa.parse(projCsv, { header: true }).data;
  
  // Key players to verify
  const keyPlayers = [
    'Bijan Robinson',
    "Ja'Marr Chase", 
    'Saquon Barkley',
    'Justin Jefferson',
    'Christian McCaffrey'
  ];
  
  console.log('\n=== VERIFICATION OF TABLE DATA ===\n');
  
  for (const playerName of keyPlayers) {
    // Find in ADP data
    const adpEntry = adpData.find((p: any) => p.Name === playerName);
    const projEntry = projData.find((p: any) => 
      p.playerName === playerName || p.name === playerName
    );
    
    if (adpEntry || projEntry) {
      console.log(`${playerName}:`);
      if (adpEntry) {
        console.log(`  Position: ${adpEntry.Pos}`);
        console.log(`  Team: ${adpEntry.Team}`);
        console.log(`  ADP (avg): ${adpEntry.Sleeper || 'N/A'}`);
        console.log(`  Market Value (ESPN_AAV): $${adpEntry.ESPN_AAV || 'N/A'}`);
        console.log(`  Market Value (MFL_AAV): $${adpEntry.MFL_AAV || 'N/A'}`);
      }
      if (projEntry) {
        console.log(`  Projected Points: ${projEntry.fantasyPoints || projEntry.projectedPoints || 'N/A'}`);
        console.log(`  Bye Week: ${projEntry.byeWeek || 'N/A'}`);
      }
      console.log('');
    }
  }
  
  // Check how many players have auction values
  const playersWithAAV = adpData.filter((p: any) => 
    p.ESPN_AAV && parseFloat(p.ESPN_AAV) > 0
  ).length;
  
  console.log(`\nTotal players with ESPN_AAV values: ${playersWithAAV} out of ${adpData.length}`);
  
  // Show distribution of auction values
  const aavValues = adpData
    .map((p: any) => parseFloat(p.ESPN_AAV))
    .filter((v: number) => !isNaN(v) && v > 0)
    .sort((a: number, b: number) => b - a);
    
  if (aavValues.length > 0) {
    console.log(`\nAuction Value Distribution:`);
    console.log(`  Max: $${aavValues[0]}`);
    console.log(`  Top 10 avg: $${(aavValues.slice(0, 10).reduce((a, b) => a + b, 0) / 10).toFixed(1)}`);
    console.log(`  Top 50 avg: $${(aavValues.slice(0, 50).reduce((a, b) => a + b, 0) / 50).toFixed(1)}`);
    console.log(`  Median: $${aavValues[Math.floor(aavValues.length / 2)]}`);
    console.log(`  Min: $${aavValues[aavValues.length - 1]}`);
  }
}

verifyData().catch(console.error);