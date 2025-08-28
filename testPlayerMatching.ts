/**
 * Test script to verify player matching improvements
 */

import { playerResolver } from './src/lib/playerResolver';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

async function testPlayerMatching() {
  console.log('='.repeat(60));
  console.log('TESTING PLAYER MATCHING IMPROVEMENTS');
  console.log('='.repeat(60));
  
  // Load ADP data directly from file system
  const adpPath = path.join(process.cwd(), 'canonical_data', 'adp', 'adp0_2025.csv');
  const adpContent = fs.readFileSync(adpPath, 'utf-8');
  const parsedADP = Papa.parse(adpContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });
  
  const adpData = parsedADP.data.map((row: any) => ({
    name: row['Full Name'] || row.name || row.Player || row.playerName,
    team: row['Team Abbreviation'] || row.team || row.Team || row.teamName || 'FA',
    position: row.Position || row.position || row.Pos,
    adp: parseFloat(row.ADP || row.adp || row['Avg Pick'] || 0)
  }));
  
  // Initialize player resolver with ADP data
  playerResolver.initialize(adpData);
  
  // Test cases for DSTs
  const dstTestCases = [
    { name: 'Bills DST', team: 'BUF', position: 'DST' },
    { name: 'Buffalo Bills DST', team: 'BUF', position: 'DST' },
    { name: 'Cowboys DST', team: 'DAL', position: 'DST' },
    { name: 'Dallas Cowboys DST', team: 'DAL', position: 'DST' },
    { name: 'Bills Defense', team: 'BUF', position: 'DST' },
    { name: 'Bills', team: 'BUF', position: 'DST' }
  ];
  
  console.log('\n1. DST Matching Tests:');
  console.log('-'.repeat(40));
  
  for (const testCase of dstTestCases) {
    const match = playerResolver.findBestMatch(testCase.name, testCase.team, testCase.position);
    const status = match.matchType !== 'not_found' ? '✓' : '✗';
    console.log(`${status} ${testCase.name.padEnd(25)} -> ${match.matchType.padEnd(12)} (confidence: ${match.confidence.toFixed(2)})`);
    if (match.reason) {
      console.log(`   Reason: ${match.reason}`);
    }
  }
  
  // Test cases for nicknamed players
  const nicknameTestCases = [
    { name: 'Hollywood Brown', team: 'KC', position: 'WR' },
    { name: 'Marquise Brown', team: 'KC', position: 'WR' },
    { name: 'Marquise "Hollywood" Brown', team: 'KC', position: 'WR' },
    { name: 'AJ Brown', team: 'PHI', position: 'WR' },
    { name: 'A.J. Brown', team: 'PHI', position: 'WR' },
    { name: 'DJ Moore', team: 'CHI', position: 'WR' },
    { name: 'D.J. Moore', team: 'CHI', position: 'WR' }
  ];
  
  console.log('\n2. Nicknamed Player Tests:');
  console.log('-'.repeat(40));
  
  for (const testCase of nicknameTestCases) {
    const match = playerResolver.findBestMatch(testCase.name, testCase.team, testCase.position);
    const status = match.matchType !== 'not_found' ? '✓' : '✗';
    console.log(`${status} ${testCase.name.padEnd(30)} -> ${match.matchType.padEnd(12)} (confidence: ${match.confidence.toFixed(2)})`);
    if (match.reason) {
      console.log(`   Reason: ${match.reason}`);
    }
  }
  
  // Test suffix handling
  const suffixTestCases = [
    { name: 'Michael Pittman Jr', team: 'IND', position: 'WR' },
    { name: 'Michael Pittman Jr.', team: 'IND', position: 'WR' },
    { name: 'Michael Pittman', team: 'IND', position: 'WR' },
    { name: 'Kenneth Walker III', team: 'SEA', position: 'RB' },
    { name: 'Kenneth Walker', team: 'SEA', position: 'RB' }
  ];
  
  console.log('\n3. Suffix Handling Tests:');
  console.log('-'.repeat(40));
  
  for (const testCase of suffixTestCases) {
    const match = playerResolver.findBestMatch(testCase.name, testCase.team, testCase.position);
    const status = match.matchType !== 'not_found' ? '✓' : '✗';
    console.log(`${status} ${testCase.name.padEnd(25)} -> ${match.matchType.padEnd(12)} (confidence: ${match.confidence.toFixed(2)})`);
  }
  
  // Count unmatched players
  console.log('\n4. Overall Statistics:');
  console.log('-'.repeat(40));
  
  let totalTested = 0;
  let totalMatched = 0;
  let exactMatches = 0;
  let aliasMatches = 0;
  let normalizedMatches = 0;
  let fuzzyMatches = 0;
  
  const allTestCases = [...dstTestCases, ...nicknameTestCases, ...suffixTestCases];
  
  for (const testCase of allTestCases) {
    const match = playerResolver.findBestMatch(testCase.name, testCase.team, testCase.position);
    totalTested++;
    if (match.matchType !== 'not_found') {
      totalMatched++;
      switch (match.matchType) {
        case 'exact': exactMatches++; break;
        case 'alias': aliasMatches++; break;
        case 'normalized': normalizedMatches++; break;
        case 'fuzzy': fuzzyMatches++; break;
      }
    }
  }
  
  console.log(`Total Tests: ${totalTested}`);
  console.log(`Total Matched: ${totalMatched} (${((totalMatched/totalTested)*100).toFixed(1)}%)`);
  console.log(`  - Exact: ${exactMatches}`);
  console.log(`  - Alias: ${aliasMatches}`);
  console.log(`  - Normalized: ${normalizedMatches}`);
  console.log(`  - Fuzzy: ${fuzzyMatches}`);
  console.log(`Unmatched: ${totalTested - totalMatched}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
  
  process.exit(0);
}

// Run the test
testPlayerMatching().catch(console.error);