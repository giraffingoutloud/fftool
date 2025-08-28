/**
 * Test script for the calibrated valuation model
 * Loads data, applies new model, and checks invariants
 */

import fs from 'fs';
import path from 'path';
import { parseCSVSafe } from '../src/lib/utils';
import { calibratedValuationModel } from '../src/lib/calibratedValuationModel';
import { valuationInvariantChecker } from '../src/lib/valuationInvariantChecker';
import type { PlayerData } from '../src/lib/calibratedValuationModel';

async function loadPlayerData(): Promise<PlayerData[]> {
  console.log('Loading player data from CSV files...');
  
  try {
    // Load projections
    const projectionsPath = path.join(process.cwd(), 'canonical_data', 'projections', 'projections_2025.csv');
    const projectionsData = fs.readFileSync(projectionsPath, 'utf8');
    const projections = parseCSVSafe(projectionsData);
    
    // Load ADP data
    const adpPath = path.join(process.cwd(), 'canonical_data', 'adp', 'adp0_2025.csv');
    const adpData = fs.readFileSync(adpPath, 'utf8');
    const adpRecords = parseCSVSafe(adpData);
    
    // Create ADP map
    const adpMap = new Map<string, { adp: number; age?: number; byeWeek?: number }>();
    adpRecords.forEach((record: any) => {
      const key = `${record.name?.toLowerCase()}_${record.position?.toLowerCase()}`;
      adpMap.set(key, {
        adp: parseFloat(record.adp) || 250,
        age: record.age ? parseInt(record.age) : undefined,
        byeWeek: record.byeWeek ? parseInt(record.byeWeek) : undefined
      });
    });
    
    // Process players
    const players: PlayerData[] = projections
      .map((proj: any, index: number) => {
        const position = (proj.position || '').toUpperCase();
        const name = proj.playerName || proj.name || '';
        const team = proj.teamName || proj.team || '';
        const projectedPoints = parseFloat(proj.fantasyPoints || proj.projectedPoints || 0);
        const byeWeek = proj.byeWeek ? parseInt(proj.byeWeek) : undefined;
        
        // Get ADP and additional data
        const adpKey = `${name.toLowerCase()}_${position.toLowerCase()}`;
        const adpData = adpMap.get(adpKey);
        
        return {
          id: `player_${index}`,
          name,
          position,
          team,
          projectedPoints,
          adp: adpData?.adp || 250,
          age: adpData?.age,
          byeWeek: byeWeek || adpData?.byeWeek
        };
      })
      .filter((p: PlayerData) => 
        p.name && 
        p.position && 
        ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].includes(p.position) &&
        p.projectedPoints > 0
      );
    
    console.log(`Loaded ${players.length} valid players`);
    
    // Show position breakdown
    const positionCounts = players.reduce((acc, p) => {
      acc[p.position] = (acc[p.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Position breakdown:', positionCounts);
    
    return players;
    
  } catch (error) {
    console.error('Error loading player data:', error);
    throw error;
  }
}

async function testCalibratedModel() {
  try {
    // Load player data
    const players = await loadPlayerData();
    
    // Process with calibrated model
    console.log('\n========================================');
    console.log('Testing Calibrated Valuation Model');
    console.log('========================================\n');
    
    const results = calibratedValuationModel.processAllPlayers(players);
    
    // Display validation results
    console.log('Budget Conservation Check:');
    console.log(`  Total Value: $${results.validation.budgetConservation.totalValue}`);
    console.log(`  Expected: $${results.validation.budgetConservation.expectedValue}`);
    console.log(`  Percentage: ${results.validation.budgetConservation.percentageOfBudget.toFixed(1)}%`);
    console.log(`  ✅ PASSED: ${results.validation.budgetConservation.passed}`);
    
    console.log('\nPositional Distribution Check:');
    Object.entries(results.validation.positionalDistribution.targets).forEach(([pos, target]) => {
      const actual = (target.actual * 100).toFixed(1);
      const min = (target.min * 100).toFixed(1);
      const max = (target.max * 100).toFixed(1);
      const inRange = target.actual >= target.min && target.actual <= target.max;
      console.log(`  ${pos}: ${actual}% (target: ${min}-${max}%) ${inRange ? '✅' : '❌'}`);
    });
    console.log(`  ✅ PASSED: ${results.validation.positionalDistribution.passed}`);
    
    // Display top values by position
    console.log('\nTop Values by Position:');
    Object.entries(results.summary.topValuesByPosition).forEach(([pos, data]) => {
      console.log(`  ${pos}: ${data.name} - $${data.value}`);
    });
    
    // Display average values
    console.log('\nAverage Values by Position:');
    Object.entries(results.summary.averageValues).forEach(([pos, avg]) => {
      console.log(`  ${pos}: $${avg.toFixed(2)}`);
    });
    
    // Now convert to format for invariant checker
    console.log('\n========================================');
    console.log('Running Invariant Checks');
    console.log('========================================\n');
    
    const playersForInvariants = results.valuations.map(v => ({
      id: v.playerId,
      name: v.playerName,
      position: v.position,
      team: '', // Not needed for invariants
      projectedPoints: v.projectedPoints,
      vorp: v.vbd, // VBD is equivalent to VORP in our model
      intrinsicValue: v.auctionValue,
      marketPrice: Math.max(1, Math.round(v.auctionValue * 0.9)), // Estimate market as 90% of intrinsic
      edge: Math.round(v.auctionValue * 0.1), // Estimate edge as 10%
      adp: 0, // Not needed for invariants
      confidence: v.confidence
    }));
    
    const invariantsReport = await valuationInvariantChecker.checkAllInvariants(playersForInvariants);
    
    // Create reports directory if needed
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Save calibrated model results
    const calibratedReportPath = path.join(reportsDir, 'calibrated_valuations.json');
    fs.writeFileSync(calibratedReportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      leagueSettings: calibratedValuationModel.getLeagueSettings(),
      validation: results.validation,
      summary: results.summary,
      topPlayers: results.valuations.slice(0, 50), // Top 50 players
      invariants: {
        budgetConservation: invariantsReport.invariants?.budgetConservation,
        replacementLevelZeroing: invariantsReport.invariants?.replacementLevelZeroing,
        nonNegativity: invariantsReport.invariants?.nonNegativity,
        monotonicity: invariantsReport.invariants?.monotonicity,
        positionalScarcity: invariantsReport.invariants?.positionalScarcity,
        maxBudgetShareCap: invariantsReport.invariants?.maxBudgetShareCap
      }
    }, null, 2));
    
    // Save full invariants report
    const invariantsPath = path.join(reportsDir, 'calibrated_invariants.json');
    fs.writeFileSync(invariantsPath, JSON.stringify(invariantsReport, null, 2));
    
    // Print summary
    console.log('Invariant Check Summary:');
    const invariantResults = invariantsReport.invariants || {};
    Object.entries(invariantResults).forEach(([name, result]: [string, any]) => {
      console.log(`  ${name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      if (!result.passed && result.message) {
        console.log(`    → ${result.message}`);
      }
    });
    
    const allPassed = Object.values(invariantResults).every((r: any) => r.passed);
    
    console.log('\n========================================');
    console.log('Final Results');
    console.log('========================================');
    console.log(`Model Validation: ${results.validation.budgetConservation.passed && results.validation.positionalDistribution.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Invariant Checks: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
    console.log(`\nReports saved to:`);
    console.log(`  - ${calibratedReportPath}`);
    console.log(`  - ${invariantsPath}`);
    
    // Export top 200 players as CSV for easy review
    const csvPath = path.join(reportsDir, 'calibrated_values.csv');
    const csvHeader = 'Rank,Name,Position,Team,Points,PositionRank,VBD,AuctionValue,MaxBid,TargetBid,MinBid,Confidence';
    const csvRows = results.valuations.slice(0, 200).map((v, i) => 
      `${i+1},${v.playerName},${v.position},,${v.projectedPoints.toFixed(1)},${v.positionRank},${v.vbd.toFixed(1)},${v.auctionValue},${v.maxBid},${v.targetBid},${v.minBid},${v.confidence.toFixed(2)}`
    );
    fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n'));
    console.log(`  - ${csvPath} (Top 200 players)`);
    
  } catch (error) {
    console.error('Error testing calibrated model:', error);
    process.exit(1);
  }
}

// Run the test
testCalibratedModel().catch(console.error);