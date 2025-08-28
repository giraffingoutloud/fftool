/**
 * Simple script to run valuation invariant checks directly from CSV data
 * Outputs results to ./reports/invariants.json
 */

import fs from 'fs';
import path from 'path';
import { parseCSVSafe } from '../src/lib/utils';
import { valuationInvariantChecker } from '../src/lib/valuationInvariantChecker';

interface PlayerData {
  id: string;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
  vorp: number;
  intrinsicValue: number;
  marketPrice: number;
  edge: number;
  adp: number;
  confidence?: number;
}

async function loadProjectionData(): Promise<PlayerData[]> {
  try {
    // Load main projections CSV
    const projectionsPath = path.join(process.cwd(), 'canonical_data', 'projections', 'projections_2025.csv');
    const projectionsData = fs.readFileSync(projectionsPath, 'utf8');
    const projections = parseCSVSafe(projectionsData);
    
    // Load ADP data
    const adpPath = path.join(process.cwd(), 'canonical_data', 'adp', 'adp0_2025.csv');
    const adpData = fs.readFileSync(adpPath, 'utf8');
    const adpRecords = parseCSVSafe(adpData);
    
    // Create ADP map
    const adpMap = new Map<string, number>();
    adpRecords.forEach((record: any) => {
      const key = `${record.name?.toLowerCase()}_${record.position}`;
      adpMap.set(key, record.adp || 250);
    });
    
    // Define replacement levels
    const replacementLevels: Record<string, number> = {
      QB: 220,
      RB: 100,
      WR: 95,
      TE: 80,
      DST: 70,
      K: 110
    };
    
    // Position value multipliers
    const positionMultipliers: Record<string, number> = {
      QB: 0.85,
      RB: 1.15,
      WR: 1.10,
      TE: 0.95,
      DST: 0.50,
      K: 0.40
    };
    
    // Process players
    const players: PlayerData[] = projections.map((proj: any, index: number) => {
      const position = (proj.position || proj.Position || proj.POS || '').toUpperCase();
      const name = proj.playerName || proj.name || proj.Name || proj.Player || '';
      const team = proj.teamName || proj.team || proj.Team || proj.TEAM || '';
      const projectedPoints = parseFloat(proj.fantasyPoints || proj.projectedPoints || proj.fantasy_points || proj.FPTS || proj.Points || 0);
      
      // Get ADP
      const adpKey = `${name.toLowerCase()}_${position}`;
      const adp = adpMap.get(adpKey) || 250;
      
      // Calculate VORP
      const replacementLevel = replacementLevels[position] || 90;
      const vorp = Math.max(0, projectedPoints - replacementLevel);
      
      // Calculate intrinsic value
      const multiplier = positionMultipliers[position] || 1.0;
      const baseValue = Math.max(0, vorp * 0.2);
      const intrinsicValue = Math.max(1, Math.round(baseValue * multiplier));
      
      // Calculate market price
      const adpFactor = Math.exp(-adp / 50);
      const marketPrice = Math.max(1, Math.round(intrinsicValue * (0.5 + adpFactor)));
      
      // Calculate edge
      const edge = intrinsicValue - marketPrice;
      
      return {
        id: `player_${index}`,
        name,
        position,
        team,
        projectedPoints,
        vorp,
        intrinsicValue,
        marketPrice,
        edge,
        adp,
        confidence: 0.75
      };
    });
    
    // Filter out invalid entries
    return players.filter(p => 
      p.name && 
      p.position && 
      ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].includes(p.position) &&
      p.projectedPoints > 0
    );
    
  } catch (error) {
    console.error('Error loading projection data:', error);
    throw error;
  }
}

async function runInvariantChecks() {
  console.log('Loading projection data for invariant analysis...');
  
  try {
    // Load the player data
    const players = await loadProjectionData();
    console.log(`Loaded ${players.length} players for analysis`);
    
    // Show position breakdown
    const positionCounts = players.reduce((acc, p) => {
      acc[p.position] = (acc[p.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Position breakdown:', positionCounts);
    
    // Run invariant checks
    console.log('\nRunning valuation invariant checks...');
    const invariantsReport = await valuationInvariantChecker.checkAllInvariants(players);
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Save detailed report to file
    const reportPath = path.join(reportsDir, 'invariants.json');
    fs.writeFileSync(reportPath, JSON.stringify(invariantsReport, null, 2));
    
    // Print summary to console
    const summary = {
      timestamp: new Date().toISOString(),
      totalPlayers: players.length,
      positionBreakdown: positionCounts,
      invariants: {
        budgetConservation: {
          passed: invariantsReport.invariants?.budgetConservation?.passed || false,
          message: invariantsReport.invariants?.budgetConservation?.message
        },
        replacementLevelZeroing: {
          passed: invariantsReport.invariants?.replacementLevelZeroing?.passed || false,
          violationCount: invariantsReport.invariants?.replacementLevelZeroing?.counterexamples?.length || 0
        },
        nonNegativity: {
          passed: invariantsReport.invariants?.nonNegativity?.passed || false,
          violationCount: invariantsReport.invariants?.nonNegativity?.counterexamples?.length || 0
        },
        monotonicity: {
          passed: invariantsReport.invariants?.monotonicity?.passed || false,
          violationCount: invariantsReport.invariants?.monotonicity?.violations?.length || 0
        },
        positionalScarcity: {
          passed: invariantsReport.invariants?.positionalScarcity?.passed || false,
          message: invariantsReport.invariants?.positionalScarcity?.message
        },
        maxBudgetShareCap: {
          passed: invariantsReport.invariants?.maxBudgetShareCap?.passed || false,
          violationCount: invariantsReport.invariants?.maxBudgetShareCap?.counterexamples?.length || 0
        }
      },
      reportPath: reportPath,
      allPassed: invariantsReport.summary?.totalPassed === invariantsReport.summary?.totalChecked
    };
    
    console.log('\n' + JSON.stringify(summary, null, 2));
    
    if (!summary.allPassed) {
      console.log('\n⚠️ Some invariants failed. Check the full report at:', reportPath);
      process.exit(1);
    } else {
      console.log('\n✅ All invariants passed!');
    }
    
  } catch (error) {
    console.error('Error running invariant checks:', error);
    process.exit(1);
  }
}

// Run the checks
runInvariantChecks().catch(console.error);