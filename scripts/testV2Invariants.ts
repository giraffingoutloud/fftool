/**
 * Test V2 Valuation Model Invariants
 * 
 * Checks if the V2 model maintains critical invariants:
 * 1. Budget Conservation: Top 192 players should sum to ~$2400 (±5%)
 * 2. Position Distribution: Should match expected percentages
 * 3. No negative values
 * 4. Reasonable value ranges by position
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { CalibratedValuationModel } from '../src/lib/calibratedValuationModel'; // V2.1 PRODUCTION
import { CalibratedValuationModelV2 } from '../src/lib/calibratedValuationModelV2'; // V2.0 DEPRECATED

interface PlayerData {
  id: string;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
  adp?: number;
  age?: number;
  marketValue?: number;
}

class V2InvariantTester {
  private v1Model = new CalibratedValuationModel(); // V2.1 PRODUCTION
  private v2Model = new CalibratedValuationModelV2(); // V2.0 DEPRECATED
  private players: PlayerData[] = [];
  
  // Invariant thresholds
  private readonly BUDGET_TOTAL = 2400; // 12 teams × $200
  private readonly ROSTER_SIZE = 192;   // 12 teams × 16 players
  private readonly BUDGET_TOLERANCE = 0.05; // ±5%
  
  // Expected position distribution (from research)
  private readonly EXPECTED_DISTRIBUTION = {
    QB: { min: 0.05, max: 0.10, target: 0.07 },
    RB: { min: 0.45, max: 0.50, target: 0.48 },
    WR: { min: 0.35, max: 0.40, target: 0.37 },
    TE: { min: 0.05, max: 0.10, target: 0.07 },
    DST: { min: 0.005, max: 0.015, target: 0.01 },
    K: { min: 0.005, max: 0.01, target: 0.005 }
  };

  async loadData(): Promise<void> {
    console.log('📂 Loading player data...\n');
    
    const filePath = path.join('artifacts/clean_data/projections_2025_with_adp.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    const parsed = Papa.parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
    
    this.players = parsed.data.map((row: any, idx: number) => ({
      id: `player-${idx}`,
      name: row.playerName,
      position: row.position?.toUpperCase(),
      team: row.teamName,
      projectedPoints: parseFloat(row.fantasyPoints) || 0,
      adp: row.adp ? parseFloat(row.adp) : undefined,
      age: row.age ? parseInt(row.age) : undefined,
      marketValue: row.marketValue ? parseFloat(row.marketValue) : undefined
    }));
    
    console.log(`✓ Loaded ${this.players.length} players\n`);
  }

  testModel(model: any, modelName: string): void {
    console.log('=' .repeat(60));
    console.log(`Testing ${modelName}`);
    console.log('=' .repeat(60) + '\n');
    
    // Process all players
    const result = model.processAllPlayers(this.players);
    const valuations = result.valuations;
    
    // Sort by value
    valuations.sort((a, b) => b.auctionValue - a.auctionValue);
    
    // Test 1: Budget Conservation
    console.log('📊 TEST 1: Budget Conservation');
    console.log('─'.repeat(40));
    
    const top192 = valuations.slice(0, this.ROSTER_SIZE);
    const totalValue = top192.reduce((sum, p) => sum + p.auctionValue, 0);
    const budgetPercentage = (totalValue / this.BUDGET_TOTAL) * 100;
    const budgetPassed = Math.abs(budgetPercentage - 100) <= (this.BUDGET_TOLERANCE * 100);
    
    console.log(`   Total Value (top 192): $${totalValue}`);
    console.log(`   Expected: $${this.BUDGET_TOTAL}`);
    console.log(`   Percentage: ${budgetPercentage.toFixed(1)}%`);
    console.log(`   Status: ${budgetPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Test 2: No Negative Values
    console.log('\n📊 TEST 2: No Negative Values');
    console.log('─'.repeat(40));
    
    const negativeValues = valuations.filter(v => v.auctionValue < 0);
    const noNegativesPassed = negativeValues.length === 0;
    
    console.log(`   Players with negative values: ${negativeValues.length}`);
    console.log(`   Status: ${noNegativesPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (negativeValues.length > 0) {
      negativeValues.slice(0, 5).forEach(p => {
        console.log(`     - ${p.playerName}: $${p.auctionValue}`);
      });
    }
    
    // Test 3: Position Distribution
    console.log('\n📊 TEST 3: Position Distribution');
    console.log('─'.repeat(40));
    
    const starterCounts = {
      QB: 12,
      RB: 30,  // 24 starters + 6 flex
      WR: 36,  // 24 starters + 12 flex  
      TE: 12,
      DST: 12,
      K: 12
    };
    
    const positionTotals: Record<string, number> = {};
    let distributionPassed = true;
    
    Object.entries(starterCounts).forEach(([pos, count]) => {
      const topAtPosition = valuations
        .filter(v => v.position === pos)
        .slice(0, count);
      
      const total = topAtPosition.reduce((sum, p) => sum + p.auctionValue, 0);
      positionTotals[pos] = total;
    });
    
    const grandTotal = Object.values(positionTotals).reduce((a, b) => a + b, 0);
    
    console.log('   Position | $ Total | % of Budget | Expected | Status');
    console.log('   ─────────────────────────────────────────────────────');
    
    Object.entries(positionTotals).forEach(([pos, total]) => {
      const percentage = (total / grandTotal);
      const expected = this.EXPECTED_DISTRIBUTION[pos];
      const inRange = percentage >= expected.min && percentage <= expected.max;
      
      if (!inRange) distributionPassed = false;
      
      console.log(
        `   ${pos.padEnd(8)} | $${total.toString().padStart(5)} | ` +
        `${(percentage * 100).toFixed(1).padStart(10)}% | ` +
        `${(expected.min * 100).toFixed(0)}-${(expected.max * 100).toFixed(0)}% | ` +
        `${inRange ? '✅' : '❌'}`
      );
    });
    
    console.log(`\n   Overall Distribution: ${distributionPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Test 4: Value Ranges
    console.log('\n📊 TEST 4: Reasonable Value Ranges');
    console.log('─'.repeat(40));
    
    const maxByPosition = {};
    const unreasonable = [];
    
    ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].forEach(pos => {
      const posPlayers = valuations.filter(v => v.position === pos);
      if (posPlayers.length > 0) {
        const max = Math.max(...posPlayers.map(p => p.auctionValue));
        const min = Math.min(...posPlayers.filter(p => p.auctionValue > 0).map(p => p.auctionValue));
        maxByPosition[pos] = { max, min };
        
        // Check for unreasonable values
        const expectedMax = { QB: 45, RB: 80, WR: 75, TE: 40, DST: 5, K: 3 }[pos];
        if (max > expectedMax) {
          unreasonable.push(`${pos}: $${max} (expected <$${expectedMax})`);
        }
      }
    });
    
    console.log('   Position | Min Value | Max Value | Reasonable?');
    console.log('   ─────────────────────────────────────────────');
    
    Object.entries(maxByPosition).forEach(([pos, range]: [string, any]) => {
      const expectedMax = { QB: 45, RB: 80, WR: 75, TE: 40, DST: 5, K: 3 }[pos];
      const reasonable = range.max <= expectedMax;
      
      console.log(
        `   ${pos.padEnd(8)} | $${range.min.toString().padStart(8)} | ` +
        `$${range.max.toString().padStart(8)} | ${reasonable ? '✅' : '❌'}`
      );
    });
    
    const rangesPassed = unreasonable.length === 0;
    console.log(`\n   Value Ranges: ${rangesPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Test 5: Top Player Sanity Check
    console.log('\n📊 TEST 5: Top Player Values');
    console.log('─'.repeat(40));
    
    console.log('   Top 10 Players:');
    valuations.slice(0, 10).forEach((p, idx) => {
      const marketStr = p.marketValue ? ` (Market: $${p.marketValue})` : '';
      console.log(
        `   ${(idx + 1).toString().padStart(2)}. ${p.playerName.padEnd(20)} ` +
        `${p.position.padEnd(3)} $${p.auctionValue}${marketStr}`
      );
    });
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('─'.repeat(60));
    
    const allTestsPassed = budgetPassed && noNegativesPassed && distributionPassed && rangesPassed;
    
    console.log(`Budget Conservation: ${budgetPassed ? '✅' : '❌'}`);
    console.log(`No Negatives: ${noNegativesPassed ? '✅' : '❌'}`);
    console.log(`Position Distribution: ${distributionPassed ? '✅' : '❌'}`);
    console.log(`Value Ranges: ${rangesPassed ? '✅' : '❌'}`);
    console.log('\n' + `${modelName}: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('═'.repeat(60) + '\n');
    
    return allTestsPassed;
  }

  compareModels(): void {
    console.log('\n' + '='.repeat(60));
    console.log('MODEL COMPARISON');
    console.log('='.repeat(60) + '\n');
    
    // Process with both models
    const v1Result = this.v1Model.processAllPlayers(this.players);
    const v2Result = this.v2Model.processAllPlayers(this.players);
    
    // Compare key metrics
    const v1Top192 = v1Result.valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, 192);
    const v2Top192 = v2Result.valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, 192);
    
    const v1Total = v1Top192.reduce((sum, p) => sum + p.auctionValue, 0);
    const v2Total = v2Top192.reduce((sum, p) => sum + p.auctionValue, 0);
    
    console.log('Metric                    | V1 Model   | V2 Model   | Difference');
    console.log('─'.repeat(65));
    console.log(`Total Value (Top 192)     | $${v1Total.toString().padStart(8)} | $${v2Total.toString().padStart(8)} | $${(v2Total - v1Total).toString().padStart(9)}`);
    console.log(`Budget %                  | ${(v1Total/2400*100).toFixed(1).padStart(8)}% | ${(v2Total/2400*100).toFixed(1).padStart(8)}% | ${((v2Total-v1Total)/2400*100).toFixed(1).padStart(9)}%`);
    
    // Compare specific players
    console.log('\nSample Player Comparisons:');
    console.log('─'.repeat(65));
    
    const samplePlayers = ['Ja\'Marr Chase', 'Bijan Robinson', 'Josh Allen', 'Travis Kelce', 'CeeDee Lamb'];
    
    samplePlayers.forEach(name => {
      const v1Player = v1Result.valuations.find(p => p.playerName.includes(name));
      const v2Player = v2Result.valuations.find(p => p.playerName.includes(name));
      
      if (v1Player && v2Player) {
        console.log(
          `${name.padEnd(20)} | $${v1Player.auctionValue.toString().padStart(8)} | ` +
          `$${v2Player.auctionValue.toString().padStart(8)} | ` +
          `${v2Player.auctionValue > v1Player.auctionValue ? '+' : ''}$${(v2Player.auctionValue - v1Player.auctionValue).toString().padStart(9)}`
        );
      }
    });
  }

  async run(): Promise<void> {
    console.log('=' .repeat(60));
    console.log('V2 MODEL INVARIANT TESTING');
    console.log('=' .repeat(60) + '\n');
    
    await this.loadData();
    
    // Test both models
    const v1Passed = this.testModel(this.v1Model, 'V2.1 Model (PRODUCTION)');
    const v2Passed = this.testModel(this.v2Model, 'V2.0 Model (DEPRECATED)');
    
    // Compare models
    this.compareModels();
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    console.log('FINAL VERDICT');
    console.log('='.repeat(60));
    
    if (v1Passed && !v2Passed) {
      console.log('✅ V2.1 Model (PRODUCTION) passes all invariants while V2.0 fails');
    } else if (v1Passed && v2Passed) {
      console.log('✅ Both models pass invariants');
    } else if (!v1Passed && v2Passed) {
      console.log('❌ V2.1 Model fails invariants - V2.0 is more stable');
    } else {
      console.log('⚠️ Both models have issues with invariants');
    }
    
    console.log('=' .repeat(60));
  }
}

// Run the test
async function main() {
  const tester = new V2InvariantTester();
  await tester.run();
}

main().catch(console.error);