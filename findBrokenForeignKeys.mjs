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

function normalizeTeam(team) {
  if (!team) return '';
  // Handle common variations
  const teamMap = {
    'JAC': 'JAX',
    'JACK': 'JAX',
    'WSH': 'WAS',
    'WASH': 'WAS',
    'LVR': 'LV',
    'OAK': 'LV',  // Raiders moved
    'STL': 'LAR', // Rams moved
    'SD': 'LAC'   // Chargers moved
  };
  return teamMap[team.toUpperCase()] || team.toUpperCase();
}

async function findBrokenForeignKeys() {
  console.log('=' .repeat(80));
  console.log('ANALYZING BROKEN FOREIGN KEYS IN FANTASY FOOTBALL DATA');
  console.log('=' .repeat(80));
  
  // Load primary data sources
  const adpPath = path.join(__dirname, 'canonical_data', 'adp', 'adp0_2025.csv');
  const projPath = path.join(__dirname, 'canonical_data', 'projections', 'projections_2025.csv');
  
  const adpContent = fs.readFileSync(adpPath, 'utf8');
  const adpData = parseCSV(adpContent);
  
  const projContent = fs.readFileSync(projPath, 'utf8');
  const projData = parseCSV(projContent);
  
  // Build master player index from ADP (source of truth)
  const masterPlayers = new Map();
  const playersByName = new Map();
  const playersByNormalizedName = new Map();
  const teamRoster = new Map(); // team -> set of players
  
  adpData.forEach(row => {
    const name = row['Full Name'];
    const team = normalizeTeam(row['Team Abbreviation']);
    const position = row['Position'];
    
    if (!name) return;
    
    const key = `${name}|${team}|${position}`;
    const normalizedKey = `${normalizePlayerName(name)}|${team}|${position}`;
    
    masterPlayers.set(key, row);
    
    // Track by name for fuzzy matching
    if (!playersByName.has(name)) {
      playersByName.set(name, []);
    }
    playersByName.get(name).push(row);
    
    // Track by normalized name
    const normalized = normalizePlayerName(name);
    if (!playersByNormalizedName.has(normalized)) {
      playersByNormalizedName.set(normalized, []);
    }
    playersByNormalizedName.get(normalized).push(row);
    
    // Track team rosters
    if (!teamRoster.has(team)) {
      teamRoster.set(team, new Set());
    }
    teamRoster.get(team).add(name);
  });
  
  console.log(`\n📊 MASTER DATA:`);
  console.log(`  ADP Players: ${masterPlayers.size}`);
  console.log(`  Unique Names: ${playersByName.size}`);
  console.log(`  Teams: ${teamRoster.size}`);
  
  // Check projections for broken foreign keys
  const brokenKeys = {
    nameNotFound: [],
    teamMismatch: [],
    positionMismatch: [],
    likelyTraded: [],
    nameVariation: []
  };
  
  projData.forEach(row => {
    const name = row['playerName'];
    const team = normalizeTeam(row['teamName'] || '');
    const position = row['position'];
    
    if (!name) return;
    
    const key = `${name}|${team}|${position}`;
    
    // Check exact match
    if (masterPlayers.has(key)) {
      return; // Perfect match
    }
    
    // Check if player exists with different team (trade?)
    let foundWithDifferentTeam = false;
    let foundWithDifferentPosition = false;
    
    if (playersByName.has(name)) {
      const matches = playersByName.get(name);
      if (matches.length > 0) {
        const match = matches[0];
        if (normalizeTeam(match['Team Abbreviation']) !== team) {
          foundWithDifferentTeam = true;
          brokenKeys.teamMismatch.push({
            player: name,
            position,
            projTeam: team,
            adpTeam: match['Team Abbreviation'],
            note: 'Possible trade or data inconsistency'
          });
        }
        if (match['Position'] !== position) {
          foundWithDifferentPosition = true;
          brokenKeys.positionMismatch.push({
            player: name,
            team,
            projPosition: position,
            adpPosition: match['Position'],
            note: 'Position eligibility difference'
          });
        }
        return;
      }
    }
    
    // Check normalized name (name variation)
    const normalized = normalizePlayerName(name);
    if (playersByNormalizedName.has(normalized)) {
      const matches = playersByNormalizedName.get(normalized);
      if (matches.length > 0) {
        brokenKeys.nameVariation.push({
          projName: name,
          adpName: matches[0]['Full Name'],
          team,
          position,
          note: 'Name format difference'
        });
        return;
      }
    }
    
    // Check for similar names (fuzzy match)
    let closestMatch = null;
    let closestDistance = Infinity;
    
    playersByName.forEach((players, masterName) => {
      const distance = levenshteinDistance(
        normalizePlayerName(name),
        normalizePlayerName(masterName)
      );
      if (distance < closestDistance && distance <= 3) {
        closestDistance = distance;
        closestMatch = { name: masterName, players };
      }
    });
    
    if (closestMatch) {
      brokenKeys.nameVariation.push({
        projName: name,
        adpName: closestMatch.name,
        team,
        position,
        distance: closestDistance,
        note: `Likely typo/variation (distance: ${closestDistance})`
      });
    } else {
      // Truly not found
      brokenKeys.nameNotFound.push({
        player: name,
        team,
        position,
        note: 'Player not in ADP data'
      });
    }
  });
  
  // Report findings
  console.log('\n🔍 BROKEN FOREIGN KEYS ANALYSIS:');
  console.log('-' .repeat(40));
  
  console.log(`\n❌ Players Not Found: ${brokenKeys.nameNotFound.length}`);
  if (brokenKeys.nameNotFound.length > 0) {
    console.log('  Examples:');
    brokenKeys.nameNotFound.slice(0, 5).forEach(fk => {
      console.log(`    • ${fk.player} (${fk.position}, ${fk.team}) - ${fk.note}`);
    });
  }
  
  console.log(`\n🔄 Team Mismatches: ${brokenKeys.teamMismatch.length}`);
  if (brokenKeys.teamMismatch.length > 0) {
    console.log('  Examples (possible trades):');
    brokenKeys.teamMismatch.slice(0, 5).forEach(fk => {
      console.log(`    • ${fk.player}: ${fk.adpTeam} → ${fk.projTeam}`);
    });
  }
  
  console.log(`\n🏈 Position Mismatches: ${brokenKeys.positionMismatch.length}`);
  if (brokenKeys.positionMismatch.length > 0) {
    console.log('  Examples (eligibility differences):');
    brokenKeys.positionMismatch.slice(0, 5).forEach(fk => {
      console.log(`    • ${fk.player}: ${fk.adpPosition} vs ${fk.projPosition}`);
    });
  }
  
  console.log(`\n✏️ Name Variations: ${brokenKeys.nameVariation.length}`);
  if (brokenKeys.nameVariation.length > 0) {
    console.log('  Examples:');
    brokenKeys.nameVariation.slice(0, 5).forEach(fk => {
      console.log(`    • "${fk.projName}" → "${fk.adpName}" ${fk.distance ? `(distance: ${fk.distance})` : ''}`);
    });
  }
  
  const totalBroken = 
    brokenKeys.nameNotFound.length +
    brokenKeys.teamMismatch.length +
    brokenKeys.positionMismatch.length +
    brokenKeys.nameVariation.length;
  
  console.log('\n' + '=' .repeat(80));
  console.log('PROPOSED FOREIGN KEY RESOLUTION STRATEGY');
  console.log('=' .repeat(80));
  
  console.log('\n1. NAME VARIATIONS (Highest Priority):');
  console.log('   • Use fuzzy matching with Levenshtein distance ≤ 2');
  console.log('   • Normalize names (remove Jr/Sr/III, punctuation)');
  console.log('   • Create name aliases map for known variations');
  console.log('   • Example: "Michael Thomas" vs "Mike Thomas"');
  
  console.log('\n2. TEAM CHANGES (Critical for Fantasy):');
  console.log('   • Check Sleeper API for latest team info');
  console.log('   • Maintain trade history with dates');
  console.log('   • Use most recent team for current season');
  console.log('   • Flag mid-season trades for special handling');
  
  console.log('\n3. POSITION ELIGIBILITY (Fantasy Advantage):');
  console.log('   • Preserve ALL eligible positions');
  console.log('   • Create position eligibility map');
  console.log('   • Important for flex plays (e.g., Taysom Hill TE/QB)');
  console.log('   • Use most favorable position for drafting');
  
  console.log('\n4. MISSING PLAYERS:');
  console.log('   • Check if rookie or practice squad');
  console.log('   • May not be in ADP but have projections');
  console.log('   • Create provisional entries with flag');
  console.log('   • Use projection data as fallback');
  
  console.log('\n📊 SUMMARY:');
  console.log(`  Total Broken Foreign Keys: ${totalBroken}`);
  console.log(`  Name Variations: ${brokenKeys.nameVariation.length} (fixable with fuzzy match)`);
  console.log(`  Team Mismatches: ${brokenKeys.teamMismatch.length} (need verification)`);
  console.log(`  Position Differences: ${brokenKeys.positionMismatch.length} (preserve both)`);
  console.log(`  Not Found: ${brokenKeys.nameNotFound.length} (may be new players)`);
  
  return brokenKeys;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Run analysis
findBrokenForeignKeys().catch(console.error);