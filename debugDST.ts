/**
 * Debug script to understand DST matching issues
 */

import { playerResolver } from './src/lib/playerResolver';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

async function debugDSTMatching() {
  console.log('='.repeat(60));
  console.log('DEBUGGING DST MATCHING');
  console.log('='.repeat(60));
  
  // Load ADP data directly
  const adpPath = path.join(process.cwd(), 'canonical_data', 'adp', 'adp0_2025.csv');
  const adpContent = fs.readFileSync(adpPath, 'utf-8');
  const parsedADP = Papa.parse(adpContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });
  
  // Check what DST entries exist in ADP
  const dstEntries = parsedADP.data.filter((row: any) => row.Position === 'DST');
  console.log('\n1. DST entries in ADP data:');
  console.log('-'.repeat(40));
  dstEntries.slice(0, 5).forEach((dst: any) => {
    console.log(`  Name: "${dst['Full Name']}" | Team: "${dst['Team Abbreviation']}" | Position: "${dst.Position}"`);
  });
  
  // Initialize player resolver
  const adpData = parsedADP.data.map((row: any) => ({
    name: row['Full Name'],
    team: row['Team Abbreviation'],
    position: row.Position,
    adp: parseFloat(row.ADP || 999)
  }));
  
  playerResolver.initialize(adpData);
  
  // Check what keys were created
  console.log('\n2. DST keys in playerIndex:');
  console.log('-'.repeat(40));
  const allKeys = Array.from((playerResolver as any).playerIndex.keys());
  const dstKeys = allKeys.filter(k => k.includes('|DST'));
  console.log(`  Total DST keys: ${dstKeys.length}`);
  console.log('  Sample DST keys:');
  dstKeys.slice(0, 10).forEach(key => {
    console.log(`    "${key}"`);
  });
  
  // Load projections to see what DST names we're trying to match
  const projPath = path.join(process.cwd(), 'canonical_data', 'projections', 'projections_2025.csv');
  const projContent = fs.readFileSync(projPath, 'utf-8');
  const parsedProj = Papa.parse(projContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });
  
  const projDSTs = parsedProj.data.filter((row: any) => row.position === 'dst');
  console.log('\n3. DST names in projections:');
  console.log('-'.repeat(40));
  projDSTs.slice(0, 5).forEach((dst: any) => {
    console.log(`  Name: "${dst.playerName}" | Team: "${dst.teamName}" | Position: "${dst.position}"`);
  });
  
  // Try to match each projection DST
  console.log('\n4. Matching projection DSTs:');
  console.log('-'.repeat(40));
  projDSTs.slice(0, 10).forEach((dst: any) => {
    const name = dst.playerName;
    const team = dst.teamName;
    const position = 'DST'; // Normalize to uppercase
    
    // Generate the key that would be used
    const key = `${name}|${team}|${position}`;
    const keyExists = allKeys.includes(key);
    
    console.log(`\n  Trying to match: "${name}" (${team})`);
    console.log(`    Key would be: "${key}"`);
    console.log(`    Key exists: ${keyExists}`);
    
    // Find similar keys
    const similarKeys = dstKeys.filter(k => 
      k.toLowerCase().includes(team.toLowerCase()) ||
      k.toLowerCase().includes(name.toLowerCase().split(' ')[0])
    );
    if (similarKeys.length > 0) {
      console.log(`    Similar keys found:`);
      similarKeys.slice(0, 3).forEach(k => console.log(`      "${k}"`));
    }
    
    // Try actual matching
    const match = playerResolver.findBestMatch(name, team, position);
    console.log(`    Match result: ${match.matchType} (confidence: ${match.confidence})`);
    if (match.matchType !== 'not_found' && match.player) {
      console.log(`    Matched to: ${match.player.name}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('DEBUG COMPLETE');
  console.log('='.repeat(60));
  
  process.exit(0);
}

debugDSTMatching().catch(console.error);