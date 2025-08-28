/**
 * Test that intrinsic values are calculated correctly
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { calibratedValuationService } from '../src/lib/calibratedValuationService';

// Load data
const filePath = path.join('artifacts/clean_data/projections_2025_with_adp.csv');
const fileContent = fs.readFileSync(filePath, 'utf-8');

const parsed = Papa.parse(fileContent, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true
});

const players = parsed.data.map((row: any) => ({
  id: row.playerId || row.id,
  name: row.playerName,
  position: row.position,
  team: row.teamName,
  points: parseFloat(row.fantasyPoints) || 0,
  byeWeek: row.byeWeek ? parseInt(row.byeWeek) : undefined,
  sos: row.teamSeasonSOS ? parseFloat(row.teamSeasonSOS) : undefined,
  adp: row.adp ? parseFloat(row.adp) : undefined,
  auctionValue: row.marketValue ? parseFloat(row.marketValue) : undefined
}));

console.log('Testing intrinsic values calculation...\n');

// Process and check QBs
const results = calibratedValuationService.processProjections(players);
const qbs = results.valuations.filter(v => v.position === 'QB').sort((a, b) => b.points - a.points);

console.log('QB Intrinsic Values (should be pure calculated, not market-blended):');
console.log('═'.repeat(80));
console.log('Name                     | Pts   | Intrinsic | Final | Market | Correct?');
console.log('─'.repeat(80));

qbs.slice(0, 20).forEach(qb => {
  // Intrinsic should be different from final when there's market blending
  const hasMarketBlending = qb.marketValue && qb.marketValue > 1;
  const isCorrect = !hasMarketBlending || qb.intrinsicValue !== qb.auctionValue;
  
  console.log(
    `${qb.name.substring(0, 24).padEnd(24)} | ` +
    `${qb.points.toFixed(0).padStart(5)} | ` +
    `$${qb.intrinsicValue.toString().padStart(9)} | ` +
    `$${qb.auctionValue.toString().padStart(5)} | ` +
    `$${(qb.marketValue || 0).toString().padStart(6)} | ` +
    `${isCorrect ? '✓' : '✗ WRONG'}`
  );
});

// Check Kyler specifically
const kyler = qbs.find(q => q.name.includes('Kyler Murray'));
if (kyler) {
  console.log('\n\nKyler Murray Analysis:');
  console.log('═'.repeat(50));
  console.log(`Name: ${kyler.name}`);
  console.log(`Points: ${kyler.points}`);
  console.log(`Intrinsic Value: $${kyler.intrinsicValue} (pure calculation)`);
  console.log(`Market Value: $${kyler.marketValue || 'N/A'}`);
  console.log(`Final Auction Value: $${kyler.auctionValue} (after blending)`);
  console.log(`\nIs intrinsic value reasonable? ${kyler.intrinsicValue <= 10 ? '✓ Yes' : '✗ No, too high!'}`);
}

// Check top RBs to ensure they're reasonable
console.log('\n\nTop RB Intrinsic Values:');
console.log('═'.repeat(80));

const rbs = results.valuations.filter(v => v.position === 'RB').sort((a, b) => b.auctionValue - a.auctionValue);
rbs.slice(0, 5).forEach(rb => {
  console.log(
    `${rb.name.padEnd(24)} | ` +
    `Intrinsic: $${rb.intrinsicValue.toString().padStart(3)} | ` +
    `Final: $${rb.auctionValue.toString().padStart(3)} | ` +
    `Market: $${(rb.marketValue || 0).toString().padStart(3)}`
  );
});