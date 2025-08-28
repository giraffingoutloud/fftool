/**
 * Top 100 Players Cross-Reference Analysis
 * 
 * This script analyzes the top 100 ranked players across all data sources
 * and validates them against current market consensus
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

interface PlayerData {
  rank: number;
  name: string;
  position: string;
  team: string;
  projectedPoints: number;
  adp?: number;
  auctionValue?: number;
  byeWeek?: number;
  source: string;
  // Position-specific stats
  passingYards?: number;
  passingTDs?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receivingYards?: number;
  receptions?: number;
  receivingTDs?: number;
}

interface PlayerComparison {
  rank: number;
  name: string;
  position: string;
  team: string;
  metrics: {
    projectedPoints: { main: number; fantasypros?: number; variance?: number };
    adp: { value?: number; sources: string[] };
    auctionValue: { calculated?: number; market?: number; variance?: number };
  };
  issues: string[];
  severity: 'OK' | 'MINOR' | 'MAJOR' | 'CRITICAL';
}

class Top100Analyzer {
  private top100Players: PlayerComparison[] = [];
  private dataSources: Map<string, any[]> = new Map();
  
  // Market consensus for validation (2025 season)
  private readonly marketConsensus = new Map([
    // Top 10
    ['Ja\'Marr Chase', { minPts: 320, maxPts: 360, adp: [1, 3] }],
    ['Bijan Robinson', { minPts: 300, maxPts: 340, adp: [1, 4] }],
    ['CeeDee Lamb', { minPts: 280, maxPts: 340, adp: [2, 5] }],
    ['Justin Jefferson', { minPts: 290, maxPts: 340, adp: [2, 5] }],
    ['Saquon Barkley', { minPts: 280, maxPts: 320, adp: [3, 8] }],
    ['Tyreek Hill', { minPts: 270, maxPts: 330, adp: [3, 7] }],
    ['Breece Hall', { minPts: 260, maxPts: 320, adp: [4, 10] }],
    ['Jahmyr Gibbs', { minPts: 250, maxPts: 310, adp: [5, 12] }],
    ['Christian McCaffrey', { minPts: 270, maxPts: 340, adp: [3, 10] }],
    ['Amon-Ra St. Brown', { minPts: 250, maxPts: 310, adp: [8, 15] }],
    // QBs
    ['Josh Allen', { minPts: 380, maxPts: 440, adp: [20, 40] }],
    ['Jalen Hurts', { minPts: 370, maxPts: 430, adp: [25, 45] }],
    ['Lamar Jackson', { minPts: 360, maxPts: 420, adp: [30, 50] }],
    ['Patrick Mahomes', { minPts: 350, maxPts: 410, adp: [35, 55] }],
    ['Dak Prescott', { minPts: 340, maxPts: 390, adp: [45, 70] }],
    // TEs
    ['Sam LaPorta', { minPts: 180, maxPts: 230, adp: [25, 45] }],
    ['Travis Kelce', { minPts: 170, maxPts: 220, adp: [20, 40] }],
    ['Mark Andrews', { minPts: 160, maxPts: 210, adp: [30, 50] }],
    ['Trey McBride', { minPts: 150, maxPts: 200, adp: [35, 55] }],
    ['George Kittle', { minPts: 140, maxPts: 190, adp: [40, 60] }]
  ]);

  async loadAllData(): Promise<void> {
    console.log('📂 Loading all data sources...\n');
    
    // Load main projections (has rank data)
    const mainPath = path.join('artifacts/clean_data/projections_2025.csv');
    const mainData = fs.readFileSync(mainPath, 'utf-8');
    const mainParsed = Papa.parse(mainData, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
    this.dataSources.set('main', mainParsed.data);
    console.log(`✓ Loaded ${mainParsed.data.length} players from main projections`);
    
    // Load ADP data
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
        this.dataSources.set(file, parsed.data);
        console.log(`✓ Loaded ${parsed.data.length} players from ${file}`);
      } catch (error) {
        console.log(`⚠️ Could not load ${file}`);
      }
    }
    
    // Load FantasyPros projections
    const fpFiles = [
      'FantasyPros_Fantasy_Football_Projections_FLX.csv',
      'FantasyPros_Fantasy_Football_Projections_RB.csv',
      'FantasyPros_Fantasy_Football_Projections_WR.csv',
      'FantasyPros_Fantasy_Football_Projections_TE.csv'
    ];
    
    for (const file of fpFiles) {
      try {
        const fpPath = path.join('artifacts/clean_data', file);
        const fpData = fs.readFileSync(fpPath, 'utf-8');
        const parsed = Papa.parse(fpData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        this.dataSources.set(file, parsed.data);
        console.log(`✓ Loaded ${parsed.data.length} players from ${file}`);
      } catch (error) {
        console.log(`⚠️ Could not load ${file}`);
      }
    }
  }

  extractTop100(): void {
    console.log('\n📊 Extracting top 100 players by rank...\n');
    
    const mainData = this.dataSources.get('main') || [];
    
    // Sort by fantasyPointsRank and take top 100
    const sorted = mainData
      .filter((p: any) => p.fantasyPointsRank && p.playerName)
      .sort((a: any, b: any) => a.fantasyPointsRank - b.fantasyPointsRank)
      .slice(0, 100);
    
    console.log(`Found ${sorted.length} players in top 100 ranks\n`);
    
    // Process each player
    sorted.forEach((player: any) => {
      const comparison: PlayerComparison = {
        rank: player.fantasyPointsRank,
        name: this.normalizeName(player.playerName),
        position: player.position || '',
        team: player.teamName || '',
        metrics: {
          projectedPoints: { main: parseFloat(player.fantasyPoints) || 0 },
          adp: { sources: [] },
          auctionValue: {}
        },
        issues: [],
        severity: 'OK'
      };
      
      // Check for ADP data
      this.findADPData(comparison);
      
      // Check for FantasyPros data
      this.findFantasyProsData(comparison);
      
      // Calculate auction value
      if (player.auctionValue) {
        comparison.metrics.auctionValue.calculated = parseFloat(player.auctionValue);
      }
      
      // Validate against market consensus
      this.validatePlayer(comparison);
      
      this.top100Players.push(comparison);
    });
  }

  private findADPData(player: PlayerComparison): void {
    // Check each ADP source
    ['adp0_2025.csv', 'adp1_2025.csv', 'adp2_2025.csv'].forEach(source => {
      const data = this.dataSources.get(source) || [];
      const match = data.find((p: any) => {
        const pName = p['Full Name'] || p.name || p.Player || '';
        return this.fuzzyMatch(pName, player.name);
      });
      
      if (match) {
        const adp = match.ADP || match.adp || match['Average Draft Position'];
        if (adp) {
          if (!player.metrics.adp.value) {
            player.metrics.adp.value = parseFloat(adp);
          }
          player.metrics.adp.sources.push(source);
          
          // Get auction value if available
          const aav = match['Auction Value'] || match.AAV || match.auctionValue;
          if (aav && !player.metrics.auctionValue.market) {
            player.metrics.auctionValue.market = parseFloat(aav);
          }
        }
      }
    });
  }

  private findFantasyProsData(player: PlayerComparison): void {
    // Map position to correct FantasyPros file
    const positionMap: { [key: string]: string } = {
      'RB': 'FantasyPros_Fantasy_Football_Projections_RB.csv',
      'WR': 'FantasyPros_Fantasy_Football_Projections_WR.csv',
      'TE': 'FantasyPros_Fantasy_Football_Projections_TE.csv',
      'QB': 'FantasyPros_Fantasy_Football_Projections_FLX.csv'
    };
    
    const fpFile = positionMap[player.position] || 'FantasyPros_Fantasy_Football_Projections_FLX.csv';
    const fpData = this.dataSources.get(fpFile) || [];
    
    const match = fpData.find((p: any) => {
      const pName = p.Player || p.Name || '';
      return this.fuzzyMatch(pName, player.name);
    });
    
    if (match) {
      const fpPoints = match.FPTS || match.Points || match.fantasyPoints;
      if (fpPoints) {
        player.metrics.projectedPoints.fantasypros = parseFloat(fpPoints);
        
        // Calculate variance
        if (player.metrics.projectedPoints.main > 0) {
          const diff = Math.abs(player.metrics.projectedPoints.main - player.metrics.projectedPoints.fantasypros);
          player.metrics.projectedPoints.variance = (diff / player.metrics.projectedPoints.main) * 100;
        }
      }
    }
  }

  private validatePlayer(player: PlayerComparison): void {
    const consensus = this.marketConsensus.get(player.name);
    
    // Check projected points
    if (player.metrics.projectedPoints.main < 50) {
      player.issues.push(`Extremely low projection: ${player.metrics.projectedPoints.main.toFixed(1)} points`);
      player.severity = 'CRITICAL';
    } else if (consensus) {
      if (player.metrics.projectedPoints.main < consensus.minPts) {
        const pct = ((consensus.minPts - player.metrics.projectedPoints.main) / consensus.minPts * 100).toFixed(1);
        player.issues.push(`Projection ${pct}% below market minimum (${player.metrics.projectedPoints.main.toFixed(1)} vs ${consensus.minPts}+)`);
        player.severity = pct > '20' ? 'MAJOR' : 'MINOR';
      } else if (player.metrics.projectedPoints.main > consensus.maxPts) {
        const pct = ((player.metrics.projectedPoints.main - consensus.maxPts) / consensus.maxPts * 100).toFixed(1);
        player.issues.push(`Projection ${pct}% above market maximum (${player.metrics.projectedPoints.main.toFixed(1)} vs ${consensus.maxPts}-)`);
        player.severity = pct > '20' ? 'MAJOR' : 'MINOR';
      }
      
      // Check ADP
      if (player.metrics.adp.value) {
        if (player.metrics.adp.value < consensus.adp[0] || player.metrics.adp.value > consensus.adp[1]) {
          player.issues.push(`ADP outside expected range (${player.metrics.adp.value.toFixed(1)} vs ${consensus.adp.join('-')})`);
          if (player.severity === 'OK') player.severity = 'MINOR';
        }
      }
    }
    
    // Check cross-source variance
    if (player.metrics.projectedPoints.variance && player.metrics.projectedPoints.variance > 20) {
      player.issues.push(`High variance between sources: ${player.metrics.projectedPoints.variance.toFixed(1)}%`);
      if (player.severity === 'OK') player.severity = 'MINOR';
    }
    
    // Check if ADP data is missing for top players
    if (player.rank <= 50 && !player.metrics.adp.value) {
      player.issues.push('Missing ADP data for top-50 player');
      if (player.severity === 'OK') player.severity = 'MINOR';
    }
    
    // Check auction value discrepancy
    if (player.metrics.auctionValue.calculated && player.metrics.auctionValue.market) {
      const diff = Math.abs(player.metrics.auctionValue.calculated - player.metrics.auctionValue.market);
      const pct = (diff / player.metrics.auctionValue.market) * 100;
      if (pct > 30) {
        player.issues.push(`Auction value discrepancy: $${player.metrics.auctionValue.calculated} calc vs $${player.metrics.auctionValue.market} market`);
        if (player.severity === 'OK' || player.severity === 'MINOR') {
          player.severity = 'MAJOR';
        }
      }
    }
  }

  private normalizeName(name: string): string {
    return name
      .replace(/Jr\.|Sr\.|III|II|IV|V$/g, '')
      .replace(/[^a-zA-Z\s'-]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private fuzzyMatch(name1: string, name2: string): boolean {
    const n1 = this.normalizeName(name1).toLowerCase();
    const n2 = this.normalizeName(name2).toLowerCase();
    
    if (n1 === n2) return true;
    
    // Handle common variations
    const lastName1 = n1.split(' ').pop() || '';
    const lastName2 = n2.split(' ').pop() || '';
    
    if (lastName1 === lastName2 && lastName1.length > 3) {
      const firstName1 = n1.split(' ')[0] || '';
      const firstName2 = n2.split(' ')[0] || '';
      
      // Check for nickname variations
      if (firstName1.charAt(0) === firstName2.charAt(0)) {
        return true;
      }
    }
    
    return false;
  }

  generateReport(): void {
    console.log('='.repeat(80));
    console.log('TOP 100 PLAYERS CROSS-REFERENCE ANALYSIS');
    console.log('='.repeat(80));
    
    // Summary statistics
    const critical = this.top100Players.filter(p => p.severity === 'CRITICAL');
    const major = this.top100Players.filter(p => p.severity === 'MAJOR');
    const minor = this.top100Players.filter(p => p.severity === 'MINOR');
    const ok = this.top100Players.filter(p => p.severity === 'OK');
    
    console.log('\n📊 OVERALL SUMMARY');
    console.log('─'.repeat(40));
    console.log(`Total Players Analyzed: ${this.top100Players.length}`);
    console.log(`✅ OK: ${ok.length} (${(ok.length/100*100).toFixed(1)}%)`);
    console.log(`⚠️  Minor Issues: ${minor.length} (${(minor.length/100*100).toFixed(1)}%)`);
    console.log(`🟡 Major Issues: ${major.length} (${(major.length/100*100).toFixed(1)}%)`);
    console.log(`🔴 Critical Issues: ${critical.length} (${(critical.length/100*100).toFixed(1)}%)`);
    
    // Position breakdown
    const positionIssues = new Map<string, { total: number; issues: number }>();
    this.top100Players.forEach(p => {
      if (!positionIssues.has(p.position)) {
        positionIssues.set(p.position, { total: 0, issues: 0 });
      }
      const stats = positionIssues.get(p.position)!;
      stats.total++;
      if (p.severity !== 'OK') stats.issues++;
    });
    
    console.log('\n📈 POSITION ANALYSIS');
    console.log('─'.repeat(40));
    console.log('Position | Count | Issues | Issue Rate');
    console.log('─'.repeat(40));
    positionIssues.forEach((stats, pos) => {
      const rate = (stats.issues / stats.total * 100).toFixed(1);
      console.log(`${pos.padEnd(8)} | ${stats.total.toString().padStart(5)} | ${stats.issues.toString().padStart(6)} | ${rate.padStart(9)}%`);
    });
    
    // Critical issues detail
    if (critical.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES (Immediate Fix Required)');
      console.log('─'.repeat(70));
      critical.forEach(p => {
        console.log(`\nRank #${p.rank}: ${p.name} (${p.position}-${p.team})`);
        console.log(`  Points: ${p.metrics.projectedPoints.main.toFixed(1)}`);
        console.log(`  Issues: ${p.issues.join('; ')}`);
      });
    }
    
    // Major issues detail
    if (major.length > 0) {
      console.log('\n🟡 MAJOR ISSUES (High Priority)');
      console.log('─'.repeat(70));
      major.slice(0, 10).forEach(p => {
        console.log(`\nRank #${p.rank}: ${p.name} (${p.position})`);
        console.log(`  Points: ${p.metrics.projectedPoints.main.toFixed(1)}${p.metrics.projectedPoints.fantasypros ? ` | FP: ${p.metrics.projectedPoints.fantasypros.toFixed(1)}` : ''}`);
        console.log(`  ADP: ${p.metrics.adp.value?.toFixed(1) || 'N/A'} | Value: $${p.metrics.auctionValue.calculated || 'N/A'}`);
        console.log(`  Issues: ${p.issues.join('; ')}`);
      });
      if (major.length > 10) {
        console.log(`\n  ... and ${major.length - 10} more major issues`);
      }
    }
    
    // Top 20 players verification
    console.log('\n🏆 TOP 20 PLAYERS VERIFICATION');
    console.log('─'.repeat(80));
    console.log('Rank | Player                     | Pos | Points | ADP  | Value | Status');
    console.log('─'.repeat(80));
    
    this.top100Players.slice(0, 20).forEach(p => {
      const status = p.severity === 'OK' ? '✅' : 
                     p.severity === 'MINOR' ? '⚠️' :
                     p.severity === 'MAJOR' ? '🟡' : '🔴';
      
      console.log(
        `${p.rank.toString().padStart(4)} | ` +
        `${p.name.substring(0, 26).padEnd(26)} | ` +
        `${p.position.padEnd(3)} | ` +
        `${p.metrics.projectedPoints.main.toFixed(0).padStart(6)} | ` +
        `${(p.metrics.adp.value?.toFixed(1) || 'N/A').padStart(4)} | ` +
        `$${(p.metrics.auctionValue.calculated?.toString() || 'N/A').padStart(3)} | ` +
        `${status}`
      );
    });
    
    // Data completeness analysis
    const missingADP = this.top100Players.filter(p => !p.metrics.adp.value).length;
    const missingFP = this.top100Players.filter(p => !p.metrics.projectedPoints.fantasypros).length;
    const missingAAV = this.top100Players.filter(p => !p.metrics.auctionValue.market).length;
    
    console.log('\n📉 DATA COMPLETENESS');
    console.log('─'.repeat(40));
    console.log(`Missing ADP Data: ${missingADP}/100 (${missingADP}%)`);
    console.log(`Missing FantasyPros Data: ${missingFP}/100 (${missingFP}%)`);
    console.log(`Missing Market AAV: ${missingAAV}/100 (${missingAAV}%)`);
    
    // Specific player alerts
    const alertPlayers = [
      'Breece Hall', 'Tyreek Hill', 'Josh Allen', 'Lamar Jackson',
      'Christian McCaffrey', 'Travis Kelce', 'Justin Jefferson'
    ];
    
    console.log('\n⚡ KEY PLAYER STATUS');
    console.log('─'.repeat(60));
    alertPlayers.forEach(name => {
      const player = this.top100Players.find(p => p.name.includes(name));
      if (player) {
        const status = player.severity === 'OK' ? '✅ OK' : 
                       player.severity === 'MINOR' ? '⚠️ Minor' :
                       player.severity === 'MAJOR' ? '🟡 Major' : '🔴 Critical';
        console.log(`${name.padEnd(20)} | Rank #${player.rank.toString().padStart(3)} | ${player.metrics.projectedPoints.main.toFixed(0).padStart(3)} pts | ${status}`);
        if (player.issues.length > 0) {
          console.log(`  └─ ${player.issues[0]}`);
        }
      } else {
        console.log(`${name.padEnd(20)} | ❌ NOT FOUND IN TOP 100`);
      }
    });
    
    // Final assessment
    console.log('\n' + '='.repeat(80));
    console.log('FINAL ASSESSMENT');
    console.log('='.repeat(80));
    
    if (critical.length > 5) {
      console.log('❌ CRITICAL: Multiple severe data quality issues detected');
      console.log('   Recommendation: DO NOT USE for drafting until issues are fixed');
    } else if (major.length > 15) {
      console.log('🟡 MAJOR CONCERNS: Significant data discrepancies found');
      console.log('   Recommendation: Fix major issues before draft use');
    } else if (minor.length > 30) {
      console.log('⚠️  MODERATE: Some data quality issues present');
      console.log('   Recommendation: Review and adjust flagged players');
    } else {
      console.log('✅ GOOD: Data quality acceptable for draft use');
      console.log('   Recommendation: Minor adjustments may improve accuracy');
    }
    
    // Save detailed report to file
    this.saveDetailedReport();
  }

  private saveDetailedReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.top100Players.length,
        ok: this.top100Players.filter(p => p.severity === 'OK').length,
        minor: this.top100Players.filter(p => p.severity === 'MINOR').length,
        major: this.top100Players.filter(p => p.severity === 'MAJOR').length,
        critical: this.top100Players.filter(p => p.severity === 'CRITICAL').length
      },
      players: this.top100Players
    };
    
    fs.writeFileSync(
      'TOP_100_ANALYSIS_REPORT.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Detailed report saved to TOP_100_ANALYSIS_REPORT.json');
  }

  async analyze(): Promise<void> {
    await this.loadAllData();
    this.extractTop100();
    this.generateReport();
  }
}

// Run analysis
async function main() {
  const analyzer = new Top100Analyzer();
  await analyzer.analyze();
}

main().catch(console.error);