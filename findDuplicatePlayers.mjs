import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    row._rowNumber = i + 1;
    data.push(row);
  }
  
  return data;
}

function normalizePlayerName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+(jr|sr|iii|ii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findDuplicatePlayers() {
  console.log('=' .repeat(80));
  console.log('FINDING DUPLICATE PLAYERS IN FANTASY FOOTBALL DATA');
  console.log('=' .repeat(80));
  
  const duplicatesFound = {
    adp: new Map(),
    projections: new Map(),
    crossFile: new Map()
  };

  // Check ADP file
  console.log('\n📄 CHECKING ADP DATA (adp0_2025.csv)');
  console.log('-' .repeat(40));
  
  const adpPath = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const adpContent = fs.readFileSync(adpPath, 'utf8');
  const adpData = parseCSV(adpContent);
  
  // Track players by name+position+team
  const adpPlayerMap = new Map();
  const adpDuplicates = [];
  
  adpData.forEach(row => {
    const name = row['Full Name'];
    const position = row['Position'];
    const team = row['Team Abbreviation'];
    
    if (!name || !position) return;
    
    // Create multiple keys to catch duplicates
    const exactKey = `${name}|${position}|${team}`;
    const namePositionKey = `${name}|${position}`;
    const normalizedKey = `${normalizePlayerName(name)}|${position}`;
    
    // Check exact duplicates
    if (adpPlayerMap.has(exactKey)) {
      const existing = adpPlayerMap.get(exactKey);
      adpDuplicates.push({
        type: 'exact',
        player: name,
        position,
        team,
        rows: [existing._rowNumber, row._rowNumber],
        adp1: existing['ADP'],
        adp2: row['ADP'],
        auction1: existing['Auction Value'],
        auction2: row['Auction Value']
      });
    } else {
      adpPlayerMap.set(exactKey, row);
    }
    
    // Check name+position duplicates (different teams)
    const npEntries = Array.from(adpPlayerMap.entries())
      .filter(([key]) => key.startsWith(`${name}|${position}|`) && key !== exactKey);
    
    if (npEntries.length > 0) {
      npEntries.forEach(([key, existing]) => {
        adpDuplicates.push({
          type: 'different_team',
          player: name,
          position,
          team1: existing['Team Abbreviation'],
          team2: team,
          rows: [existing._rowNumber, row._rowNumber],
          note: 'Same player on different teams (trade/error?)'
        });
      });
    }
  });
  
  if (adpDuplicates.length > 0) {
    console.log(`\n❌ Found ${adpDuplicates.length} duplicates in ADP file:`);
    adpDuplicates.slice(0, 10).forEach(dup => {
      console.log(`\n  ${dup.player} (${dup.position})`);
      if (dup.type === 'exact') {
        console.log(`    Exact duplicate in rows ${dup.rows.join(', ')}`);
        console.log(`    ADP: ${dup.adp1} vs ${dup.adp2}`);
        console.log(`    Auction: ${dup.auction1} vs ${dup.auction2}`);
      } else {
        console.log(`    Teams: ${dup.team1} vs ${dup.team2} (rows ${dup.rows.join(', ')})`);
        console.log(`    ${dup.note}`);
      }
    });
  } else {
    console.log('✅ No exact duplicates found in ADP file');
  }
  
  // Check Projections file
  console.log('\n📄 CHECKING PROJECTIONS DATA (projections_2025.csv)');
  console.log('-' .repeat(40));
  
  const projPath = path.join(__dirname, 'canonical_data', 'projections', 'projections_2025.csv');
  
  if (fs.existsSync(projPath)) {
    const projContent = fs.readFileSync(projPath, 'utf8');
    const projData = parseCSV(projContent);
    
    const projPlayerMap = new Map();
    const projDuplicates = [];
    
    projData.forEach(row => {
      const name = row['playerName'];
      const position = row['position'];
      const team = row['teamName'];
      
      if (!name || !position) return;
      
      const key = `${name}|${position}|${team}`;
      
      if (projPlayerMap.has(key)) {
        const existing = projPlayerMap.get(key);
        projDuplicates.push({
          player: name,
          position,
          team,
          rows: [existing._rowNumber, row._rowNumber],
          points1: existing['fantasyPoints'],
          points2: row['fantasyPoints']
        });
      } else {
        projPlayerMap.set(key, row);
      }
    });
    
    if (projDuplicates.length > 0) {
      console.log(`\n❌ Found ${projDuplicates.length} duplicates in projections:`);
      projDuplicates.slice(0, 5).forEach(dup => {
        console.log(`  ${dup.player} (${dup.position}, ${dup.team})`);
        console.log(`    Rows: ${dup.rows.join(', ')}`);
        console.log(`    Points: ${dup.points1} vs ${dup.points2}`);
      });
    } else {
      console.log('✅ No duplicates found in projections file');
    }
  }
  
  // Check for cross-file inconsistencies
  console.log('\n🔄 CHECKING CROSS-FILE CONSISTENCY');
  console.log('-' .repeat(40));
  
  // Check FantasyPros projections
  const fantasyProsPaths = [
    'projections/FantasyPros_2025_QB.csv',
    'projections/FantasyPros_2025_RB.csv',
    'projections/FantasyPros_2025_WR.csv',
    'projections/FantasyPros_2025_TE.csv',
    'projections/FantasyPros_2025_FLX.csv'
  ];
  
  const allFantasyProsPlayers = new Map();
  const fpDuplicates = [];
  
  fantasyProsPaths.forEach(filePath => {
    const fullPath = path.join(__dirname, 'canonical_data', filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const data = parseCSV(content);
      const fileName = path.basename(filePath);
      
      data.forEach(row => {
        const name = row['Player'] || row['Name'];
        const team = row['Team'];
        const position = fileName.includes('QB') ? 'QB' : 
                        fileName.includes('RB') ? 'RB' :
                        fileName.includes('WR') ? 'WR' :
                        fileName.includes('TE') ? 'TE' : 'FLX';
        
        if (!name) return;
        
        const key = `${name}|${team}`;
        
        if (allFantasyProsPlayers.has(key)) {
          const existing = allFantasyProsPlayers.get(key);
          if (fileName.includes('FLX')) {
            // FLX file contains duplicates of RB/WR/TE - this is expected
            return;
          }
          fpDuplicates.push({
            player: name,
            team,
            file1: existing.file,
            file2: fileName,
            position1: existing.position,
            position2: position
          });
        } else {
          allFantasyProsPlayers.set(key, { file: fileName, position, row });
        }
      });
    }
  });
  
  if (fpDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${fpDuplicates.length} players in multiple FantasyPros files:`);
    fpDuplicates.slice(0, 5).forEach(dup => {
      console.log(`  ${dup.player} (${dup.team})`);
      console.log(`    In ${dup.file1} as ${dup.position1}`);
      console.log(`    In ${dup.file2} as ${dup.position2}`);
    });
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('DUPLICATE ANALYSIS FOR FANTASY FOOTBALL');
  console.log('=' .repeat(80));
  
  console.log('\n📊 KEY FINDINGS:');
  console.log('-' .repeat(40));
  
  console.log('\n1. TYPES OF DUPLICATES:');
  console.log('   • Exact duplicates: Same player, same team, multiple rows');
  console.log('   • Team changes: Same player listed with different teams');
  console.log('   • Position discrepancies: Player listed as multiple positions');
  console.log('   • Source conflicts: Different projections from different sources');
  
  console.log('\n2. FANTASY FOOTBALL IMPLICATIONS:');
  console.log('   • Team changes could be trades (need most recent team)');
  console.log('   • Position flexibility (some players are RB/WR eligible)');
  console.log('   • Multiple projections need weighted averaging');
  console.log('   • ADP conflicts need resolution based on date/source');
  
  console.log('\n3. RECOMMENDED DEDUPLICATION STRATEGY:');
  console.log('   📌 PRIMARY KEY: name + position + team');
  console.log('   📌 For duplicates with same key:');
  console.log('      - Use most favorable ADP (lowest non-null)');
  console.log('      - Average auction values if both present');
  console.log('      - Use highest projection (optimistic)');
  console.log('   📌 For team changes:');
  console.log('      - Use most recent team (check news/trades)');
  console.log('      - Flag for manual review');
  console.log('   📌 For position flexibility:');
  console.log('      - Maintain multiple entries (RB/WR flex eligibility)');
  console.log('      - Important for fantasy lineup optimization');
  
  console.log('\n4. DATA INTEGRITY RULES:');
  console.log('   ✅ Never discard data without logging');
  console.log('   ✅ Preserve position eligibility for flex plays');
  console.log('   ✅ Track source and timestamp of data');
  console.log('   ✅ Flag suspicious duplicates for review');
  
  return {
    adpDuplicates,
    projDuplicates,
    fpDuplicates
  };
}

// Run the analysis
findDuplicatePlayers().catch(console.error);