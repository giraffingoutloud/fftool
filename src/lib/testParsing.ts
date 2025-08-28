// Test script to verify all parsing is correct
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

const BASE_PATH = '/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data/projections';

// Test FantasyPros CSV parsing
function testFantasyProsCSV(filename: string) {
  console.log(`\n=== Testing ${filename} ===`);
  const content = fs.readFileSync(path.join(BASE_PATH, filename), 'utf-8');
  
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false // Keep as strings for now
  });
  
  if (parsed.data.length > 0) {
    const firstRow = parsed.data[0] as any;
    console.log('Headers:', Object.keys(firstRow));
    console.log('First player:', {
      Player: firstRow.Player,
      Team: firstRow.Team,
      FPTS: firstRow.FPTS
    });
    
    // Check for valid data
    let validCount = 0;
    for (const row of parsed.data as any[]) {
      if (row.Player && row.Player.trim() && row.FPTS) {
        const fpts = parseFloat(String(row.FPTS).replace(/,/g, ''));
        if (!isNaN(fpts) && fpts > 0) {
          validCount++;
        }
      }
    }
    console.log(`Valid projections: ${validCount}/${parsed.data.length}`);
  }
}

// Test CBS text file parsing
function testCBSText(filename: string, position: string) {
  console.log(`\n=== Testing ${filename} ===`);
  const content = fs.readFileSync(path.join(BASE_PATH, filename), 'utf-8');
  const lines = content.split('\n');
  
  console.log(`Total lines: ${lines.length}`);
  console.log('Header line 1:', lines[0]);
  console.log('Header line 2:', lines[1]);
  console.log('Header line 3:', lines[2]);
  
  if (lines.length > 3) {
    const dataLine = lines[3];
    const parts = dataLine.split('\t');
    console.log(`First data line columns: ${parts.length}`);
    console.log('First column (player info):', parts[0]);
    
    // Parse player info
    const match = parts[0].match(/^(.+?)\s+(QB|RB|WR|TE)\s+([A-Z]{2,3})/);
    if (match) {
      console.log('Parsed player:', {
        name: match[1],
        position: match[2],
        team: match[3]
      });
    }
    
    // Find FPTS column
    if (position === 'QB' && parts.length >= 15) {
      console.log('Fantasy points (col 14):', parts[14]);
    } else if (position === 'RB' && parts.length >= 14) {
      console.log('Fantasy points (col 13):', parts[13]);
    } else if ((position === 'WR' || position === 'TE') && parts.length >= 11) {
      console.log('Fantasy points (col 10):', parts[10]);
    }
  }
}

// Test projections_2025.csv
function testProjections2025() {
  console.log('\n=== Testing projections_2025.csv ===');
  const content = fs.readFileSync(path.join(BASE_PATH, 'projections_2025.csv'), 'utf-8');
  
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false
  });
  
  if (parsed.data.length > 0) {
    const firstRow = parsed.data[0] as any;
    console.log('Important columns:', {
      playerName: firstRow.playerName,
      teamName: firstRow.teamName,
      position: firstRow.position,
      fantasyPoints: firstRow.fantasyPoints,
      byeWeek: firstRow.byeWeek
    });
    
    // Count by position
    const positionCounts: {[key: string]: number} = {};
    for (const row of parsed.data as any[]) {
      const pos = (row.position || '').toLowerCase();
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    }
    console.log('Position counts:', positionCounts);
  }
}

// Run all tests
console.log('Testing all projection file parsing...\n');

// Test FantasyPros files
testFantasyProsCSV('FantasyPros_Fantasy_Football_Projections_RB.csv');
testFantasyProsCSV('FantasyPros_Fantasy_Football_Projections_WR.csv');
testFantasyProsCSV('FantasyPros_Fantasy_Football_Projections_TE.csv');
testFantasyProsCSV('FantasyPros_Fantasy_Football_Projections_FLX.csv');

// Test CBS files
testCBSText('qb_projections_2025_cbs.txt', 'QB');
testCBSText('rb_projections_2025_cbs.txt', 'RB');
testCBSText('wr_projections_2025_cbs.txt', 'WR');
testCBSText('te_projections_2025_cbs.txt', 'TE');

// Test projections_2025
testProjections2025();

console.log('\n=== Testing complete ===');