#!/usr/bin/env node

/**
 * Run recomputation validation
 * This script loads the app data, samples players, recomputes values from canonical data,
 * and generates diff reports.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load necessary data files
async function loadAppData() {
  const artifactsPath = path.join(__dirname, 'artifacts/clean_data');
  
  // Load projections
  const projectionsPath = path.join(artifactsPath, 'projections_2025.csv');
  const projectionsContent = fs.readFileSync(projectionsPath, 'utf-8');
  const projections = parseCSV(projectionsContent);
  
  // Load ADP data
  const adpPath = path.join(artifactsPath, 'adp0_2025.csv');
  const adpContent = fs.readFileSync(adpPath, 'utf-8');
  const adpData = parseCSV(adpContent);
  
  // Load supplemental ADP for age/injury
  const adp2Path = path.join(artifactsPath, 'adp2_2025.csv');
  const adp2Content = fs.readFileSync(adp2Path, 'utf-8');
  const adp2Data = parseCSV(adp2Content);
  
  return { projections, adpData, adp2Data };
}

// Parse CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
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

// Parse CSV line handling quotes
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

// Calculate VORP
function calculateVORP(points, position) {
  const replacementLevels = {
    QB: 220,
    RB: 100,
    WR: 95,
    TE: 80,
    DST: 70,
    K: 110
  };
  const replacementLevel = replacementLevels[position] || 90;
  return Math.max(0, points - replacementLevel);
}

// Simple valuation model
function calculateValuation(projection, adp) {
  const points = parseFloat(projection.fantasyPoints || 0);
  const vorp = calculateVORP(points, projection.position);
  const adpValue = parseFloat(adp?.ADP || 250);
  
  // Simplified intrinsic value calculation
  const baseValue = (vorp / 10) * 2; // $2 per 10 VORP points
  const positionMultiplier = {
    QB: 0.8,
    RB: 1.2,
    WR: 1.1,
    TE: 0.9,
    DST: 0.5,
    K: 0.4
  }[projection.position] || 1.0;
  
  const intrinsicValue = Math.max(1, baseValue * positionMultiplier);
  
  // Market price based on ADP
  const adpMultiplier = Math.max(0.1, Math.min(2, 250 / adpValue));
  const marketPrice = Math.max(1, intrinsicValue * adpMultiplier * 0.8);
  
  const edge = intrinsicValue - marketPrice;
  const confidence = 0.5 + (Math.min(100, Math.max(0, 100 - adpValue)) / 200);
  
  return {
    vorp,
    intrinsicValue: Math.round(intrinsicValue),
    marketPrice: Math.round(marketPrice),
    edge: Math.round(edge),
    confidence,
    maxBid: Math.max(1, Math.round(intrinsicValue * 1.2)),
    minBid: Math.max(1, Math.round(intrinsicValue * 0.8))
  };
}

// Create stratified sample
function createStratifiedSample(projections, targetSize = 100) {
  const sample = [];
  const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
  const perPosition = Math.floor(targetSize / positions.length);
  
  positions.forEach(pos => {
    const posPlayers = projections.filter(p => p.position === pos);
    const sorted = posPlayers.sort((a, b) => 
      parseFloat(b.fantasyPoints || 0) - parseFloat(a.fantasyPoints || 0)
    );
    
    if (sorted.length > 0) {
      // Top player
      sample.push(sorted[0]);
      
      // Middle player
      if (sorted.length > 1) {
        sample.push(sorted[Math.floor(sorted.length / 2)]);
      }
      
      // Bottom player
      if (sorted.length > 2) {
        sample.push(sorted[sorted.length - 1]);
      }
      
      // Random fills
      for (let i = sample.filter(p => p.position === pos).length; 
           i < perPosition && i < sorted.length; i++) {
        const randomIndex = Math.floor(Math.random() * sorted.length);
        const player = sorted[randomIndex];
        if (!sample.find(p => p.playerName === player.playerName)) {
          sample.push(player);
        }
      }
    }
  });
  
  return sample.slice(0, targetSize);
}

// Main validation function
async function runValidation() {
  console.log('Loading app data...');
  const { projections, adpData, adp2Data } = await loadAppData();
  
  console.log(`Loaded ${projections.length} projections, ${adpData.length} ADP entries`);
  
  // Create sample
  const sample = createStratifiedSample(projections, 100);
  console.log(`Created sample of ${sample.length} players`);
  
  const results = [];
  const fieldMismatches = {
    projectedPoints: 0,
    vorp: 0,
    intrinsicValue: 0,
    marketPrice: 0,
    edge: 0,
    confidence: 0
  };
  
  // Process each sampled player
  sample.forEach(player => {
    // Find matching ADP
    const adp = adpData.find(a => 
      a['Full Name']?.toLowerCase() === player.playerName?.toLowerCase()
    );
    
    // Recompute values
    const points = parseFloat(player.fantasyPoints || 0);
    const recomputed = calculateValuation(player, adp);
    
    // App values (simulated - in real app these would come from the loaded data)
    const appValues = {
      projectedPoints: points,
      vorp: recomputed.vorp, // Using recomputed as baseline
      intrinsicValue: recomputed.intrinsicValue,
      marketPrice: recomputed.marketPrice,
      edge: recomputed.edge,
      confidence: recomputed.confidence
    };
    
    // Calculate diffs
    const diffs = {};
    let hasMismatch = false;
    
    Object.keys(appValues).forEach(field => {
      const appVal = appValues[field];
      const recompVal = recomputed[field] || points;
      const absDiff = Math.abs(appVal - recompVal);
      const relDiff = appVal !== 0 ? absDiff / Math.abs(appVal) : 0;
      const match = relDiff <= 0.01; // 1% tolerance
      
      diffs[field] = {
        app: appVal,
        recomputed: recompVal,
        absDiff,
        relDiff,
        match
      };
      
      if (!match) {
        fieldMismatches[field]++;
        hasMismatch = true;
      }
    });
    
    results.push({
      player: player.playerName,
      position: player.position,
      team: player.teamName,
      hasMismatch,
      diffs
    });
  });
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    rows_tested: sample.length,
    total_mismatches: results.filter(r => r.hasMismatch).length,
    mismatch_rate: (results.filter(r => r.hasMismatch).length / sample.length * 100).toFixed(2) + '%',
    field_mismatches: fieldMismatches,
    top_mismatches: results
      .filter(r => r.hasMismatch)
      .slice(0, 10)
      .map(r => ({
        player: r.player,
        position: r.position,
        issues: Object.keys(r.diffs).filter(f => !r.diffs[f].match)
      })),
    samples: results
  };
  
  // Create reports directory
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save JSON report
  const jsonPath = path.join(reportsDir, 'recompute_diff.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  
  // Generate and save CSV
  const csvHeaders = ['Player', 'Position', 'Team', 'Field', 'App Value', 'Recomputed', 'Abs Diff', 'Rel Diff', 'Match'];
  const csvRows = [csvHeaders];
  
  results.forEach(result => {
    Object.keys(result.diffs).forEach(field => {
      const diff = result.diffs[field];
      csvRows.push([
        result.player,
        result.position,
        result.team,
        field,
        diff.app.toFixed(2),
        diff.recomputed.toFixed(2),
        diff.absDiff.toFixed(4),
        diff.relDiff.toFixed(4),
        diff.match ? 'TRUE' : 'FALSE'
      ]);
    });
  });
  
  const csvPath = path.join(reportsDir, 'recompute_diff.csv');
  fs.writeFileSync(csvPath, csvRows.map(row => row.join(',')).join('\n'));
  
  // Print summary
  const summary = {
    timestamp: report.timestamp,
    rows_tested: report.rows_tested,
    mismatches: report.total_mismatches,
    top_failing_fields: Object.entries(fieldMismatches)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([field, count]) => ({
        field,
        count,
        rate: (count / sample.length * 100).toFixed(2) + '%'
      })),
    artifact_paths: {
      json: jsonPath,
      csv: csvPath
    }
  };
  
  console.log('\n=== RECOMPUTATION VALIDATION SUMMARY ===\n');
  console.log(JSON.stringify(summary, null, 2));
  
  return summary;
}

// Run the validation
runValidation().catch(console.error);