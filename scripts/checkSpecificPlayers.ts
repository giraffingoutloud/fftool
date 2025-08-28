/**
 * Check specific notable players
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { CalibratedValuationModel } from '../src/lib/calibratedValuationModel';

const model = new CalibratedValuationModel();

// Load data
const filePath = path.join('artifacts/clean_data/projections_2025_with_adp.csv');
const fileContent = fs.readFileSync(filePath, 'utf-8');

const parsed = Papa.parse(fileContent, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true
});

const players = parsed.data.map((row: any, idx: number) => ({
  id: `player-${idx}`,
  name: row.playerName,
  position: row.position?.toUpperCase(),
  team: row.teamName,
  projectedPoints: parseFloat(row.fantasyPoints) || 0,
  adp: row.adp ? parseFloat(row.adp) : undefined,
  marketValue: row.marketValue ? parseFloat(row.marketValue) : undefined
}));

// Process
const result = model.processAllPlayers(players);
const valuations = result.valuations;

// Notable players to check
const notableNames = [
  'Breece Hall',
  'Jonathan Taylor', 
  'Travis Etienne',
  'Kenneth Walker',
  'James Cook',
  'Patrick Mahomes',
  'Jalen Hurts',
  'Dak Prescott',
  'A.J. Brown',
  'Stefon Diggs',
  'Chris Olave',
  'Travis Kelce',
  'Mark Andrews',
  'Sam LaPorta'
];

console.log('Notable Player Values:');
console.log('═'.repeat(75));
console.log('Player                   | Pos | Rank | Pts    | Value | Market | Edge');
console.log('─'.repeat(75));

notableNames.forEach(name => {
  const player = valuations.find(v => v.playerName.includes(name));
  
  if (player) {
    const edge = player.marketValue ? (player.auctionValue - player.marketValue) : 0;
    const edgeStr = player.marketValue ? `${edge >= 0 ? '+' : ''}$${edge}` : 'N/A';
    
    console.log(
      `${player.playerName.substring(0, 24).padEnd(24)} | ` +
      `${player.position.padEnd(3)} | ` +
      `${player.positionRank.toString().padStart(4)} | ` +
      `${player.projectedPoints.toFixed(0).padStart(6)} | ` +
      `$${player.auctionValue.toString().padStart(5)} | ` +
      `$${(player.marketValue || 0).toString().padStart(6)} | ` +
      `${edgeStr.padStart(6)}`
    );
  } else {
    console.log(`${name.padEnd(24)} | NOT FOUND`);
  }
});

// Check Breece specifically
console.log('\n\nBreece Hall Deep Dive:');
console.log('═'.repeat(50));

const breece = valuations.find(v => v.playerName.includes('Breece Hall'));
if (breece) {
  console.log(`Name: ${breece.playerName}`);
  console.log(`Position: ${breece.position}`);
  console.log(`Position Rank: ${breece.positionRank}`);
  console.log(`Projected Points: ${breece.projectedPoints}`);
  console.log(`VBD: ${breece.vbd.toFixed(1)}`);
  console.log(`Base Value: $${breece.baseValue}`);
  console.log(`Tier Adjustment: ${breece.tierAdjustment.toFixed(2)}x`);
  console.log(`Market Adjustment: ${breece.marketAdjustment.toFixed(2)}x`);
  console.log(`Auction Value: $${breece.auctionValue}`);
  console.log(`Market Value: $${breece.marketValue || 'N/A'}`);
  console.log(`\nSpecial Correction Applied: ${breece.auctionValue === 28 ? 'YES ($28 override)' : 'NO'}`);
} else {
  console.log('Breece Hall not found!');
}