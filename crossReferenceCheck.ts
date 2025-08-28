/**
 * Cross-Reference Verification Script for Fantasy Football Player Data
 * 
 * This script validates player data across multiple sources to ensure accuracy
 * by comparing stats for 20 random tier 1-3 players
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';

interface PlayerData {
  name: string;
  position: string;
  team: string;
  projectedPoints?: number;
  passingYards?: number;
  passingTDs?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receivingYards?: number;
  receptions?: number;
  receivingTDs?: number;
  adp?: number;
  auctionValue?: number;
  rank?: number;
  source: string;
}

interface CrossReferenceResult {
  playerName: string;
  position: string;
  team: string;
  metric: string;
  sources: {
    source: string;
    value: number;
  }[];
  variance: number;
  maxDifference: number;
  consensus: number;
  flagged: boolean;
  reason?: string;
}

class PlayerDataCrossReference {
  private readonly TOLERANCE = {
    projectedPoints: 0.15,  // 15% tolerance for projections
    yards: 0.20,            // 20% tolerance for yardage
    tds: 0.25,              // 25% tolerance for TDs (higher variance)
    adp: 0.30,              // 30% tolerance for ADP
    auctionValue: 0.25     // 25% tolerance for auction values
  };

  private readonly WELL_KNOWN_PLAYERS = [
    // Elite RBs
    { name: 'Christian McCaffrey', position: 'RB', expectedRange: { points: [280, 350], adp: [1, 3] } },
    { name: 'Bijan Robinson', position: 'RB', expectedRange: { points: [270, 330], adp: [2, 6] } },
    { name: 'Breece Hall', position: 'RB', expectedRange: { points: [260, 320], adp: [3, 8] } },
    { name: 'Jahmyr Gibbs', position: 'RB', expectedRange: { points: [250, 310], adp: [4, 10] } },
    { name: 'Saquon Barkley', position: 'RB', expectedRange: { points: [240, 300], adp: [5, 12] } },
    
    // Elite WRs
    { name: 'CeeDee Lamb', position: 'WR', expectedRange: { points: [280, 340], adp: [1, 5] } },
    { name: 'Tyreek Hill', position: 'WR', expectedRange: { points: [270, 330], adp: [2, 6] } },
    { name: 'Ja\'Marr Chase', position: 'WR', expectedRange: { points: [260, 320], adp: [3, 8] } },
    { name: 'Justin Jefferson', position: 'WR', expectedRange: { points: [280, 340], adp: [1, 4] } },
    { name: 'Amon-Ra St. Brown', position: 'WR', expectedRange: { points: [250, 310], adp: [5, 12] } },
    
    // Elite QBs
    { name: 'Josh Allen', position: 'QB', expectedRange: { points: [380, 440], adp: [20, 40] } },
    { name: 'Jalen Hurts', position: 'QB', expectedRange: { points: [370, 430], adp: [25, 45] } },
    { name: 'Lamar Jackson', position: 'QB', expectedRange: { points: [360, 420], adp: [30, 50] } },
    
    // Elite TEs
    { name: 'Sam LaPorta', position: 'TE', expectedRange: { points: [180, 230], adp: [25, 45] } },
    { name: 'Travis Kelce', position: 'TE', expectedRange: { points: [170, 220], adp: [20, 40] } },
    { name: 'Mark Andrews', position: 'TE', expectedRange: { points: [160, 210], adp: [30, 50] } }
  ];

  async loadDataSources(): Promise<Map<string, PlayerData[]>> {
    const sources = new Map<string, PlayerData[]>();
    
    // Load main projections file
    console.log('📂 Loading data sources...\n');
    
    const sourceFiles = [
      { file: 'projections_2025.csv', name: 'Main Projections' },
      { file: 'FantasyPros_Fantasy_Football_Projections_FLX.csv', name: 'FantasyPros FLX' },
      { file: 'FantasyPros_Fantasy_Football_Projections_RB.csv', name: 'FantasyPros RB' },
      { file: 'FantasyPros_Fantasy_Football_Projections_WR.csv', name: 'FantasyPros WR' },
      { file: 'FantasyPros_Fantasy_Football_Projections_TE.csv', name: 'FantasyPros TE' },
      { file: 'adp0_2025.csv', name: 'ADP Source 0' },
      { file: 'adp1_2025.csv', name: 'ADP Source 1' },
      { file: 'adp2_2025.csv', name: 'ADP Source 2' },
      { file: 'preseason_rankings_2025.csv', name: 'Preseason Rankings' }
    ];

    for (const source of sourceFiles) {
      try {
        const filePath = path.join('artifacts/clean_data', source.file);
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = Papa.parse(data, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        const players: PlayerData[] = [];
        parsed.data.forEach((row: any) => {
          const player = this.extractPlayerData(row, source.name);
          if (player && player.name) {
            players.push(player);
          }
        });

        if (players.length > 0) {
          sources.set(source.name, players);
          console.log(`  ✓ Loaded ${players.length} players from ${source.name}`);
        }
      } catch (error) {
        console.log(`  ⚠️ Could not load ${source.file}`);
      }
    }

    return sources;
  }

  private extractPlayerData(row: any, sourceName: string): PlayerData {
    // Handle different column naming conventions
    const name = row.playerName || row.name || row.Player || row.player_name || '';
    const position = row.position || row.Position || row.Pos || row.pos || '';
    const team = row.teamName || row.team || row.Team || row.TEAM || '';
    
    return {
      name: this.normalizeName(name),
      position: position.toUpperCase(),
      team: team.toUpperCase(),
      projectedPoints: this.parseNumber(row.fantasyPoints || row.projectedPoints || row.FP || row.points),
      passingYards: this.parseNumber(row.passYds || row.passing_yards || row.passingYards),
      passingTDs: this.parseNumber(row.passTd || row.passing_tds || row.passingTDs),
      rushingYards: this.parseNumber(row.rushYds || row.rushing_yards || row.rushingYards),
      rushingTDs: this.parseNumber(row.rushTd || row.rushing_tds || row.rushingTDs),
      receivingYards: this.parseNumber(row.recvYds || row.receiving_yards || row.receivingYards),
      receptions: this.parseNumber(row.recvReceptions || row.receptions || row.catches),
      receivingTDs: this.parseNumber(row.recvTd || row.receiving_tds || row.receivingTDs),
      adp: this.parseNumber(row.adp || row.ADP || row.averageDraftPosition),
      auctionValue: this.parseNumber(row.auctionValue || row.AAV || row.ESPN_AAV || row.avgValue),
      rank: this.parseNumber(row.fantasyPointsRank || row.rank || row.Rank),
      source: sourceName
    };
  }

  private parseNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }

  private normalizeName(name: string): string {
    return name
      .replace(/Jr\.|Sr\.|III|II|IV/g, '')
      .replace(/[^a-zA-Z\s'-]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  async selectTier1to3Players(sources: Map<string, PlayerData[]>): Promise<PlayerData[]> {
    // Get main projections as baseline
    const mainProjections = sources.get('Main Projections') || [];
    
    // Sort by projected points and take top players for each position
    const tier1to3: PlayerData[] = [];
    const positions = ['QB', 'RB', 'WR', 'TE'];
    
    for (const pos of positions) {
      const posPlayers = mainProjections
        .filter(p => p.position === pos && p.projectedPoints)
        .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
      
      // Take top players based on typical tier cutoffs
      const tierCutoff = {
        QB: 12,
        RB: 24,
        WR: 30,
        TE: 10
      }[pos] || 20;
      
      tier1to3.push(...posPlayers.slice(0, tierCutoff));
    }
    
    console.log(`\n📊 Identified ${tier1to3.length} tier 1-3 players`);
    
    // Return random sample of 20
    const sample: PlayerData[] = [];
    const usedIndices = new Set<number>();
    
    while (sample.length < Math.min(20, tier1to3.length)) {
      const idx = Math.floor(Math.random() * tier1to3.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        sample.push(tier1to3[idx]);
      }
    }
    
    return sample;
  }

  crossReferencePlayer(
    player: PlayerData,
    sources: Map<string, PlayerData[]>
  ): CrossReferenceResult[] {
    const results: CrossReferenceResult[] = [];
    
    // Find this player in all sources
    const playerMatches = new Map<string, PlayerData>();
    
    sources.forEach((sourceData, sourceName) => {
      const match = sourceData.find(p => 
        this.fuzzyMatch(p.name, player.name) && 
        (p.position === player.position || !p.position)
      );
      if (match) {
        playerMatches.set(sourceName, match);
      }
    });
    
    console.log(`\n🔍 ${player.name} (${player.position}) - Found in ${playerMatches.size} sources`);
    
    // Compare key metrics across sources
    const metrics = [
      { name: 'Projected Points', field: 'projectedPoints', tolerance: 'projectedPoints' },
      { name: 'ADP', field: 'adp', tolerance: 'adp' },
      { name: 'Auction Value', field: 'auctionValue', tolerance: 'auctionValue' }
    ];
    
    if (player.position === 'QB') {
      metrics.push(
        { name: 'Passing Yards', field: 'passingYards', tolerance: 'yards' },
        { name: 'Passing TDs', field: 'passingTDs', tolerance: 'tds' }
      );
    } else if (player.position === 'RB') {
      metrics.push(
        { name: 'Rushing Yards', field: 'rushingYards', tolerance: 'yards' },
        { name: 'Rushing TDs', field: 'rushingTDs', tolerance: 'tds' },
        { name: 'Receptions', field: 'receptions', tolerance: 'yards' }
      );
    } else if (player.position === 'WR' || player.position === 'TE') {
      metrics.push(
        { name: 'Receiving Yards', field: 'receivingYards', tolerance: 'yards' },
        { name: 'Receptions', field: 'receptions', tolerance: 'yards' },
        { name: 'Receiving TDs', field: 'receivingTDs', tolerance: 'tds' }
      );
    }
    
    metrics.forEach(metric => {
      const values: { source: string; value: number }[] = [];
      
      playerMatches.forEach((data, source) => {
        const value = data[metric.field];
        if (value !== undefined && value !== null) {
          values.push({ source, value });
        }
      });
      
      if (values.length > 1) {
        const consensus = values.reduce((sum, v) => sum + v.value, 0) / values.length;
        const minValue = Math.min(...values.map(v => v.value));
        const maxValue = Math.max(...values.map(v => v.value));
        const maxDifference = maxValue - minValue;
        const variance = consensus > 0 ? maxDifference / consensus : 0;
        
        const tolerance = this.TOLERANCE[metric.tolerance] || 0.2;
        const flagged = variance > tolerance;
        
        results.push({
          playerName: player.name,
          position: player.position,
          team: player.team,
          metric: metric.name,
          sources: values,
          variance,
          maxDifference,
          consensus,
          flagged,
          reason: flagged ? `Variance ${(variance * 100).toFixed(1)}% exceeds ${(tolerance * 100).toFixed(0)}% tolerance` : undefined
        });
        
        if (flagged) {
          console.log(`  ⚠️ ${metric.name}: High variance (${(variance * 100).toFixed(1)}%)`);
          values.forEach(v => {
            console.log(`     ${v.source}: ${v.value.toFixed(1)}`);
          });
        }
      }
    });
    
    return results;
  }

  private fuzzyMatch(name1: string, name2: string): boolean {
    const n1 = this.normalizeName(name1).toLowerCase();
    const n2 = this.normalizeName(name2).toLowerCase();
    
    // Exact match
    if (n1 === n2) return true;
    
    // Last name match for common nicknames
    const lastName1 = n1.split(' ').pop() || '';
    const lastName2 = n2.split(' ').pop() || '';
    if (lastName1 === lastName2 && lastName1.length > 3) {
      // Check if first names are similar (handles nicknames)
      const firstName1 = n1.split(' ')[0] || '';
      const firstName2 = n2.split(' ')[0] || '';
      if (firstName1.startsWith(firstName2.charAt(0)) || firstName2.startsWith(firstName1.charAt(0))) {
        return true;
      }
    }
    
    return false;
  }

  verifyWellKnownPlayers(sources: Map<string, PlayerData[]>): void {
    console.log('\n' + '='.repeat(80));
    console.log('WELL-KNOWN PLAYER VERIFICATION');
    console.log('='.repeat(80));
    
    const mainProjections = sources.get('Main Projections') || [];
    
    this.WELL_KNOWN_PLAYERS.forEach(expected => {
      const player = mainProjections.find(p => 
        this.fuzzyMatch(p.name, expected.name) && p.position === expected.position
      );
      
      if (player) {
        const pointsInRange = player.projectedPoints && 
          player.projectedPoints >= expected.expectedRange.points[0] &&
          player.projectedPoints <= expected.expectedRange.points[1];
        
        const adpData = sources.get('ADP Source 0') || [];
        const adpPlayer = adpData.find(p => this.fuzzyMatch(p.name, expected.name));
        const adp = adpPlayer?.adp || player.adp;
        
        const adpInRange = adp &&
          adp >= expected.expectedRange.adp[0] &&
          adp <= expected.expectedRange.adp[1];
        
        if (pointsInRange && adpInRange) {
          console.log(`✅ ${expected.name} (${expected.position})`);
          console.log(`   Points: ${player.projectedPoints?.toFixed(1)} (Expected: ${expected.expectedRange.points.join('-')})`);
          console.log(`   ADP: ${adp?.toFixed(1)} (Expected: ${expected.expectedRange.adp.join('-')})`);
        } else {
          console.log(`⚠️ ${expected.name} (${expected.position}) - OUT OF EXPECTED RANGE`);
          console.log(`   Points: ${player.projectedPoints?.toFixed(1)} (Expected: ${expected.expectedRange.points.join('-')}) ${!pointsInRange ? '❌' : '✓'}`);
          console.log(`   ADP: ${adp?.toFixed(1)} (Expected: ${expected.expectedRange.adp.join('-')}) ${!adpInRange ? '❌' : '✓'}`);
        }
      } else {
        console.log(`❌ ${expected.name} (${expected.position}) - NOT FOUND IN DATA`);
      }
    });
  }

  generateReport(allResults: CrossReferenceResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('CROSS-REFERENCE VERIFICATION REPORT');
    console.log('='.repeat(80));
    
    // Summary statistics
    const totalComparisons = allResults.length;
    const flaggedComparisons = allResults.filter(r => r.flagged).length;
    const passRate = ((totalComparisons - flaggedComparisons) / totalComparisons * 100).toFixed(1);
    
    console.log('\n📈 Overall Statistics:');
    console.log(`   Total Cross-References: ${totalComparisons}`);
    console.log(`   Passed: ${totalComparisons - flaggedComparisons} (${passRate}%)`);
    console.log(`   Flagged: ${flaggedComparisons} (${(100 - parseFloat(passRate)).toFixed(1)}%)`);
    
    // Metric-specific analysis
    const metricStats = new Map<string, { total: number; flagged: number; avgVariance: number }>();
    
    allResults.forEach(r => {
      if (!metricStats.has(r.metric)) {
        metricStats.set(r.metric, { total: 0, flagged: 0, avgVariance: 0 });
      }
      const stat = metricStats.get(r.metric)!;
      stat.total++;
      if (r.flagged) stat.flagged++;
      stat.avgVariance += r.variance;
    });
    
    console.log('\n📊 Metric Analysis:');
    console.log('   ' + '-'.repeat(70));
    console.log('   Metric              | Checks | Flagged | Pass Rate | Avg Variance');
    console.log('   ' + '-'.repeat(70));
    
    metricStats.forEach((stat, metric) => {
      const passRate = ((stat.total - stat.flagged) / stat.total * 100).toFixed(1);
      const avgVar = (stat.avgVariance / stat.total * 100).toFixed(1);
      console.log(
        `   ${metric.padEnd(19)} | ${stat.total.toString().padStart(6)} | ` +
        `${stat.flagged.toString().padStart(7)} | ${passRate.padStart(8)}% | ${avgVar.padStart(11)}%`
      );
    });
    
    // Most discrepant players
    const playerDiscrepancies = new Map<string, number>();
    allResults.filter(r => r.flagged).forEach(r => {
      const key = `${r.playerName} (${r.position})`;
      playerDiscrepancies.set(key, (playerDiscrepancies.get(key) || 0) + 1);
    });
    
    const topDiscrepant = Array.from(playerDiscrepancies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (topDiscrepant.length > 0) {
      console.log('\n⚠️ Players with Most Discrepancies:');
      console.log('   ' + '-'.repeat(50));
      topDiscrepant.forEach(([player, count]) => {
        console.log(`   ${player.padEnd(35)} | ${count} metrics flagged`);
      });
    }
    
    // Specific high-variance examples
    const highVariance = allResults
      .filter(r => r.flagged)
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 5);
    
    if (highVariance.length > 0) {
      console.log('\n🔍 Highest Variance Examples:');
      console.log('   ' + '-'.repeat(75));
      highVariance.forEach(r => {
        console.log(`\n   ${r.playerName} (${r.position}) - ${r.metric}`);
        console.log(`   Variance: ${(r.variance * 100).toFixed(1)}% | Consensus: ${r.consensus.toFixed(1)}`);
        r.sources.slice(0, 3).forEach(s => {
          const diff = ((s.value - r.consensus) / r.consensus * 100).toFixed(1);
          console.log(`     ${s.source.padEnd(20)}: ${s.value.toFixed(1)} (${diff}%)`);
        });
      });
    }
    
    // Final assessment
    console.log('\n' + '='.repeat(80));
    if (flaggedComparisons === 0) {
      console.log('✅ EXCELLENT: All data sources show consistent values within tolerance');
    } else if (flaggedComparisons < totalComparisons * 0.1) {
      console.log('✅ GOOD: Minor discrepancies detected but overall data quality is strong');
    } else if (flaggedComparisons < totalComparisons * 0.25) {
      console.log('⚠️ FAIR: Some notable discrepancies detected, review flagged items');
    } else {
      console.log('❌ POOR: Significant discrepancies detected across multiple sources');
    }
    console.log('='.repeat(80));
  }

  async runVerification(): Promise<void> {
    console.log('=' .repeat(80));
    console.log('FANTASY FOOTBALL DATA CROSS-REFERENCE CHECK');
    console.log('=' .repeat(80));
    
    // Load all data sources
    const sources = await this.loadDataSources();
    
    if (sources.size === 0) {
      console.error('❌ No data sources loaded');
      return;
    }
    
    // Select tier 1-3 players
    const samplePlayers = await this.selectTier1to3Players(sources);
    console.log(`\n🎯 Selected ${samplePlayers.length} random tier 1-3 players for verification`);
    
    // Cross-reference each player
    const allResults: CrossReferenceResult[] = [];
    
    samplePlayers.forEach((player, idx) => {
      const results = this.crossReferencePlayer(player, sources);
      allResults.push(...results);
    });
    
    // Verify well-known players
    this.verifyWellKnownPlayers(sources);
    
    // Generate report
    this.generateReport(allResults);
  }
}

// Run the verification
async function main() {
  const verifier = new PlayerDataCrossReference();
  await verifier.runVerification();
}

main().catch(console.error);