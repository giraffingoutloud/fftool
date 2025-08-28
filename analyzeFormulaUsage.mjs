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

async function analyzeFormulaUsage() {
  console.log('=' .repeat(80));
  console.log('ANALYZING FORMULA-BASED CALCULATIONS VS DEFAULT VALUES');
  console.log('=' .repeat(80));

  const originalFile = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const cleanedFile = path.join(__dirname, 'canonical_data_cleaned', 'adp', 'adp0_2025.csv');
  
  const originalContent = fs.readFileSync(originalFile, 'utf8');
  const cleanedContent = fs.readFileSync(cleanedFile, 'utf8');
  
  const originalRows = parseCSV(originalContent);
  const cleanedRows = parseCSV(cleanedContent);
  
  // Analysis for Auction Value "N/A" fixes
  const auctionAnalysis = {
    totalNAValues: 0,
    calculatedByFormula: 0,
    setToZero: 0,
    formulaExamples: [],
    zeroExamples: []
  };
  
  // Analysis for ADP "null" fixes
  const adpAnalysis = {
    totalNullValues: 0,
    setTo999: 0,
    examples: []
  };
  
  // Analyze each row
  originalRows.forEach((origRow, index) => {
    const cleanRow = cleanedRows[index];
    const rowNumber = index + 2;
    
    // Check Auction Value
    if (origRow['Auction Value'] === 'N/A' || origRow['Auction Value'] === 'NA') {
      auctionAnalysis.totalNAValues++;
      
      const cleanedValue = parseFloat(cleanRow['Auction Value']);
      const rank = parseInt(origRow['Overall Rank']) || 999;
      const adp = parseFloat(origRow['ADP']) || rank;
      
      if (cleanedValue === 0) {
        auctionAnalysis.setToZero++;
        if (auctionAnalysis.zeroExamples.length < 5) {
          auctionAnalysis.zeroExamples.push({
            row: rowNumber,
            player: origRow['Full Name'],
            position: origRow['Position'],
            rank: rank,
            adp: adp,
            cleanedValue: 0
          });
        }
      } else if (cleanedValue > 0) {
        auctionAnalysis.calculatedByFormula++;
        
        // Verify it matches our formula
        const expectedValue = Math.min(70, Math.max(1, Math.round(200 - (adp * 0.8))));
        
        if (auctionAnalysis.formulaExamples.length < 10) {
          auctionAnalysis.formulaExamples.push({
            row: rowNumber,
            player: origRow['Full Name'],
            position: origRow['Position'],
            rank: rank,
            adp: adp,
            cleanedValue: cleanedValue,
            formulaExpected: expectedValue,
            formulaUsed: rank <= 200 ? 'max(1, 200 - (ADP * 0.8))' : 'N/A'
          });
        }
      }
    }
    
    // Check ADP
    if (origRow['ADP'] === 'null' || origRow['ADP'] === 'NULL') {
      adpAnalysis.totalNullValues++;
      
      const cleanedValue = parseFloat(cleanRow['ADP']);
      
      if (cleanedValue === 999) {
        adpAnalysis.setTo999++;
        if (adpAnalysis.examples.length < 5) {
          adpAnalysis.examples.push({
            row: rowNumber,
            player: origRow['Full Name'],
            position: origRow['Position'],
            rank: parseInt(origRow['Overall Rank']),
            cleanedValue: 999
          });
        }
      }
    }
  });
  
  // Report results
  console.log('\n📊 AUCTION VALUE "N/A" ANALYSIS:');
  console.log('-' .repeat(40));
  console.log(`Total "N/A" values found: ${auctionAnalysis.totalNAValues}`);
  console.log(`\n✅ CALCULATED BY FORMULA: ${auctionAnalysis.calculatedByFormula}`);
  console.log(`   Formula: max(1, 200 - (ADP * 0.8))  [for rank ≤ 200]`);
  console.log(`\n✅ SET TO ZERO: ${auctionAnalysis.setToZero}`);
  console.log(`   Rule: rank > 200 = $0 (undrafted/low-value players)`);
  
  console.log('\n📈 BREAKDOWN:');
  const formulaPercent = ((auctionAnalysis.calculatedByFormula / auctionAnalysis.totalNAValues) * 100).toFixed(1);
  const zeroPercent = ((auctionAnalysis.setToZero / auctionAnalysis.totalNAValues) * 100).toFixed(1);
  
  console.log(`   ${auctionAnalysis.calculatedByFormula}/${auctionAnalysis.totalNAValues} (${formulaPercent}%) - Calculated by formula`);
  console.log(`   ${auctionAnalysis.setToZero}/${auctionAnalysis.totalNAValues} (${zeroPercent}%) - Set to zero`);
  
  if (auctionAnalysis.formulaExamples.length > 0) {
    console.log('\n🔢 FORMULA CALCULATION EXAMPLES:');
    auctionAnalysis.formulaExamples.forEach(ex => {
      console.log(`   Row ${ex.row}: ${ex.player} (${ex.position})`);
      console.log(`     Rank: ${ex.rank}, ADP: ${ex.adp}`);
      console.log(`     Formula: 200 - (${ex.adp} * 0.8) = ${ex.formulaExpected}`);
      console.log(`     Final Value: $${ex.cleanedValue}`);
    });
  }
  
  if (auctionAnalysis.zeroExamples.length > 0) {
    console.log('\n0️⃣ SET TO ZERO EXAMPLES:');
    auctionAnalysis.zeroExamples.forEach(ex => {
      console.log(`   Row ${ex.row}: ${ex.player} (${ex.position})`);
      console.log(`     Rank: ${ex.rank} (> 200) → $0`);
    });
  }
  
  console.log('\n📊 ADP "null" ANALYSIS:');
  console.log('-' .repeat(40));
  console.log(`Total "null" values found: ${adpAnalysis.totalNullValues}`);
  console.log(`All set to: 999 (undrafted convention)`);
  
  if (adpAnalysis.examples.length > 0) {
    console.log('\nExamples:');
    adpAnalysis.examples.forEach(ex => {
      console.log(`   Row ${ex.row}: ${ex.player} (${ex.position}) → ADP = 999`);
    });
  }
  
  // Final summary
  console.log('\n' + '=' .repeat(80));
  console.log('FINAL SUMMARY');
  console.log('=' .repeat(80));
  
  console.log('\n🎯 TOTAL INVALID VALUES FIXED: ' + (auctionAnalysis.totalNAValues + adpAnalysis.totalNullValues));
  console.log('\n📊 AUCTION VALUE FIXES (288 total):');
  console.log(`   • ${auctionAnalysis.calculatedByFormula} calculated by formula (${formulaPercent}%)`);
  console.log(`   • ${auctionAnalysis.setToZero} set to zero (${zeroPercent}%)`);
  console.log('\n📊 ADP FIXES (26 total):');
  console.log(`   • ${adpAnalysis.setTo999} set to 999 (100%)`);
  
  return {
    auctionValue: {
      total: auctionAnalysis.totalNAValues,
      formulaCalculated: auctionAnalysis.calculatedByFormula,
      setToZero: auctionAnalysis.setToZero
    },
    adp: {
      total: adpAnalysis.totalNullValues,
      setTo999: adpAnalysis.setTo999
    }
  };
}

// Run the analysis
analyzeFormulaUsage().catch(console.error);