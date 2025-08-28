#!/usr/bin/env node

/**
 * Comprehensive Recomputation Validation
 * Loads actual app-computed values and compares with fresh recomputation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/[^a-zA-Z0-9_#]/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim().replace(/"/g, '') || '';
    });
    data.push(row);
  }
  
  return data;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

// Load all data sources
async function loadAllData() {
  const artifactsPath = path.join(__dirname, 'artifacts/clean_data');
  const canonicalPath = path.join(__dirname, 'canonical_data');
  
  // Load main projections (this is what the app uses)
  const projectionsPath = path.join(artifactsPath, 'projections_2025.csv');
  const projections = parseCSV(fs.readFileSync(projectionsPath, 'utf-8'));
  
  // Load ADP data
  const adp0 = parseCSV(fs.readFileSync(path.join(artifactsPath, 'adp0_2025.csv'), 'utf-8'));
  const adp2 = parseCSV(fs.readFileSync(path.join(artifactsPath, 'adp2_2025.csv'), 'utf-8'));
  
  // Load FantasyPros projections (for weighted aggregation)
  const fantasyProsFiles = [
    'FantasyPros_Fantasy_Football_Projections_QB.csv',
    'FantasyPros_Fantasy_Football_Projections_RB.csv',
    'FantasyPros_Fantasy_Football_Projections_WR.csv',
    'FantasyPros_Fantasy_Football_Projections_TE.csv'
  ];
  
  const fantasyProsData = [];
  fantasyProsFiles.forEach(file => {
    try {
      const filePath = path.join(canonicalPath, 'projections', file);
      if (fs.existsSync(filePath)) {
        const data = parseCSV(fs.readFileSync(filePath, 'utf-8'));
        fantasyProsData.push(...data);
      }
    } catch (e) {
      console.warn(`Could not load ${file}`);
    }
  });
  
  // Load CBS projections
  const cbsFiles = [
    'qb_projections_2025_cbs.txt',
    'rb_projections_2025_cbs.txt',
    'wr_projections_2025_cbs.txt',
    'te_projections_2025_cbs.txt'
  ];
  
  const cbsData = [];
  cbsFiles.forEach(file => {
    try {
      const filePath = path.join(canonicalPath, 'projections', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // CBS files are tab-delimited
        const lines = content.trim().split('\n');
        const headers = lines[0].split('\t');
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const row = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });
          cbsData.push(row);
        }
      }
    } catch (e) {
      console.warn(`Could not load ${file}`);
    }
  });
  
  return { projections, adp0, adp2, fantasyProsData, cbsData };
}

// Calculate replacement levels
function getReplacementLevel(position) {
  const levels = {
    QB: 220,  // QB12
    RB: 100,  // RB30
    WR: 95,   // WR42
    TE: 80,   // TE14
    DST: 70,  // DST12
    K: 110    // K12
  };
  return levels[position] || 90;
}

// Aggregate projections with weights (mimics app logic)
function aggregateProjections(playerName, position, sources) {
  const { fantasyProsData, cbsData, projections } = sources;
  
  // Find matching projections
  const normalizedName = playerName.toLowerCase().replace(/[^a-z]/g, '');
  
  // FantasyPros (40% weight)
  const fpMatch = fantasyProsData.find(p => {
    const fpName = (p.Player || p.player || '').toLowerCase().replace(/[^a-z]/g, '');
    return fpName === normalizedName;
  });
  
  // CBS (35% weight)
  const cbsMatch = cbsData.find(p => {
    const cbsName = (p.Name || p.Player || '').toLowerCase().replace(/[^a-z]/g, '');
    return cbsName === normalizedName;
  });
  
  // Main projections (25% weight)
  const mainMatch = projections.find(p => {
    const mainName = (p.playerName || '').toLowerCase().replace(/[^a-z]/g, '');
    return mainName === normalizedName;
  });
  
  // Calculate weighted average
  let weightedPoints = 0;
  let totalWeight = 0;
  
  if (fpMatch) {
    const points = parseFloat(fpMatch.FPTS || fpMatch.fantasyPoints || 0);
    weightedPoints += points * 0.4;
    totalWeight += 0.4;
  }
  
  if (cbsMatch) {
    const points = parseFloat(cbsMatch['Fantasy Points'] || cbsMatch.FPTS || 0);
    weightedPoints += points * 0.35;
    totalWeight += 0.35;
  }
  
  if (mainMatch) {
    const points = parseFloat(mainMatch.fantasyPoints || 0);
    weightedPoints += points * 0.25;
    totalWeight += 0.25;
  }
  
  // If we have any data, normalize by total weight
  if (totalWeight > 0) {
    return weightedPoints / totalWeight;
  }
  
  // Fallback to main projection if no aggregation possible
  return mainMatch ? parseFloat(mainMatch.fantasyPoints || 0) : 0;
}

// Calculate auction values (mimics AuctionValuationModel)
function calculateAuctionValues(points, vorp, position, adp) {
  // Position value multipliers
  const positionMultipliers = {
    QB: 0.85,
    RB: 1.15,
    WR: 1.10,
    TE: 0.90,
    DST: 0.50,
    K: 0.40
  };
  
  const multiplier = positionMultipliers[position] || 1.0;
  
  // Base intrinsic value from VORP
  const baseValue = Math.max(0, vorp * 0.2); // $0.20 per VORP point
  const intrinsicValue = Math.max(1, baseValue * multiplier);
  
  // Market price adjustment based on ADP
  const adpValue = parseFloat(adp || 250);
  const adpFactor = Math.exp(-adpValue / 50); // Exponential decay
  const marketPrice = Math.max(1, intrinsicValue * (0.5 + adpFactor));
  
  // Edge calculation
  const edge = intrinsicValue - marketPrice;
  
  // Confidence based on data availability and ADP
  const confidence = 0.5 + Math.min(0.4, (250 - adpValue) / 500);
  
  return {
    intrinsicValue: Math.round(intrinsicValue),
    marketPrice: Math.round(marketPrice),
    edge: Math.round(edge * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    maxBid: Math.max(1, Math.round(intrinsicValue * 1.2)),
    minBid: Math.max(1, Math.round(intrinsicValue * 0.8))
  };
}

// Create stratified sample
function createStratifiedSample(projections, targetSize = 100) {
  const sample = [];
  const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
  
  // Sample by position and VORP tiers
  positions.forEach(pos => {
    const posPlayers = projections.filter(p => p.position === pos);
    if (posPlayers.length === 0) return;
    
    // Calculate VORP for sorting
    posPlayers.forEach(p => {
      p._vorp = Math.max(0, parseFloat(p.fantasyPoints || 0) - getReplacementLevel(pos));
    });
    
    const sorted = posPlayers.sort((a, b) => b._vorp - a._vorp);
    
    // Sample across tiers
    const tiers = [
      sorted.slice(0, Math.ceil(sorted.length * 0.2)),  // Top 20%
      sorted.slice(Math.ceil(sorted.length * 0.2), Math.ceil(sorted.length * 0.5)), // 20-50%
      sorted.slice(Math.ceil(sorted.length * 0.5), Math.ceil(sorted.length * 0.8)), // 50-80%
      sorted.slice(Math.ceil(sorted.length * 0.8))  // Bottom 20%
    ];
    
    tiers.forEach(tier => {
      if (tier.length > 0) {
        // Take at least one from each tier
        sample.push(tier[Math.floor(Math.random() * tier.length)]);
      }
    });
  });
  
  // Add edge cases
  const allPlayers = projections.slice();
  allPlayers.forEach(p => {
    p._vorp = Math.max(0, parseFloat(p.fantasyPoints || 0) - getReplacementLevel(p.position));
  });
  
  // Highest VORP overall
  const highestVORP = allPlayers.sort((a, b) => b._vorp - a._vorp)[0];
  if (highestVORP && !sample.find(p => p.playerName === highestVORP.playerName)) {
    sample.push(highestVORP);
  }
  
  // Negative VORP players
  const negativeVORP = allPlayers.filter(p => {
    const points = parseFloat(p.fantasyPoints || 0);
    const replacement = getReplacementLevel(p.position);
    return points < replacement && points > 0;
  });
  
  if (negativeVORP.length > 0) {
    sample.push(negativeVORP[0]);
  }
  
  // Fill remaining slots randomly
  while (sample.length < targetSize && sample.length < projections.length) {
    const randomPlayer = projections[Math.floor(Math.random() * projections.length)];
    if (!sample.find(p => p.playerName === randomPlayer.playerName)) {
      sample.push(randomPlayer);
    }
  }
  
  return sample.slice(0, targetSize);
}

// Main validation
async function runComprehensiveValidation() {
  console.log('Loading all data sources...');
  const data = await loadAllData();
  
  console.log(`Loaded ${data.projections.length} main projections`);
  console.log(`Loaded ${data.fantasyProsData.length} FantasyPros projections`);
  console.log(`Loaded ${data.cbsData.length} CBS projections`);
  
  // Create stratified sample
  const sample = createStratifiedSample(data.projections, 100);
  console.log(`Created stratified sample of ${sample.length} players`);
  
  const results = [];
  const fieldStats = {
    projectedPoints: { mismatches: 0, totalDiff: 0, maxDiff: 0 },
    vorp: { mismatches: 0, totalDiff: 0, maxDiff: 0 },
    intrinsicValue: { mismatches: 0, totalDiff: 0, maxDiff: 0 },
    marketPrice: { mismatches: 0, totalDiff: 0, maxDiff: 0 },
    edge: { mismatches: 0, totalDiff: 0, maxDiff: 0 }
  };
  
  sample.forEach(player => {
    const position = player.position;
    const playerName = player.playerName;
    
    // APP VALUES (what's in the projection file - this represents app computation)
    const appPoints = parseFloat(player.fantasyPoints || 0);
    const appReplacementLevel = getReplacementLevel(position);
    const appVORP = Math.max(0, appPoints - appReplacementLevel);
    
    // Find ADP for this player
    const normalizedName = playerName.toLowerCase().replace(/[^a-z]/g, '');
    const adpMatch = data.adp0.find(a => 
      (a.FullName || '').toLowerCase().replace(/[^a-z]/g, '') === normalizedName
    );
    const adp = adpMatch ? parseFloat(adpMatch.ADP || 250) : 250;
    
    // App would calculate these values
    const appValues = calculateAuctionValues(appPoints, appVORP, position, adp);
    
    // RECOMPUTED VALUES (fresh calculation from canonical sources)
    const recomputedPoints = aggregateProjections(playerName, position, data);
    const recomputedVORP = Math.max(0, recomputedPoints - appReplacementLevel);
    const recomputedValues = calculateAuctionValues(recomputedPoints, recomputedVORP, position, adp);
    
    // Calculate differences
    const diffs = {};
    let hasMismatch = false;
    
    const fieldsToCompare = [
      { name: 'projectedPoints', app: appPoints, recomputed: recomputedPoints },
      { name: 'vorp', app: appVORP, recomputed: recomputedVORP },
      { name: 'intrinsicValue', app: appValues.intrinsicValue, recomputed: recomputedValues.intrinsicValue },
      { name: 'marketPrice', app: appValues.marketPrice, recomputed: recomputedValues.marketPrice },
      { name: 'edge', app: appValues.edge, recomputed: recomputedValues.edge }
    ];
    
    fieldsToCompare.forEach(field => {
      const absDiff = Math.abs(field.app - field.recomputed);
      const relDiff = field.app !== 0 ? absDiff / Math.abs(field.app) : (field.recomputed !== 0 ? 1 : 0);
      const match = relDiff <= 0.01; // 1% tolerance
      
      diffs[field.name] = {
        app: field.app,
        recomputed: field.recomputed,
        absDiff: Math.round(absDiff * 1000) / 1000,
        relDiff: Math.round(relDiff * 1000) / 1000,
        match
      };
      
      if (!match) {
        fieldStats[field.name].mismatches++;
        fieldStats[field.name].totalDiff += absDiff;
        fieldStats[field.name].maxDiff = Math.max(fieldStats[field.name].maxDiff, absDiff);
        hasMismatch = true;
      }
    });
    
    results.push({
      player: playerName,
      position,
      team: player.teamName,
      adp,
      hasMismatch,
      diffs
    });
  });
  
  // Analyze results
  const totalMismatches = results.filter(r => r.hasMismatch).length;
  
  // Identify suspected causes
  const suspectedCauses = [];
  
  if (fieldStats.projectedPoints.mismatches > sample.length * 0.1) {
    suspectedCauses.push('Projection aggregation weights may differ or source data may be inconsistent');
  }
  
  if (fieldStats.vorp.mismatches > sample.length * 0.05) {
    suspectedCauses.push('VORP calculation or replacement levels may be inconsistent');
  }
  
  if (fieldStats.intrinsicValue.mismatches > sample.length * 0.1) {
    suspectedCauses.push('Intrinsic value formula may have changed or position multipliers differ');
  }
  
  if (fieldStats.marketPrice.mismatches > sample.length * 0.1) {
    suspectedCauses.push('Market price ADP adjustment formula may differ');
  }
  
  // Position-specific analysis
  const positionStats = {};
  ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].forEach(pos => {
    const posResults = results.filter(r => r.position === pos);
    const posMismatches = posResults.filter(r => r.hasMismatch);
    positionStats[pos] = {
      tested: posResults.length,
      mismatches: posMismatches.length,
      rate: posResults.length > 0 ? (posMismatches.length / posResults.length * 100).toFixed(1) + '%' : '0%'
    };
  });
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    rows_tested: sample.length,
    total_mismatches: totalMismatches,
    mismatch_rate: (totalMismatches / sample.length * 100).toFixed(2) + '%',
    field_analysis: Object.entries(fieldStats).map(([field, stats]) => ({
      field,
      mismatches: stats.mismatches,
      rate: (stats.mismatches / sample.length * 100).toFixed(2) + '%',
      avg_diff: stats.mismatches > 0 ? (stats.totalDiff / stats.mismatches).toFixed(3) : 0,
      max_diff: stats.maxDiff.toFixed(3)
    })),
    position_breakdown: positionStats,
    suspected_causes: suspectedCauses,
    top_mismatches: results
      .filter(r => r.hasMismatch)
      .sort((a, b) => {
        // Sort by total relative difference
        const aTotalDiff = Object.values(a.diffs).reduce((sum, d) => sum + (d.relDiff || 0), 0);
        const bTotalDiff = Object.values(b.diffs).reduce((sum, d) => sum + (d.relDiff || 0), 0);
        return bTotalDiff - aTotalDiff;
      })
      .slice(0, 10)
      .map(r => ({
        player: r.player,
        position: r.position,
        adp: r.adp,
        mismatched_fields: Object.keys(r.diffs).filter(f => !r.diffs[f].match),
        worst_diff: Object.entries(r.diffs)
          .filter(([_, d]) => !d.match)
          .sort((a, b) => b[1].relDiff - a[1].relDiff)[0]
      }))
  };
  
  // Save reports
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save detailed JSON
  const jsonPath = path.join(reportsDir, 'recompute_diff.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    summary: report,
    detailed_results: results
  }, null, 2));
  
  // Generate CSV
  const csvRows = [['Player', 'Position', 'Team', 'ADP', 'Field', 'App Value', 'Recomputed', 'Abs Diff', 'Rel Diff', 'Match']];
  
  results.forEach(result => {
    Object.keys(result.diffs).forEach(field => {
      const diff = result.diffs[field];
      csvRows.push([
        result.player,
        result.position,
        result.team,
        result.adp.toFixed(0),
        field,
        diff.app.toFixed(3),
        diff.recomputed.toFixed(3),
        diff.absDiff.toFixed(3),
        (diff.relDiff * 100).toFixed(2) + '%',
        diff.match ? 'TRUE' : 'FALSE'
      ]);
    });
  });
  
  const csvPath = path.join(reportsDir, 'recompute_diff.csv');
  fs.writeFileSync(csvPath, csvRows.map(row => row.join(',')).join('\n'));
  
  // Print summary
  console.log('\n=== RECOMPUTATION VALIDATION SUMMARY ===\n');
  console.log(JSON.stringify({
    timestamp: report.timestamp,
    rows_tested: report.rows_tested,
    mismatches: report.total_mismatches,
    top_failing_fields: report.field_analysis.slice(0, 5),
    suspected_causes: report.suspected_causes,
    artifact_paths: {
      json: jsonPath,
      csv: csvPath
    }
  }, null, 2));
  
  return report;
}

// Run validation
runComprehensiveValidation().catch(console.error);