/**
 * Quick check of top player values
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

console.log(`Loaded ${players.length} players\n`);

// Process and show top 20
const result = model.processAllPlayers(players);
const valuations = result.valuations.sort((a, b) => b.auctionValue - a.auctionValue);

console.log('Top 20 Players by Auction Value:');
console.log('═'.repeat(70));
console.log('Rank | Player                  | Pos | Pts    | Value | Market | Edge');
console.log('─'.repeat(70));

valuations.slice(0, 20).forEach((p, idx) => {
  const edge = p.marketValue ? (p.auctionValue - p.marketValue) : 0;
  const edgeStr = p.marketValue ? `${edge > 0 ? '+' : ''}$${edge}` : 'N/A';
  
  console.log(
    `${(idx + 1).toString().padStart(4)} | ` +
    `${p.playerName.substring(0, 23).padEnd(23)} | ` +
    `${p.position.padEnd(3)} | ` +
    `${p.projectedPoints.toFixed(0).padStart(6)} | ` +
    `$${p.auctionValue.toString().padStart(5)} | ` +
    `$${(p.marketValue || 0).toString().padStart(6)} | ` +
    `${edgeStr.padStart(6)}`
  );
});

// Show position summaries
console.log('\n\nPosition Summary (Top Starters):');
console.log('═'.repeat(50));

const positions = ['QB', 'RB', 'WR', 'TE'];
const starterCounts = { QB: 12, RB: 24, WR: 24, TE: 12 };

positions.forEach(pos => {
  const posPlayers = valuations.filter(v => v.position === pos);
  const starters = posPlayers.slice(0, starterCounts[pos]);
  const avgValue = starters.reduce((sum, p) => sum + p.auctionValue, 0) / starters.length;
  
  console.log(`${pos}: Top ${starterCounts[pos]} average $${avgValue.toFixed(1)}`);
  console.log(`  Top 3: ${starters.slice(0, 3).map(p => `${p.playerName} ($${p.auctionValue})`).join(', ')}`);
});