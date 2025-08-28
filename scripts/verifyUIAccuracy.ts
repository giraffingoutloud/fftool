/**
 * Verify UI Accuracy - Compare 20 random players across:
 * 1. Raw CSV data
 * 2. Model calculations
 * 3. What UI should display
 */

import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { CalibratedValuationModel } from '../src/lib/calibratedValuationModel';
import { calibratedValuationService } from '../src/lib/calibratedValuationService';

interface CSVRow {
  fantasyPointsRank: string;
  playerName: string;
  teamName: string;
  position: string;
  byeWeek: string;
  games: string;
  fantasyPoints: string;
  adp?: string;
  marketValue?: string;
  [key: string]: any;
}

interface ComparisonResult {
  playerName: string;
  position: string;
  csvData: {
    points: number;
    rank: number;
    team: string;
    adp?: number;
    marketValue?: number;
  };
  modelCalc: {
    points: number;
    positionRank: number;
    vbd: number;
    auctionValue: number;
    tier: string;
  };
  uiExpected: {
    points: number;
    positionRank: number;
    intrinsicValue: number;
    marketValue: number;
    edge: number;
    vbd: number;
  };
  issues: string[];
}

class UIAccuracyVerifier {
  private model = new CalibratedValuationModel();
  private csvData: CSVRow[] = [];
  private results: ComparisonResult[] = [];
  
  async loadCSVData(): Promise<void> {
    console.log('📂 Loading CSV data...\n');
    
    const filePath = path.join('artifacts/clean_data/projections_2025_with_adp.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    const parsed = Papa.parse<CSVRow>(fileContent, {
      header: true,
      skipEmptyLines: true
    });
    
    this.csvData = parsed.data;
    console.log(`✓ Loaded ${this.csvData.length} players from CSV\n`);
  }
  
  selectRandomPlayers(count: number): CSVRow[] {
    // Get a mix of positions and value ranges
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const selected: CSVRow[] = [];
    
    // Get some top players
    const topPlayers = this.csvData
      .filter(row => parseFloat(row.fantasyPoints) > 250)
      .slice(0, 5);
    selected.push(...topPlayers);
    
    // Get some mid-tier players
    const midPlayers = this.csvData
      .filter(row => {
        const pts = parseFloat(row.fantasyPoints);
        return pts > 150 && pts < 250;
      })
      .slice(0, 8);
    selected.push(...midPlayers);
    
    // Get some low-tier players
    const lowPlayers = this.csvData
      .filter(row => {
        const pts = parseFloat(row.fantasyPoints);
        return pts > 50 && pts < 150;
      })
      .slice(0, 7);
    selected.push(...lowPlayers);
    
    // Shuffle and return
    return selected.sort(() => Math.random() - 0.5).slice(0, count);
  }
  
  async verifyPlayers(): Promise<void> {
    const selectedPlayers = this.selectRandomPlayers(20);
    
    console.log('🔍 Verifying 20 players...\n');
    
    // Convert to format for model
    const allPlayersForModel = this.csvData.map((row, idx) => ({
      id: `player-${idx}`,
      name: row.playerName,
      position: row.position?.toUpperCase(),
      team: row.teamName,
      projectedPoints: parseFloat(row.fantasyPoints) || 0,
      adp: row.adp ? parseFloat(row.adp) : undefined,
      marketValue: row.marketValue ? parseFloat(row.marketValue) : undefined
    }));
    
    // Process through model
    const modelResult = this.model.processAllPlayers(allPlayersForModel);
    
    // Process through service (simulating UI data)
    const projections = allPlayersForModel.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position.toLowerCase(), // Service will normalize
      team: p.team,
      projectedPoints: p.projectedPoints,
      byeWeek: undefined,
      sos: undefined
    }));
    
    const adpData = allPlayersForModel
      .filter(p => p.adp)
      .map(p => ({
        name: p.name,
        position: p.position,
        adp: p.adp,
        auctionValue: p.marketValue
      }));
    
    const serviceResult = calibratedValuationService.processPlayers(projections, adpData);
    
    // Compare each selected player
    selectedPlayers.forEach(csvPlayer => {
      const modelPlayer = modelResult.valuations.find(
        v => v.playerName === csvPlayer.playerName
      );
      
      const servicePlayer = serviceResult.valuations.find(
        v => v.name === csvPlayer.playerName
      );
      
      if (!modelPlayer || !servicePlayer) {
        console.log(`❌ Could not find ${csvPlayer.playerName} in calculations`);
        return;
      }
      
      const issues: string[] = [];
      
      // Check points match
      const csvPoints = parseFloat(csvPlayer.fantasyPoints);
      if (Math.abs(modelPlayer.projectedPoints - csvPoints) > 0.1) {
        issues.push(`Points mismatch: CSV=${csvPoints}, Model=${modelPlayer.projectedPoints}`);
      }
      
      // Check position rank
      const normalizedPos = csvPlayer.position?.toUpperCase();
      const positionPlayers = this.csvData
        .filter(r => r.position?.toUpperCase() === normalizedPos)
        .sort((a, b) => parseFloat(b.fantasyPoints) - parseFloat(a.fantasyPoints));
      const expectedRank = positionPlayers.findIndex(p => p.playerName === csvPlayer.playerName) + 1;
      
      if (modelPlayer.positionRank !== expectedRank) {
        issues.push(`Rank mismatch: Expected=${expectedRank}, Model=${modelPlayer.positionRank}`);
      }
      
      // Check UI values match service
      if (servicePlayer.auctionValue !== modelPlayer.auctionValue) {
        issues.push(`Auction value mismatch: Model=${modelPlayer.auctionValue}, Service=${servicePlayer.auctionValue}`);
      }
      
      // Check market value
      const csvMarket = csvPlayer.marketValue ? parseFloat(csvPlayer.marketValue) : 0;
      if (csvMarket > 0 && Math.abs(servicePlayer.marketValue - csvMarket) > 1) {
        issues.push(`Market value mismatch: CSV=${csvMarket}, Service=${servicePlayer.marketValue}`);
      }
      
      this.results.push({
        playerName: csvPlayer.playerName,
        position: csvPlayer.position,
        csvData: {
          points: csvPoints,
          rank: parseInt(csvPlayer.fantasyPointsRank),
          team: csvPlayer.teamName,
          adp: csvPlayer.adp ? parseFloat(csvPlayer.adp) : undefined,
          marketValue: csvMarket
        },
        modelCalc: {
          points: modelPlayer.projectedPoints,
          positionRank: modelPlayer.positionRank,
          vbd: modelPlayer.vbd,
          auctionValue: modelPlayer.auctionValue,
          tier: this.getTier(modelPlayer.positionRank)
        },
        uiExpected: {
          points: servicePlayer.projectedPoints,
          positionRank: servicePlayer.positionRank,
          intrinsicValue: servicePlayer.intrinsicValue,
          marketValue: servicePlayer.marketValue,
          edge: servicePlayer.edge,
          vbd: servicePlayer.vbd
        },
        issues
      });
    });
  }
  
  private getTier(rank: number): string {
    if (rank <= 3) return 'elite';
    if (rank <= 8) return 'tier1';
    if (rank <= 16) return 'tier2';
    if (rank <= 24) return 'tier3';
    return 'replacement';
  }
  
  displayResults(): void {
    console.log('═'.repeat(100));
    console.log('PLAYER VERIFICATION RESULTS');
    console.log('═'.repeat(100));
    
    // Show summary
    const totalIssues = this.results.reduce((sum, r) => sum + r.issues.length, 0);
    const playersWithIssues = this.results.filter(r => r.issues.length > 0).length;
    
    console.log(`\n📊 Summary: ${this.results.length} players checked`);
    console.log(`   ✓ Clean: ${this.results.length - playersWithIssues}`);
    console.log(`   ⚠ Issues: ${playersWithIssues} players with ${totalIssues} total issues\n`);
    
    // Show detailed comparison
    console.log('Player Details:');
    console.log('─'.repeat(100));
    
    this.results.forEach(result => {
      const status = result.issues.length === 0 ? '✅' : '❌';
      
      console.log(`\n${status} ${result.playerName} (${result.position})`);
      console.log('─'.repeat(50));
      
      // CSV vs Model vs UI comparison
      console.log('Metric         | CSV Data  | Model Calc | UI Expected');
      console.log('─────────────────────────────────────────────────────');
      console.log(`Points         | ${result.csvData.points.toFixed(1).padStart(9)} | ${result.modelCalc.points.toFixed(1).padStart(10)} | ${result.uiExpected.points.toFixed(1).padStart(11)}`);
      console.log(`Position Rank  | ${'-'.padStart(9)} | ${result.modelCalc.positionRank.toString().padStart(10)} | ${result.uiExpected.positionRank.toString().padStart(11)}`);
      console.log(`VBD            | ${'-'.padStart(9)} | ${result.modelCalc.vbd.toFixed(1).padStart(10)} | ${result.uiExpected.vbd.toFixed(1).padStart(11)}`);
      console.log(`Auction Value  | ${'-'.padStart(9)} | $${result.modelCalc.auctionValue.toString().padStart(9)} | $${result.uiExpected.intrinsicValue.toString().padStart(10)}`);
      console.log(`Market Value   | $${(result.csvData.marketValue || 0).toString().padStart(8)} | ${'-'.padStart(10)} | $${result.uiExpected.marketValue.toString().padStart(10)}`);
      console.log(`Edge           | ${'-'.padStart(9)} | ${'-'.padStart(10)} | $${result.uiExpected.edge.toString().padStart(10)}`);
      
      if (result.issues.length > 0) {
        console.log('\n⚠ Issues:');
        result.issues.forEach(issue => {
          console.log(`  - ${issue}`);
        });
      }
    });
    
    // Show any systematic issues
    console.log('\n' + '═'.repeat(100));
    console.log('SYSTEMATIC ISSUES CHECK');
    console.log('─'.repeat(100));
    
    const positionRankIssues = this.results.filter(r => 
      r.issues.some(i => i.includes('Rank mismatch'))
    );
    
    if (positionRankIssues.length > 0) {
      console.log(`⚠️ Position ranking issues found for ${positionRankIssues.length} players`);
      console.log('  This suggests the position normalization may still have issues');
    } else {
      console.log('✅ Position rankings appear correct');
    }
    
    const valueIssues = this.results.filter(r => 
      r.issues.some(i => i.includes('Auction value mismatch'))
    );
    
    if (valueIssues.length > 0) {
      console.log(`⚠️ Valuation issues found for ${valueIssues.length} players`);
    } else {
      console.log('✅ Auction valuations match between model and service');
    }
  }
  
  async run(): Promise<void> {
    console.log('=' .repeat(100));
    console.log('UI ACCURACY VERIFICATION - 20 Random Players');
    console.log('=' .repeat(100) + '\n');
    
    await this.loadCSVData();
    await this.verifyPlayers();
    this.displayResults();
    
    console.log('\n' + '=' .repeat(100));
    console.log('Verification Complete');
    console.log('=' .repeat(100));
  }
}

// Run the verification
async function main() {
  const verifier = new UIAccuracyVerifier();
  await verifier.run();
}

main().catch(console.error);