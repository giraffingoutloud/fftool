/**
 * Check QB values - looking for inflated intrinsic values
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

console.log('Processing QBs...\n');

// Process individual QBs to see their intrinsic values
const result = model.processAllPlayers(players);
const qbs = result.valuations.filter(v => v.position === 'QB').sort((a, b) => b.projectedPoints - a.projectedPoints);

console.log('QB Values (sorted by points):');
console.log('═'.repeat(90));
console.log('Name                     | Pts   | VBD   | Base$ | Tier  | Mkt Adj | Final$ | Market$');
console.log('─'.repeat(90));

qbs.slice(0, 25).forEach(qb => {
  // Calculate intrinsic value before market blending
  const intrinsicValue = Math.round(qb.baseValue * qb.tierAdjustment * qb.marketAdjustment);
  
  console.log(
    `${qb.playerName.substring(0, 24).padEnd(24)} | ` +
    `${qb.projectedPoints.toFixed(0).padStart(5)} | ` +
    `${qb.vbd.toFixed(0).padStart(5)} | ` +
    `$${qb.baseValue.toString().padStart(4)} | ` +
    `${qb.tierAdjustment.toFixed(2).padStart(5)} | ` +
    `${qb.marketAdjustment.toFixed(2).padStart(7)} | ` +
    `$${qb.auctionValue.toString().padStart(6)} | ` +
    `$${(qb.marketValue || 0).toString().padStart(7)}`
  );
});

// Find Kyler specifically
console.log('\n\nKyler Murray Analysis:');
console.log('═'.repeat(50));

const kyler = qbs.find(q => q.playerName.includes('Kyler Murray'));
if (kyler) {
  console.log(`Name: ${kyler.playerName}`);
  console.log(`Position Rank: ${kyler.positionRank}`);
  console.log(`Projected Points: ${kyler.projectedPoints}`);
  console.log(`Replacement Points: ${kyler.replacementPoints}`);
  console.log(`VBD: ${kyler.vbd.toFixed(1)}`);
  console.log(`\nValue Calculation:`);
  console.log(`  Base Value: $${kyler.baseValue}`);
  console.log(`  × Tier Adjustment: ${kyler.tierAdjustment}`);
  console.log(`  × Market Adjustment: ${kyler.marketAdjustment}`);
  console.log(`  = Intrinsic Value: $${Math.round(kyler.baseValue * kyler.tierAdjustment * kyler.marketAdjustment)}`);
  console.log(`  Market Value: $${kyler.marketValue || 'N/A'}`);
  console.log(`  Final Auction Value: $${kyler.auctionValue}`);
  console.log(`\nIs this the $80 intrinsic value you're seeing?`);
} else {
  console.log('Kyler Murray not found in data!');
  
  // Search for partial match
  const kylerPartial = qbs.find(q => q.playerName.toLowerCase().includes('kyler'));
  if (kylerPartial) {
    console.log(`Found partial match: ${kylerPartial.playerName}`);
  }
}