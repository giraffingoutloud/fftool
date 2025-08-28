/**
 * ADP Data Integration Script
 * Merges ADP and auction value data into main projections
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

interface ProjectionPlayer {
  fantasyPointsRank: number;
  playerName: string;
  teamName: string;
  position: string;
  fantasyPoints: number;
  teamSeasonSOS?: number;
  [key: string]: any;
}

interface SOSData {
  Team: string;
  SOS_Rank: number;
  SOS_Percentage: number;
  SOS_Normalized: number;
}

interface ADPPlayer {
  'Overall Rank': number;
  'Full Name': string;
  'Team Abbreviation': string;
  'Position': string;
  'ADP': number;
  'Auction Value': number;
  'Projected Points': number;
}

class ADPIntegrator {
  private projections: ProjectionPlayer[] = [];
  private adpData: Map<string, ADPPlayer> = new Map();
  private sosMap: Map<string, number> = new Map();
  private matches = 0;
  private misses: string[] = [];

  async loadData(): Promise<void> {
    console.log('📂 Loading data files...\n');
    
    // Load SOS data first
    await this.loadSOSData();
    
    // Load main projections
    const projPath = path.join('artifacts/clean_data/projections_2025.csv');
    const projData = fs.readFileSync(projPath, 'utf-8');
    const projParsed = Papa.parse(projData, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
    this.projections = projParsed.data as ProjectionPlayer[];
    console.log(`✓ Loaded ${this.projections.length} players from projections`);
    
    // Load ADP data from multiple sources
    const adpFiles = ['adp0_2025.csv', 'adp1_2025.csv', 'adp2_2025.csv'];
    
    for (const file of adpFiles) {
      try {
        const adpPath = path.join('artifacts/clean_data', file);
        const adpData = fs.readFileSync(adpPath, 'utf-8');
        const parsed = Papa.parse(adpData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        
        // Store ADP data with normalized keys
        (parsed.data as ADPPlayer[]).forEach(player => {
          if (player['Full Name']) {
            const key = this.createKey(player['Full Name'], player['Position']);
            // Keep the best (lowest) ADP if we have duplicates
            if (!this.adpData.has(key) || player['ADP'] < this.adpData.get(key)!['ADP']) {
              this.adpData.set(key, player);
            }
          }
        });
        
        console.log(`✓ Loaded ${parsed.data.length} players from ${file}`);
      } catch (error) {
        console.log(`⚠️ Could not load ${file}`);
      }
    }
    
    console.log(`\n📊 Total unique ADP entries: ${this.adpData.size}`);
  }

  private async loadSOSData(): Promise<void> {
    try {
      const sosPath = path.join('artifacts/clean_data/sos_2025.csv');
      const sosData = fs.readFileSync(sosPath, 'utf-8');
      const sosParsed = Papa.parse(sosData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });
      
      // Process the corrected SOS data
      (sosParsed.data as any[]).forEach(row => {
        if (row.Team) {
          const teamCode = row.Team;
          // Parse as float to ensure it's a number
          const sosValue = parseFloat(row.SOS_Normalized);
          
          // Set SOS value for team
          this.sosMap.set(teamCode, sosValue);
          
          // Debug: Show first few entries
          if (this.sosMap.size <= 5) {
            console.log(`  ${teamCode}: ${sosValue} (type: ${typeof sosValue})`);
          }
        }
      });
      
      console.log(`✓ Loaded SOS data for ${this.sosMap.size} teams`);
      console.log(`  Sample - NYG: ${this.sosMap.get('NYG')}, SF: ${this.sosMap.get('SF')}, DET: ${this.sosMap.get('DET')}`);
    } catch (error) {
      console.warn('⚠️ Could not load SOS data:', error);
    }
  }

  private createKey(name: string, position: string): string {
    // Normalize name and position for matching
    const normalizedName = this.normalizeName(name);
    const normalizedPos = (position || '').toUpperCase().replace(/[0-9]/g, '');
    return `${normalizedName}|${normalizedPos}`;
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z ]/g, '') // Remove non-letters
      .replace(/\s+jr$/g, '')  // Remove Jr
      .replace(/\s+sr$/g, '')  // Remove Sr
      .replace(/\s+iii$/g, '') // Remove III
      .replace(/\s+ii$/g, '')  // Remove II
      .replace(/\s+iv$/g, '')  // Remove IV
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  }

  integrate(): ProjectionPlayer[] {
    console.log('\n🔄 Integrating ADP and SOS data into projections...\n');
    
    // Team code mappings
    const teamMappings: Record<string, string> = {
      'BLT': 'BAL',  // Baltimore
      'ARZ': 'ARI',  // Arizona
      'HST': 'HOU',  // Houston
      'LA': 'LAR',   // Los Angeles Rams
      'CLV': 'CLE',  // Cleveland
    };
    
    const integrated = this.projections.map(player => {
      const key = this.createKey(player.playerName, player.position);
      const adpMatch = this.adpData.get(key);
      
      // Map team code if needed
      const mappedTeam = teamMappings[player.teamName] || player.teamName;
      
      // Get SOS data for player's team (try both original and mapped)
      const teamSOS = this.sosMap.get(mappedTeam) || this.sosMap.get(player.teamName) || 0;
      
      if (adpMatch) {
        this.matches++;
        
        // Add ADP and SOS data to projection with mapped team
        return {
          ...player,
          teamName: mappedTeam,  // Use mapped team code
          adp: adpMatch['ADP'],
          marketValue: adpMatch['Auction Value'],
          adpSource: 'adp0_2025',
          teamSeasonSOS: teamSOS
        };
      } else {
        // Try fuzzy match on last name only
        const lastName = player.playerName.split(' ').pop()?.toLowerCase() || '';
        let fuzzyMatch: ADPPlayer | undefined;
        
        this.adpData.forEach((adpPlayer, adpKey) => {
          const adpLastName = adpKey.split('|')[0].split(' ').pop() || '';
          if (adpLastName === lastName && adpKey.includes(player.position.toUpperCase())) {
            fuzzyMatch = adpPlayer;
          }
        });
        
        if (fuzzyMatch) {
          this.matches++;
          return {
            ...player,
            teamName: mappedTeam,  // Use mapped team code
            adp: fuzzyMatch['ADP'],
            marketValue: fuzzyMatch['Auction Value'],
            adpSource: 'adp0_2025_fuzzy',
            teamSeasonSOS: teamSOS
          };
        }
        
        // No match found - still add SOS data and map team
        this.misses.push(`${player.playerName} (${player.position})`);
        return {
          ...player,
          teamName: mappedTeam,  // Use mapped team code
          teamSeasonSOS: teamSOS
        };
      }
    });
    
    return integrated;
  }

  generateReport(): void {
    const matchRate = (this.matches / this.projections.length * 100).toFixed(1);
    
    console.log('='.repeat(60));
    console.log('ADP INTEGRATION REPORT');
    console.log('='.repeat(60));
    console.log(`\n📈 Match Statistics:`);
    console.log(`   Total Players: ${this.projections.length}`);
    console.log(`   Matched: ${this.matches} (${matchRate}%)`);
    console.log(`   Unmatched: ${this.misses.length}`);
    
    // Show top unmatched players
    if (this.misses.length > 0) {
      console.log(`\n⚠️ Top Unmatched Players (first 20):`);
      this.misses.slice(0, 20).forEach(player => {
        console.log(`   - ${player}`);
      });
    }
    
    // Verify top players have ADP
    console.log(`\n✅ Top 20 Players ADP Status:`);
    const top20 = this.projections
      .sort((a, b) => a.fantasyPointsRank - b.fantasyPointsRank)
      .slice(0, 20);
    
    top20.forEach(player => {
      const adpStatus = player.adp ? `ADP: ${player.adp}` : '❌ Missing ADP';
      const valueStatus = player.marketValue ? `$${player.marketValue}` : 'No Value';
      console.log(`   #${player.fantasyPointsRank} ${player.playerName} - ${adpStatus}, ${valueStatus}`);
    });
  }

  saveIntegratedData(integratedData: ProjectionPlayer[]): void {
    // Create backup first
    const backupPath = 'artifacts/clean_data/projections_2025_backup.csv';
    const originalPath = 'artifacts/clean_data/projections_2025.csv';
    
    // Backup original
    const original = fs.readFileSync(originalPath, 'utf-8');
    fs.writeFileSync(backupPath, original);
    console.log(`\n💾 Backup saved to ${backupPath}`);
    
    // Save integrated data
    const csv = Papa.unparse(integratedData, {
      header: true,
      quotes: false
    });
    
    const outputPath = 'artifacts/clean_data/projections_2025_with_adp.csv';
    fs.writeFileSync(outputPath, csv);
    console.log(`💾 Integrated data saved to ${outputPath}`);
    
    // Show sample of integrated data
    console.log('\n📋 Sample of integrated data:');
    integratedData.slice(0, 5).forEach(player => {
      console.log(`   ${player.playerName}: ADP=${player.adp || 'N/A'}, Value=$${player.marketValue || 'N/A'}`);
    });
  }

  async run(): Promise<void> {
    await this.loadData();
    const integrated = this.integrate();
    this.generateReport();
    this.saveIntegratedData(integrated);
    
    console.log('\n✅ ADP integration complete!');
    console.log('   Next step: Update dataService.ts to use projections_2025_with_adp.csv');
  }
}

// Run the integration
async function main() {
  const integrator = new ADPIntegrator();
  await integrator.run();
}

main().catch(console.error);