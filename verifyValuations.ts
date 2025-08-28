/**
 * Verification Script for Fantasy Football Valuation Model
 * 
 * This script performs a comprehensive verification of the valuation model by:
 * 1. Loading raw CSV data for random players
 * 2. Manually calculating all evaluation metrics step-by-step
 * 3. Comparing manual calculations with the website's calculated values
 * 4. Reporting discrepancies greater than 0.01%
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

// Import the actual model to compare against
import { CalibratedValuationModel } from './src/lib/calibratedValuationModel';
import { calibratedValuationService } from './src/lib/calibratedValuationService';
import { dataService } from './src/lib/dataService';

interface RawPlayerData {
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
  adp?: number;
  auctionValue?: number;
  age?: number;
}

interface ManualCalculation {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  projectedPoints: number;
  
  // Step-by-step calculations
  positionRank: number;
  replacementPoints: number;
  vbd: number;
  
  // Financial calculations
  totalBudget: number;
  totalRosterSpots: number;
  discretionaryBudget: number;
  totalLeagueVBD: number;
  dollarsPerVBD: number;
  baseValue: number;
  
  // Adjustments
  marketAdjustment: number;
  tierAdjustment: number;
  rawValue: number;
  auctionValue: number;
  
  // Additional metrics
  confidence: number;
  maxBid: number;
  targetBid: number;
  minBid: number;
  
  // Market comparison
  marketPrice: number;
  edge: number;
  edgePercentage: number;
}

interface VerificationResult {
  playerName: string;
  position: string;
  metric: string;
  manualValue: number;
  modelValue: number;
  difference: number;
  differencePercentage: number;
  passed: boolean;
}

class ValuationVerifier {
  private readonly TOLERANCE = 0.0001; // 0.01% tolerance
  private readonly SAMPLE_SIZE = 100;
  
  // League settings (must match model)
  private readonly leagueSettings = {
    teams: 12,
    budget: 200,
    rosterSize: 16,
    starters: {
      QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1
    }
  };
  
  // Replacement ranks (must match model)
  private readonly replacementRanks = {
    QB: 15, RB: 48, WR: 60, TE: 18, DST: 14, K: 13
  };
  
  // Market adjustments (must match model)
  private readonly marketAdjustments = {
    QB: 0.85, RB: 1.15, WR: 1.00, TE: 0.90, DST: 0.50, K: 0.45
  };
  
  // Tier multipliers (must match model)
  private readonly tierMultipliers = {
    elite: { ranks: [1, 3], multiplier: 1.20 },
    tier1: { ranks: [4, 8], multiplier: 1.10 },
    tier2: { ranks: [9, 16], multiplier: 1.00 },
    tier3: { ranks: [17, 24], multiplier: 0.92 },
    tier4: { ranks: [25, 36], multiplier: 0.85 },
    replacement: { ranks: [37, 999], multiplier: 0.75 }
  };

  async loadRawData(): Promise<RawPlayerData[]> {
    console.log('\n📂 Loading raw data from CSV files...');
    
    const projectionFiles = [
      'artifacts/clean_data/projections_2025.csv',
      'artifacts/clean_data/FantasyPros_Fantasy_Football_Projections_FLX.csv',
      'artifacts/clean_data/FantasyPros_Fantasy_Football_Projections_RB.csv',
      'artifacts/clean_data/FantasyPros_Fantasy_Football_Projections_WR.csv',
      'artifacts/clean_data/FantasyPros_Fantasy_Football_Projections_TE.csv'
    ];
    
    const allPlayers: RawPlayerData[] = [];
    
    // Load projections from main file
    try {
      const mainProjections = fs.readFileSync(
        path.join(process.cwd(), projectionFiles[0]), 
        'utf-8'
      );
      
      const parsed = Papa.parse(mainProjections, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });
      
      parsed.data.forEach((row: any) => {
        // Handle different column name formats
        const name = row.playerName || row.name || row.Player;
        const position = row.position || row.Position || row.Pos;
        const team = row.teamName || row.team || row.Team || '';
        const points = parseFloat(row.fantasyPoints || row.projectedPoints || row.Points || 0);
        
        if (name && position && points > 0) {
          allPlayers.push({
            name: name,
            position: position,
            team: team,
            projectedPoints: points,
            adp: row.adp ? parseFloat(row.adp) : undefined,
            auctionValue: row.auctionValue ? parseFloat(row.auctionValue) : 
                         row.ESPN_AAV ? parseFloat(row.ESPN_AAV) : undefined,
            age: row.age ? parseInt(row.age) : undefined
          });
        }
      });
      
      console.log(`✓ Loaded ${allPlayers.length} players from projections`);
    } catch (error) {
      console.error('Error loading projections:', error);
    }
    
    return allPlayers;
  }

  calculateManualValuation(
    player: RawPlayerData, 
    allPlayers: RawPlayerData[]
  ): ManualCalculation {
    console.log(`\n🔍 Manual calculation for ${player.name} (${player.position})`);
    
    // Step 1: Calculate position rank
    const positionPlayers = allPlayers
      .filter(p => p.position === player.position)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    const positionRank = positionPlayers.findIndex(
      p => p.name === player.name && p.team === player.team
    ) + 1;
    
    console.log(`  Position Rank: ${positionRank} of ${positionPlayers.length}`);
    
    // Step 2: Get replacement level points
    const replacementRank = this.replacementRanks[player.position] || 50;
    const replacementPoints = positionPlayers[replacementRank - 1]?.projectedPoints || 0;
    
    console.log(`  Replacement Points (${player.position}${replacementRank}): ${replacementPoints.toFixed(2)}`);
    
    // Step 3: Calculate VBD
    const vbd = Math.max(0, player.projectedPoints - replacementPoints);
    
    console.log(`  VBD: ${player.projectedPoints.toFixed(2)} - ${replacementPoints.toFixed(2)} = ${vbd.toFixed(2)}`);
    
    // Step 4: Calculate base value using discretionary dollar method
    const totalBudget = this.leagueSettings.teams * this.leagueSettings.budget;
    const totalRosterSpots = this.leagueSettings.teams * this.leagueSettings.rosterSize;
    const discretionaryBudget = totalBudget - totalRosterSpots;
    
    console.log(`  Total Budget: $${totalBudget} (${this.leagueSettings.teams} × $${this.leagueSettings.budget})`);
    console.log(`  Discretionary Budget: $${discretionaryBudget} ($${totalBudget} - $${totalRosterSpots})`);
    
    // Calculate total league VBD for rosterable players
    const rosterLimits = {
      QB: 24, RB: 60, WR: 72, TE: 24, DST: 16, K: 14
    };
    
    let totalLeagueVBD = 0;
    Object.entries(rosterLimits).forEach(([pos, limit]) => {
      const topAtPosition = allPlayers
        .filter(p => p.position === pos)
        .sort((a, b) => b.projectedPoints - a.projectedPoints)
        .slice(0, limit);
      
      const replacementPts = allPlayers
        .filter(p => p.position === pos)
        .sort((a, b) => b.projectedPoints - a.projectedPoints)[this.replacementRanks[pos] - 1]?.projectedPoints || 0;
      
      topAtPosition.forEach(p => {
        const pVBD = Math.max(0, p.projectedPoints - replacementPts);
        totalLeagueVBD += pVBD;
      });
    });
    
    console.log(`  Total League VBD: ${totalLeagueVBD.toFixed(2)}`);
    
    const dollarsPerVBD = discretionaryBudget / totalLeagueVBD;
    console.log(`  Dollars per VBD: $${dollarsPerVBD.toFixed(4)}`);
    
    const baseValue = 1 + (vbd * dollarsPerVBD);
    console.log(`  Base Value: $1 + (${vbd.toFixed(2)} × $${dollarsPerVBD.toFixed(4)}) = $${baseValue.toFixed(2)}`);
    
    // Step 5: Apply market adjustment
    const marketAdjustment = this.marketAdjustments[player.position] || 1.0;
    console.log(`  Market Adjustment (${player.position}): ${(marketAdjustment * 100).toFixed(0)}%`);
    
    // Step 6: Apply tier adjustment
    let tierAdjustment = 0.75;
    for (const tier of Object.values(this.tierMultipliers)) {
      if (positionRank >= tier.ranks[0] && positionRank <= tier.ranks[1]) {
        tierAdjustment = tier.multiplier;
        break;
      }
    }
    console.log(`  Tier Adjustment (Rank ${positionRank}): ${(tierAdjustment * 100).toFixed(0)}%`);
    
    // Step 7: Calculate final auction value
    const rawValue = baseValue * marketAdjustment * tierAdjustment;
    const auctionValue = Math.max(1, Math.round(rawValue));
    
    console.log(`  Raw Value: $${baseValue.toFixed(2)} × ${marketAdjustment} × ${tierAdjustment} = $${rawValue.toFixed(2)}`);
    console.log(`  Final Auction Value: $${auctionValue}`);
    
    // Step 8: Calculate confidence
    let confidence = 0.75;
    if (positionRank <= 5) confidence += 0.15;
    else if (positionRank <= 12) confidence += 0.10;
    else if (positionRank <= 24) confidence += 0.05;
    
    if (player.age && player.age > 30) confidence -= 0.10;
    if (player.age && player.age > 32) confidence -= 0.05;
    
    confidence = Math.max(0.5, Math.min(1.0, confidence));
    console.log(`  Confidence: ${(confidence * 100).toFixed(0)}%`);
    
    // Step 9: Calculate bid ranges
    const maxBid = Math.max(1, Math.round(auctionValue * 1.15));
    const targetBid = auctionValue;
    const minBid = Math.max(1, Math.round(auctionValue * 0.85));
    
    console.log(`  Bid Range: $${minBid} - $${targetBid} - $${maxBid}`);
    
    // Step 10: Market price and edge calculation
    const marketPrice = player.auctionValue || Math.min(2, Math.max(1, Math.round(auctionValue * 0.5)));
    const edge = auctionValue - marketPrice;
    const edgePercentage = marketPrice > 0 ? (edge / marketPrice) * 100 : 0;
    
    console.log(`  Market Price: $${marketPrice}`);
    console.log(`  Edge: $${edge} (${edgePercentage.toFixed(1)}%)`);
    
    return {
      playerId: `${player.name}-${player.position}-${player.team}`,
      playerName: player.name,
      position: player.position,
      team: player.team,
      projectedPoints: player.projectedPoints,
      positionRank,
      replacementPoints,
      vbd,
      totalBudget,
      totalRosterSpots,
      discretionaryBudget,
      totalLeagueVBD,
      dollarsPerVBD,
      baseValue,
      marketAdjustment,
      tierAdjustment,
      rawValue,
      auctionValue,
      confidence,
      maxBid,
      targetBid,
      minBid,
      marketPrice,
      edge,
      edgePercentage
    };
  }

  async compareWithModel(
    manualCalc: ManualCalculation,
    modelValuations: any[]
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    
    // Find matching player in model valuations
    const modelPlayer = modelValuations.find(
      v => v.playerName === manualCalc.playerName && 
           v.position === manualCalc.position &&
           v.team === manualCalc.team
    );
    
    if (!modelPlayer) {
      console.log(`⚠️ Player ${manualCalc.playerName} not found in model valuations`);
      return results;
    }
    
    // Compare each metric
    const comparisons = [
      { metric: 'Position Rank', manual: manualCalc.positionRank, model: modelPlayer.positionRank },
      { metric: 'VBD', manual: manualCalc.vbd, model: modelPlayer.vbd },
      { metric: 'Auction Value', manual: manualCalc.auctionValue, model: modelPlayer.auctionValue },
      { metric: 'Max Bid', manual: manualCalc.maxBid, model: modelPlayer.maxBid },
      { metric: 'Target Bid', manual: manualCalc.targetBid, model: modelPlayer.targetBid },
      { metric: 'Min Bid', manual: manualCalc.minBid, model: modelPlayer.minBid },
      { metric: 'Market Price', manual: manualCalc.marketPrice, model: modelPlayer.marketPrice || modelPlayer.marketValue },
      { metric: 'Edge', manual: manualCalc.edge, model: modelPlayer.edge },
      { metric: 'Confidence', manual: manualCalc.confidence, model: modelPlayer.confidence }
    ];
    
    comparisons.forEach(comp => {
      // Skip comparison if either value is undefined
      if (comp.manual === undefined || comp.model === undefined) {
        console.log(`  ⚠️ ${comp.metric}: Skipped (undefined value)`);
        return;
      }
      
      const difference = Math.abs(comp.manual - comp.model);
      const differencePercentage = comp.model !== 0 
        ? (difference / Math.abs(comp.model)) * 100 
        : (difference > 0 ? 100 : 0);
      
      const passed = differencePercentage <= this.TOLERANCE * 100;
      
      results.push({
        playerName: manualCalc.playerName,
        position: manualCalc.position,
        metric: comp.metric,
        manualValue: comp.manual,
        modelValue: comp.model,
        difference,
        differencePercentage,
        passed
      });
      
      if (!passed) {
        console.log(`  ❌ ${comp.metric}: Manual=${comp.manual.toFixed(2)}, Model=${comp.model.toFixed(2)}, Diff=${differencePercentage.toFixed(2)}%`);
      }
    });
    
    return results;
  }

  async runVerification() {
    console.log('=' .repeat(80));
    console.log('FANTASY FOOTBALL VALUATION MODEL VERIFICATION');
    console.log('=' .repeat(80));
    console.log(`\nTolerance: ${(this.TOLERANCE * 100).toFixed(2)}%`);
    console.log(`Sample Size: ${this.SAMPLE_SIZE} random players`);
    console.log('=' .repeat(80));
    
    // Load raw data
    const allPlayers = await this.loadRawData();
    
    if (allPlayers.length === 0) {
      console.error('❌ No player data loaded');
      return;
    }
    
    // Get random sample
    const sample: RawPlayerData[] = [];
    const usedIndices = new Set<number>();
    
    while (sample.length < Math.min(this.SAMPLE_SIZE, allPlayers.length)) {
      const idx = Math.floor(Math.random() * allPlayers.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        sample.push(allPlayers[idx]);
      }
    }
    
    console.log(`\n📊 Selected ${sample.length} random players for verification`);
    
    // Initialize model and get valuations
    const model = new CalibratedValuationModel();
    const modelInput = allPlayers.map((p, idx) => ({
      id: `player-${idx}`,
      name: p.name,
      position: p.position,
      team: p.team,
      projectedPoints: p.projectedPoints,
      adp: p.adp || 250,
      age: p.age
    }));
    
    const modelResult = model.processAllPlayers(modelInput);
    const modelValuations = modelResult.valuations;
    
    // Run verification for each sample player
    const allResults: VerificationResult[] = [];
    let playerCount = 0;
    
    for (const player of sample) {
      playerCount++;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Player ${playerCount}/${sample.length}`);
      console.log(`${'='.repeat(60)}`);
      
      const manualCalc = this.calculateManualValuation(player, allPlayers);
      const comparisonResults = await this.compareWithModel(manualCalc, modelValuations);
      allResults.push(...comparisonResults);
    }
    
    // Generate summary report
    this.generateReport(allResults);
  }

  generateReport(results: VerificationResult[]) {
    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION SUMMARY REPORT');
    console.log('='.repeat(80));
    
    // Overall statistics
    const totalComparisons = results.length;
    const passedComparisons = results.filter(r => r.passed).length;
    const failedComparisons = totalComparisons - passedComparisons;
    const passRate = (passedComparisons / totalComparisons) * 100;
    
    console.log(`\n📈 Overall Statistics:`);
    console.log(`   Total Comparisons: ${totalComparisons}`);
    console.log(`   Passed: ${passedComparisons} (${passRate.toFixed(2)}%)`);
    console.log(`   Failed: ${failedComparisons} (${(100 - passRate).toFixed(2)}%)`);
    
    // Metric-wise analysis
    const metricStats = new Map<string, {passed: number, failed: number, avgDiff: number}>();
    
    results.forEach(r => {
      if (!metricStats.has(r.metric)) {
        metricStats.set(r.metric, {passed: 0, failed: 0, avgDiff: 0});
      }
      const stat = metricStats.get(r.metric)!;
      if (r.passed) {
        stat.passed++;
      } else {
        stat.failed++;
      }
      stat.avgDiff += r.differencePercentage;
    });
    
    console.log(`\n📊 Metric-wise Analysis:`);
    console.log('   ' + '-'.repeat(60));
    console.log('   Metric                  | Pass Rate | Avg Diff %');
    console.log('   ' + '-'.repeat(60));
    
    metricStats.forEach((stat, metric) => {
      const total = stat.passed + stat.failed;
      const passRate = (stat.passed / total) * 100;
      const avgDiff = stat.avgDiff / total;
      
      console.log(`   ${metric.padEnd(23)} | ${passRate.toFixed(1).padStart(8)}% | ${avgDiff.toFixed(4).padStart(10)}%`);
    });
    
    // Position-wise analysis
    const positionStats = new Map<string, {passed: number, failed: number}>();
    
    results.forEach(r => {
      if (!positionStats.has(r.position)) {
        positionStats.set(r.position, {passed: 0, failed: 0});
      }
      const stat = positionStats.get(r.position)!;
      if (r.passed) {
        stat.passed++;
      } else {
        stat.failed++;
      }
    });
    
    console.log(`\n🏈 Position-wise Analysis:`);
    console.log('   ' + '-'.repeat(40));
    console.log('   Position | Pass Rate | Total Tests');
    console.log('   ' + '-'.repeat(40));
    
    positionStats.forEach((stat, position) => {
      const total = stat.passed + stat.failed;
      const passRate = (stat.passed / total) * 100;
      
      console.log(`   ${position.padEnd(8)} | ${passRate.toFixed(1).padStart(8)}% | ${total.toString().padStart(11)}`);
    });
    
    // Failed comparisons detail (top discrepancies)
    const failedResults = results.filter(r => !r.passed)
      .sort((a, b) => b.differencePercentage - a.differencePercentage)
      .slice(0, 10);
    
    if (failedResults.length > 0) {
      console.log(`\n⚠️ Top Discrepancies (> ${(this.TOLERANCE * 100).toFixed(2)}%):`);
      console.log('   ' + '-'.repeat(75));
      console.log('   Player                 | Metric         | Manual | Model | Diff %');
      console.log('   ' + '-'.repeat(75));
      
      failedResults.forEach(r => {
        console.log(
          `   ${r.playerName.substring(0, 22).padEnd(22)} | ` +
          `${r.metric.substring(0, 14).padEnd(14)} | ` +
          `${r.manualValue.toFixed(1).padStart(6)} | ` +
          `${r.modelValue.toFixed(1).padStart(5)} | ` +
          `${r.differencePercentage.toFixed(2).padStart(6)}%`
        );
      });
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(80));
    if (passRate >= 99.99) {
      console.log('✅ VERIFICATION PASSED: All calculations match within tolerance');
    } else if (passRate >= 95) {
      console.log('⚠️ VERIFICATION MOSTLY PASSED: Minor discrepancies detected');
    } else {
      console.log('❌ VERIFICATION FAILED: Significant discrepancies detected');
    }
    console.log('='.repeat(80));
  }
}

// Run the verification
async function main() {
  const verifier = new ValuationVerifier();
  await verifier.runVerification();
}

main().catch(console.error);