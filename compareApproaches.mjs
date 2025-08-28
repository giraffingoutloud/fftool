import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSV(content, delimiter = ',') {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }

  return rows;
}

function parseWithNulls(content) {
  const rows = parseCSV(content);
  const missingPatterns = ['N/A', 'NA', 'null', 'NULL', '', '-', '--'];
  
  return rows.map((row, index) => {
    const parsed = { ...row };
    
    // Parse ADP preserving nulls
    if (missingPatterns.includes(row['ADP'])) {
      parsed['ADP'] = null;
    } else {
      const adp = parseFloat(row['ADP']);
      parsed['ADP'] = isNaN(adp) ? null : adp;
    }
    
    // Parse Auction Value preserving nulls
    if (missingPatterns.includes(row['Auction Value'])) {
      parsed['Auction Value'] = null;
    } else {
      const auction = parseFloat(row['Auction Value']);
      parsed['Auction Value'] = isNaN(auction) ? null : auction;
    }
    
    parsed._rowNumber = index + 2;
    return parsed;
  });
}

async function compareApproaches() {
  console.log('=' .repeat(80));
  console.log('COMPARISON: FAKE VALUES vs NULL PRESERVATION');
  console.log('=' .repeat(80));

  // Load files
  const originalFile = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const cleanedFile = path.join(__dirname, 'canonical_data_cleaned', 'adp', 'adp0_2025.csv');
  
  const originalContent = fs.readFileSync(originalFile, 'utf8');
  const cleanedContent = fs.readFileSync(cleanedFile, 'utf8');
  
  // Parse both ways
  const withFakeValues = parseCSV(cleanedContent);
  const withNulls = parseWithNulls(originalContent);
  
  console.log('\n📊 APPROACH 1: FAKE VALUES (Current)');
  console.log('-' .repeat(40));
  
  // Calculate statistics with fake values
  const fakeADPs = withFakeValues.map(r => parseFloat(r['ADP'])).filter(v => !isNaN(v));
  const fakeAuctions = withFakeValues.map(r => parseFloat(r['Auction Value'])).filter(v => !isNaN(v));
  
  const avgFakeADP = fakeADPs.reduce((sum, v) => sum + v, 0) / fakeADPs.length;
  const avgFakeAuction = fakeAuctions.reduce((sum, v) => sum + v, 0) / fakeAuctions.length;
  
  // Count distortions
  const undraftedCount = fakeADPs.filter(v => v === 999).length;
  const zeroAuctionCount = fakeAuctions.filter(v => v === 0).length;
  
  console.log(`Total rows: ${withFakeValues.length}`);
  console.log(`Average ADP: ${avgFakeADP.toFixed(1)} ⚠️ (distorted by ${undraftedCount} fake 999s)`);
  console.log(`Average Auction: $${avgFakeAuction.toFixed(2)} ⚠️ (distorted by ${zeroAuctionCount} fake $0s)`);
  
  // Show distortion examples
  console.log('\n⚠️  Data Distortion Examples:');
  console.log(`  - Players with ADP=999: ${undraftedCount} (artificially inflates average)`);
  console.log(`  - Players with Auction=$0: ${zeroAuctionCount} (artificially lowers average)`);
  
  // Calculate tier boundaries with fake data
  const sortedByADP = [...fakeADPs].sort((a, b) => a - b);
  const tier1Boundary = sortedByADP[Math.floor(sortedByADP.length * 0.1)];
  const tier2Boundary = sortedByADP[Math.floor(sortedByADP.length * 0.25)];
  
  console.log(`\nTier boundaries (with fake data):`);
  console.log(`  Tier 1: ADP < ${tier1Boundary.toFixed(1)}`);
  console.log(`  Tier 2: ADP < ${tier2Boundary.toFixed(1)}`);
  
  console.log('\n📊 APPROACH 2: NULL PRESERVATION (Recommended)');
  console.log('-' .repeat(40));
  
  // Calculate statistics properly with nulls
  const validADPs = withNulls
    .map(r => r['ADP'])
    .filter(v => v !== null);
  
  const validAuctions = withNulls
    .map(r => r['Auction Value'])
    .filter(v => v !== null);
  
  const avgRealADP = validADPs.length > 0 
    ? validADPs.reduce((sum, v) => sum + v, 0) / validADPs.length
    : null;
  
  const avgRealAuction = validAuctions.length > 0
    ? validAuctions.reduce((sum, v) => sum + v, 0) / validAuctions.length
    : null;
  
  console.log(`Total rows: ${withNulls.length}`);
  console.log(`Rows with ADP: ${validADPs.length} (${((validADPs.length/withNulls.length)*100).toFixed(1)}%)`);
  console.log(`Rows with Auction: ${validAuctions.length} (${((validAuctions.length/withNulls.length)*100).toFixed(1)}%)`);
  console.log(`Average ADP: ${avgRealADP?.toFixed(1) || 'N/A'} ✅ (only real values)`);
  console.log(`Average Auction: $${avgRealAuction?.toFixed(2) || 'N/A'} ✅ (only real values)`);
  
  // Calculate tier boundaries with real data only
  const realSortedADP = [...validADPs].sort((a, b) => a - b);
  const realTier1 = realSortedADP[Math.floor(realSortedADP.length * 0.1)];
  const realTier2 = realSortedADP[Math.floor(realSortedADP.length * 0.25)];
  
  console.log(`\nTier boundaries (real data only):`);
  console.log(`  Tier 1: ADP < ${realTier1.toFixed(1)}`);
  console.log(`  Tier 2: ADP < ${realTier2.toFixed(1)}`);
  
  console.log('\n🔍 IMPACT ANALYSIS');
  console.log('-' .repeat(40));
  
  const adpDistortion = Math.abs(avgFakeADP - avgRealADP);
  const auctionDistortion = Math.abs(avgFakeAuction - avgRealAuction);
  const adpDistortionPct = (adpDistortion / avgRealADP) * 100;
  const auctionDistortionPct = (auctionDistortion / avgRealAuction) * 100;
  
  console.log(`\n📈 Statistical Distortion:`);
  console.log(`  ADP Average:`);
  console.log(`    - With fake 999s: ${avgFakeADP.toFixed(1)}`);
  console.log(`    - Real data only: ${avgRealADP.toFixed(1)}`);
  console.log(`    - Distortion: ${adpDistortion.toFixed(1)} (${adpDistortionPct.toFixed(1)}% error)`);
  
  console.log(`\n  Auction Average:`);
  console.log(`    - With fake $0s: $${avgFakeAuction.toFixed(2)}`);
  console.log(`    - Real data only: $${avgRealAuction.toFixed(2)}`);
  console.log(`    - Distortion: $${auctionDistortion.toFixed(2)} (${auctionDistortionPct.toFixed(1)}% error)`);
  
  console.log('\n⚠️  FANTASY FOOTBALL IMPACTS:');
  console.log('-' .repeat(40));
  
  console.log('\nWith Fake Values (Problems):');
  console.log('  ❌ Value calculations skewed by fake $0s');
  console.log('  ❌ Draft position analysis includes fake 999s');
  console.log('  ❌ Tier boundaries shifted by artificial data');
  console.log('  ❌ Cannot distinguish "no data" from "actual zero value"');
  console.log('  ❌ Statistical models trained on partially fake data');
  
  console.log('\nWith Null Preservation (Benefits):');
  console.log('  ✅ Accurate averages from real data only');
  console.log('  ✅ Proper statistical significance');
  console.log('  ✅ Clear data completeness visibility');
  console.log('  ✅ Honest about what we know vs don\'t know');
  console.log('  ✅ Better decision-making with real data');
  
  // Example query differences
  console.log('\n💡 EXAMPLE QUERIES:');
  console.log('-' .repeat(40));
  
  console.log('\nQuery: "What\'s the average auction value for WRs?"');
  
  const wrsFake = withFakeValues.filter(p => p.Position === 'WR');
  const wrsReal = withNulls.filter(p => p.Position === 'WR');
  
  const avgWRFake = wrsFake
    .map(p => parseFloat(p['Auction Value']))
    .filter(v => !isNaN(v))
    .reduce((sum, v, _, arr) => sum + v/arr.length, 0);
  
  const validWRAuctions = wrsReal
    .map(p => p['Auction Value'])
    .filter(v => v !== null);
  
  const avgWRReal = validWRAuctions.length > 0
    ? validWRAuctions.reduce((sum, v) => sum + v, 0) / validWRAuctions.length
    : null;
  
  console.log(`  With fake values: $${avgWRFake.toFixed(2)} (includes many fake $0s)`);
  console.log(`  With nulls: $${avgWRReal?.toFixed(2) || 'N/A'} (only ${validWRAuctions.length} WRs with real auction data)`);
  
  console.log('\n' + '=' .repeat(80));
  console.log('RECOMMENDATION');
  console.log('=' .repeat(80));
  
  console.log('\n✅ Use NULL preservation approach because:');
  console.log('  1. No fake data polluting analysis');
  console.log('  2. Statistical integrity maintained');
  console.log('  3. Clear about data completeness');
  console.log('  4. Better fantasy football decisions');
  console.log('  5. Follows data science best practices');
  
  return {
    fakeValuesStats: {
      avgADP: avgFakeADP,
      avgAuction: avgFakeAuction,
      distortedRows: undraftedCount + zeroAuctionCount
    },
    nullPreservingStats: {
      avgADP: avgRealADP,
      avgAuction: avgRealAuction,
      completeRows: validADPs.length
    }
  };
}

// Run comparison
compareApproaches().catch(console.error);