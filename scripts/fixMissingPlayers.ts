/**
 * Fix Missing Players - Add players dropped by ETL pipeline
 * 
 * This script recovers the 90 players that were dropped during ETL,
 * including Lamar Jackson and Mark Andrews
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

interface CanonicalPlayer {
  fantasyPointsRank: string;
  playerName: string;
  teamName: string;
  position: string;
  fantasyPoints: string;
  [key: string]: any;
}

class MissingPlayersFixer {
  private cleanPlayers: Map<string, CanonicalPlayer> = new Map();
  private canonicalPlayers: CanonicalPlayer[] = [];
  private missingPlayers: CanonicalPlayer[] = [];
  private fixedPlayers: CanonicalPlayer[] = [];
  
  // Team code mappings
  private readonly TEAM_MAPPINGS: { [key: string]: string } = {
    'BLT': 'BAL',  // Baltimore
    'ARZ': 'ARI',  // Arizona
    'HST': 'HOU',  // Houston
    'JAC': 'JAX',  // Jacksonville
    'LA': 'LAR',   // LA Rams
    'LV': 'LVR',   // Las Vegas Raiders
    'NO': 'NOS',   // New Orleans Saints
    'NY': 'NYG',   // NY Giants (default)
    'TB': 'TBB',   // Tampa Bay
    'WAS': 'WSH',  // Washington
  };

  loadData(): void {
    console.log('📂 Loading data files...\n');
    
    // Load clean data (has missing players)
    const cleanPath = path.join('artifacts/clean_data/projections_2025.csv');
    const cleanContent = fs.readFileSync(cleanPath, 'utf-8');
    const cleanParsed = Papa.parse<CanonicalPlayer>(cleanContent, {
      header: true,
      skipEmptyLines: true
    });
    
    // Create lookup map for clean data
    cleanParsed.data.forEach(player => {
      const key = this.createPlayerKey(player.playerName, player.position);
      this.cleanPlayers.set(key, player);
    });
    console.log(`✓ Loaded ${cleanParsed.data.length} players from clean data`);
    
    // Load canonical data (has all players)
    const canonicalPath = path.join('canonical_data/projections/projections_2025.csv');
    const canonicalContent = fs.readFileSync(canonicalPath, 'utf-8');
    const canonicalParsed = Papa.parse<CanonicalPlayer>(canonicalContent, {
      header: true,
      skipEmptyLines: true
    });
    
    this.canonicalPlayers = canonicalParsed.data;
    console.log(`✓ Loaded ${this.canonicalPlayers.length} players from canonical data`);
    
    // Calculate difference
    console.log(`\n⚠️ Missing ${this.canonicalPlayers.length - cleanParsed.data.length} players in clean data\n`);
  }

  private createPlayerKey(name: string, position: string): string {
    const normalized = (name || '')
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .replace(/\s+jr$/g, '')
      .replace(/\s+sr$/g, '')
      .replace(/\s+iii$/g, '')
      .replace(/\s+ii$/g, '')
      .trim();
    
    const pos = (position || '').toUpperCase();
    return `${normalized}|${pos}`;
  }

  private fixTeamCode(team: string): string {
    const upperTeam = (team || '').toUpperCase();
    return this.TEAM_MAPPINGS[upperTeam] || upperTeam;
  }

  findMissingPlayers(): void {
    console.log('🔍 Finding missing players...\n');
    
    this.canonicalPlayers.forEach(canonicalPlayer => {
      // Fix team code
      canonicalPlayer.teamName = this.fixTeamCode(canonicalPlayer.teamName);
      
      const key = this.createPlayerKey(canonicalPlayer.playerName, canonicalPlayer.position);
      
      if (!this.cleanPlayers.has(key)) {
        this.missingPlayers.push(canonicalPlayer);
      }
    });
    
    console.log(`Found ${this.missingPlayers.length} missing players\n`);
    
    // Show notable missing players
    const notablePlayers = [
      'Lamar Jackson', 'Mark Andrews', 'Travis Kelce', 'Dak Prescott',
      'Kyler Murray', 'Tua Tagovailoa', 'Joe Burrow'
    ];
    
    console.log('Notable Missing Players:');
    console.log('─'.repeat(60));
    
    notablePlayers.forEach(name => {
      const player = this.missingPlayers.find(p => 
        p.playerName && p.playerName.includes(name)
      );
      
      if (player) {
        console.log(
          `✓ ${player.playerName.padEnd(20)} | ` +
          `${player.position} | ` +
          `${player.teamName} | ` +
          `${parseFloat(player.fantasyPoints || '0').toFixed(1)} pts`
        );
      }
    });
    
    // Show all QBs that are missing
    console.log('\nMissing QBs:');
    console.log('─'.repeat(60));
    
    this.missingPlayers
      .filter(p => p.position === 'QB' || p.position === 'qb')
      .forEach(qb => {
        console.log(
          `${qb.playerName?.padEnd(20) || 'Unknown'} | ` +
          `${qb.teamName} | ` +
          `${parseFloat(qb.fantasyPoints || '0').toFixed(1)} pts`
        );
      });
  }

  fixQBScoringForMissing(): void {
    console.log('\n🔧 Applying 6pt passing TD fix to missing QBs...\n');
    
    this.missingPlayers.forEach(player => {
      if (player.position === 'QB' || player.position === 'qb') {
        const passingTDs = parseFloat(player.passTd || '0');
        const oldPoints = parseFloat(player.fantasyPoints || '0');
        
        // Add 2 points per passing TD
        const adjustment = passingTDs * 2;
        const newPoints = oldPoints + adjustment;
        
        player.fantasyPoints = newPoints.toFixed(1);
        
        if (adjustment > 0) {
          console.log(
            `${player.playerName?.padEnd(20) || 'Unknown'} | ` +
            `${oldPoints.toFixed(1)} → ${newPoints.toFixed(1)} (+${adjustment.toFixed(1)})`
          );
        }
      }
    });
  }

  mergeData(): void {
    console.log('\n🔄 Merging missing players into dataset...\n');
    
    // Combine clean data with missing players
    const allPlayers = [
      ...Array.from(this.cleanPlayers.values()),
      ...this.missingPlayers
    ];
    
    // Sort by fantasy points
    allPlayers.sort((a, b) => {
      const aPoints = parseFloat(a.fantasyPoints || '0');
      const bPoints = parseFloat(b.fantasyPoints || '0');
      return bPoints - aPoints;
    });
    
    // Update ranks
    allPlayers.forEach((player, index) => {
      player.fantasyPointsRank = (index + 1).toString();
    });
    
    this.fixedPlayers = allPlayers;
    
    console.log(`✓ Merged dataset now has ${this.fixedPlayers.length} players`);
    
    // Verify key players are now present
    console.log('\nVerification - Key Players Now Present:');
    console.log('─'.repeat(70));
    
    const checkPlayers = [
      'Lamar Jackson', 'Mark Andrews', 'Josh Allen', 'Breece Hall', 'Tyreek Hill'
    ];
    
    checkPlayers.forEach(name => {
      const player = this.fixedPlayers.find(p => 
        p.playerName && p.playerName.includes(name)
      );
      
      if (player) {
        console.log(
          `✅ #${player.fantasyPointsRank.padStart(3)} | ` +
          `${player.playerName.substring(0, 20).padEnd(20)} | ` +
          `${player.position} | ` +
          `${player.teamName} | ` +
          `${parseFloat(player.fantasyPoints || '0').toFixed(1)} pts`
        );
      } else {
        console.log(`❌ ${name} - STILL MISSING`);
      }
    });
  }

  saveFixedData(): void {
    console.log('\n💾 Saving complete dataset...\n');
    
    // Backup original
    const originalPath = path.join('artifacts/clean_data/projections_2025.csv');
    const backupPath = path.join('artifacts/clean_data/projections_2025_incomplete_backup.csv');
    
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(originalPath, backupPath);
      console.log(`✓ Backup saved to ${backupPath}`);
    }
    
    // Save complete version
    const csv = Papa.unparse(this.fixedPlayers, {
      header: true
    });
    
    const completePath = path.join('artifacts/clean_data/projections_2025_complete.csv');
    fs.writeFileSync(completePath, csv);
    console.log(`✓ Complete projections saved to ${completePath}`);
    
    // Overwrite original
    fs.writeFileSync(originalPath, csv);
    console.log(`✓ Updated original projections file`);
    
    // Show summary
    console.log('\n📊 Final Summary:');
    console.log('─'.repeat(40));
    console.log(`Total Players: ${this.fixedPlayers.length}`);
    
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    positions.forEach(pos => {
      const count = this.fixedPlayers.filter(p => 
        p.position === pos || p.position === pos.toLowerCase()
      ).length;
      console.log(`${pos}: ${count} players`);
    });
  }

  run(): void {
    console.log('=' .repeat(80));
    console.log('MISSING PLAYERS FIX - Recover Dropped Players');
    console.log('=' .repeat(80) + '\n');
    
    this.loadData();
    this.findMissingPlayers();
    this.fixQBScoringForMissing();
    this.mergeData();
    this.saveFixedData();
    
    console.log('\n' + '=' .repeat(80));
    console.log('✅ Missing Players Recovery Complete!');
    console.log(`   Added ${this.missingPlayers.length} missing players`);
    console.log(`   Total dataset: ${this.fixedPlayers.length} players`);
    console.log('=' .repeat(80));
  }
}

// Run the fix
const fixer = new MissingPlayersFixer();
fixer.run();