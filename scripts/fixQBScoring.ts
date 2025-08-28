/**
 * Fix QB Scoring - Convert from 4pt to 6pt Passing TDs
 * 
 * This script updates all QB projections to use 6-point passing touchdowns
 * instead of the current 4-point system
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

interface PlayerRow {
  fantasyPointsRank: string;
  playerName: string;
  teamName: string;
  position: string;
  fantasyPoints: string;
  passTd: string;
  [key: string]: any;
}

class QBScoringFixer {
  private players: PlayerRow[] = [];
  private qbsFixed = 0;
  private totalAdjustment = 0;

  loadProjections(): void {
    console.log('📂 Loading projections file...\n');
    
    const filePath = path.join('artifacts/clean_data/projections_2025.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    const parsed = Papa.parse<PlayerRow>(fileContent, {
      header: true,
      skipEmptyLines: true
    });
    
    this.players = parsed.data;
    console.log(`✓ Loaded ${this.players.length} players\n`);
  }

  fixQBScoring(): void {
    console.log('🔧 Fixing QB Scoring (4pt → 6pt passing TDs)...\n');
    console.log('Player                         | Pass TDs | Old Pts | New Pts | Adjustment');
    console.log('─'.repeat(80));
    
    this.players = this.players.map(player => {
      if (player.position === 'QB') {
        const passingTDs = parseFloat(player.passTd) || 0;
        const oldPoints = parseFloat(player.fantasyPoints) || 0;
        
        // Add 2 points per passing TD (4pt → 6pt)
        const adjustment = passingTDs * 2;
        const newPoints = oldPoints + adjustment;
        
        // Update the points
        player.fantasyPoints = newPoints.toFixed(1);
        
        // Log the change
        console.log(
          `${player.playerName.substring(0, 29).padEnd(29)} | ` +
          `${passingTDs.toFixed(1).padStart(7)} | ` +
          `${oldPoints.toFixed(1).padStart(7)} | ` +
          `${newPoints.toFixed(1).padStart(7)} | ` +
          `+${adjustment.toFixed(1)}`
        );
        
        this.qbsFixed++;
        this.totalAdjustment += adjustment;
      }
      
      return player;
    });
    
    console.log('─'.repeat(80));
    console.log(`\n✅ Fixed ${this.qbsFixed} QBs`);
    console.log(`   Average adjustment: +${(this.totalAdjustment / this.qbsFixed).toFixed(1)} points per QB\n`);
  }

  recalculateRanks(): void {
    console.log('📊 Recalculating fantasy rankings...\n');
    
    // Sort all players by points
    this.players.sort((a, b) => {
      const aPoints = parseFloat(a.fantasyPoints) || 0;
      const bPoints = parseFloat(b.fantasyPoints) || 0;
      return bPoints - aPoints;
    });
    
    // Update ranks
    this.players.forEach((player, index) => {
      player.fantasyPointsRank = (index + 1).toString();
    });
    
    // Show top 10 after adjustment
    console.log('New Top 10 Overall:');
    console.log('Rank | Player                     | Pos | Points');
    console.log('─'.repeat(50));
    
    this.players.slice(0, 10).forEach(player => {
      console.log(
        `${player.fantasyPointsRank.padStart(4)} | ` +
        `${player.playerName.substring(0, 26).padEnd(26)} | ` +
        `${player.position.padEnd(3)} | ` +
        `${parseFloat(player.fantasyPoints).toFixed(1)}`
      );
    });
  }

  verifyChanges(): void {
    console.log('\n🔍 Verification of Changes:\n');
    
    // Check specific QBs
    const keyQBs = ['Josh Allen', 'Jalen Hurts', 'Patrick Mahomes', 'Lamar Jackson'];
    
    console.log('Key QB Projections:');
    console.log('Player              | New Points | Pass TDs | Expected Range');
    console.log('─'.repeat(65));
    
    keyQBs.forEach(qbName => {
      const qb = this.players.find(p => p.playerName.includes(qbName));
      if (qb) {
        const points = parseFloat(qb.fantasyPoints);
        const tds = parseFloat(qb.passTd);
        let expectedRange = '';
        
        if (qbName === 'Josh Allen') expectedRange = '380-440';
        else if (qbName === 'Jalen Hurts') expectedRange = '370-430';
        else if (qbName === 'Patrick Mahomes') expectedRange = '350-410';
        else if (qbName === 'Lamar Jackson') expectedRange = '360-420';
        
        const inRange = this.isInRange(points, expectedRange);
        const status = inRange ? '✅' : '⚠️';
        
        console.log(
          `${qb.playerName.substring(0, 19).padEnd(19)} | ` +
          `${points.toFixed(1).padStart(10)} | ` +
          `${tds.toFixed(1).padStart(8)} | ` +
          `${expectedRange.padEnd(9)} ${status}`
        );
      } else {
        console.log(`${qbName.padEnd(19)} | NOT FOUND`);
      }
    });
  }

  private isInRange(value: number, range: string): boolean {
    if (!range) return true;
    const [min, max] = range.split('-').map(Number);
    return value >= min && value <= max;
  }

  saveFixed(): void {
    console.log('\n💾 Saving fixed projections...\n');
    
    // Backup original
    const originalPath = path.join('artifacts/clean_data/projections_2025.csv');
    const backupPath = path.join('artifacts/clean_data/projections_2025_4pt_backup.csv');
    
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(originalPath, backupPath);
      console.log(`✓ Backup saved to ${backupPath}`);
    }
    
    // Save fixed version
    const csv = Papa.unparse(this.players, {
      header: true
    });
    
    const fixedPath = path.join('artifacts/clean_data/projections_2025_6pt.csv');
    fs.writeFileSync(fixedPath, csv);
    console.log(`✓ Fixed projections saved to ${fixedPath}`);
    
    // Also overwrite original
    fs.writeFileSync(originalPath, csv);
    console.log(`✓ Updated original projections file`);
  }

  run(): void {
    console.log('=' .repeat(80));
    console.log('QB SCORING FIX - 4pt to 6pt Passing TDs');
    console.log('=' .repeat(80) + '\n');
    
    this.loadProjections();
    this.fixQBScoring();
    this.recalculateRanks();
    this.verifyChanges();
    this.saveFixed();
    
    console.log('\n' + '=' .repeat(80));
    console.log('✅ QB Scoring Fix Complete!');
    console.log('=' .repeat(80));
  }
}

// Run the fix
const fixer = new QBScoringFixer();
fixer.run();