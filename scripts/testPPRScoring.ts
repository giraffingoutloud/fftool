/**
 * Test script to verify PPR scoring is working correctly
 */

import { loadAllPlayerAdvanced } from '../src/lib/playerAdvancedLoader';
import { pprScoringService } from '../src/lib/pprScoringService';

async function testPPRScoring() {
  console.log('Loading advanced stats...');
  const advancedStats = await loadAllPlayerAdvanced();
  
  // Test some known players
  const testPlayers = [
    { name: "Ja'Marr Chase", position: 'WR' },
    { name: 'CeeDee Lamb', position: 'WR' },
    { name: 'Tyreek Hill', position: 'WR' },
    { name: 'Breece Hall', position: 'RB' },
    { name: 'Christian McCaffrey', position: 'RB' },
    { name: 'Travis Kelce', position: 'TE' },
    { name: 'Sam LaPorta', position: 'TE' }
  ];
  
  console.log('\n=== PPR Scoring Test Results ===\n');
  
  for (const player of testPlayers) {
    const key = `${player.name.toLowerCase()}_${player.position}`;
    const stats = advancedStats.get(key);
    
    if (stats) {
      console.log(`${player.name} (${player.position}):`);
      console.log(`  Key: ${key}`);
      console.log(`  Raw Stats:`, {
        targets: stats.targets,
        receptions: stats.receptions,
        targetShare: stats.targetShare,
        catchRate: stats.catchRate,
        yardsPerRouteRun: stats.yardsPerRouteRun,
        redZoneTargets: stats.redZoneTargets,
        receivingYards: stats.receivingYards
      });
      
      // Create a mock player object for PPR calculation
      const mockPlayer = {
        position: player.position,
        targets: stats.targets,
        receptions: stats.receptions,
        targetShare: stats.targetShare,
        catchRate: stats.catchRate,
        yardsPerRouteRun: stats.yardsPerRouteRun,
        redZoneTargets: stats.redZoneTargets,
        receivingYards: stats.receivingYards,
        games: 17, // Assume full season
        rushingAttempts: player.position === 'RB' ? 200 : undefined
      };
      
      const pprScore = pprScoringService.calculatePPRScore(mockPlayer as any);
      console.log(`  PPR Score: ${pprScore ? pprScore.score.toFixed(1) : 'N/A'}`);
      console.log(`  PPR Color: ${pprScore?.color || 'N/A'}`);
      console.log('');
    } else {
      console.log(`${player.name} (${player.position}): NOT FOUND`);
      console.log(`  Tried key: ${key}`);
      console.log('');
    }
  }
  
  // Show some keys that exist in the map
  console.log('\n=== Sample keys in advanced stats map ===');
  let count = 0;
  for (const [key, value] of advancedStats.entries()) {
    if (count++ < 10) {
      console.log(`  ${key} -> ${value.name} (${value.team})`);
    }
  }
  console.log(`  ... and ${advancedStats.size - 10} more`);
}

testPPRScoring().catch(console.error);