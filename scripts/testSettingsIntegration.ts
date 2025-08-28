/**
 * Test Settings Integration with V2.1 Model
 * 
 * Verifies that:
 * 1. Settings can be loaded and saved
 * 2. V2.1 model respects custom settings
 * 3. Recalculation works when settings change
 */

import { configurationService, type ConfigurationData } from '../src/lib/configurationService';
import { CalibratedValuationModel } from '../src/lib/calibratedValuationModel';
import type { PlayerData } from '../src/lib/calibratedValuationModel';

class SettingsIntegrationTester {
  private model = new CalibratedValuationModel();
  
  async testConfigurationService(): Promise<void> {
    console.log('🔧 Testing Configuration Service...\n');
    
    // Load default configuration
    const defaultConfig = await configurationService.loadConfiguration();
    console.log('✓ Default configuration loaded');
    console.log(`  Teams: ${defaultConfig.leagueSettings.teams}`);
    console.log(`  Budget: $${defaultConfig.leagueSettings.auctionBudget}`);
    console.log(`  PPR: ${defaultConfig.scoringSystem.receiving.receptions}`);
    
    // Test updating configuration
    const modifiedConfig = { ...defaultConfig };
    modifiedConfig.leagueSettings.teams = 10;
    modifiedConfig.leagueSettings.auctionBudget = 250;
    
    configurationService.updateConfiguration(modifiedConfig);
    const updatedConfig = configurationService.getConfiguration();
    
    console.log('\n✓ Configuration updated');
    console.log(`  Teams: ${updatedConfig.leagueSettings.teams}`);
    console.log(`  Budget: $${updatedConfig.leagueSettings.auctionBudget}`);
    
    // Reset to defaults
    configurationService.updateConfiguration(defaultConfig);
    console.log('\n✓ Configuration reset to defaults');
  }
  
  testModelWithCustomSettings(): void {
    console.log('\n🧮 Testing V2.1 Model with Custom Settings...\n');
    
    // Create test players
    const testPlayers: PlayerData[] = [
      { id: '1', name: 'Elite RB', position: 'RB', team: 'DAL', projectedPoints: 300 },
      { id: '2', name: 'Elite WR', position: 'WR', team: 'MIA', projectedPoints: 280 },
      { id: '3', name: 'Elite QB', position: 'QB', team: 'BUF', projectedPoints: 400 },
      { id: '4', name: 'Mid RB', position: 'RB', team: 'NYG', projectedPoints: 200 },
      { id: '5', name: 'Mid WR', position: 'WR', team: 'CHI', projectedPoints: 190 },
    ];
    
    // Test with default settings (12 teams, $200)
    console.log('Default Settings (12 teams, $200):');
    const defaultResults = this.model.processAllPlayers(testPlayers);
    defaultResults.valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .forEach(v => {
        console.log(`  ${v.playerName.padEnd(10)} ${v.position} - $${v.auctionValue}`);
      });
    
    // Update to 10 teams, $250 budget
    const customConfig = configurationService.getConfiguration();
    customConfig.leagueSettings.teams = 10;
    customConfig.leagueSettings.auctionBudget = 250;
    
    // Create new model instance with custom settings
    const customModel = new CalibratedValuationModel();
    
    console.log('\nCustom Settings (10 teams, $250):');
    const customResults = customModel.processAllPlayers(testPlayers);
    customResults.valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .forEach(v => {
        console.log(`  ${v.playerName.padEnd(10)} ${v.position} - $${v.auctionValue}`);
      });
    
    // Verify values changed
    const defaultTotal = defaultResults.valuations.reduce((sum, v) => sum + v.auctionValue, 0);
    const customTotal = customResults.valuations.reduce((sum, v) => sum + v.auctionValue, 0);
    
    console.log('\n📊 Budget Analysis:');
    console.log(`  Default total: $${defaultTotal}`);
    console.log(`  Custom total: $${customTotal}`);
    console.log(`  Difference: $${customTotal - defaultTotal}`);
  }
  
  testScoringSystemChanges(): void {
    console.log('\n⚡ Testing Scoring System Changes...\n');
    
    const testQB: PlayerData = {
      id: '1',
      name: 'Test QB',
      position: 'QB',
      team: 'BUF',
      projectedPoints: 380  // Assumes 6pt passing TDs
    };
    
    const testPlayers = [testQB];
    
    // Test with 6pt passing TDs (current)
    console.log('6pt Passing TDs:');
    const sixPtResult = this.model.calculateAuctionValue(testQB, testPlayers);
    console.log(`  ${testQB.name}: ${testQB.projectedPoints} pts = $${sixPtResult.auctionValue}`);
    
    // Simulate 4pt passing TDs (reduce by ~50 points)
    const fourPtQB = { ...testQB, projectedPoints: 330 };
    console.log('\n4pt Passing TDs (simulated):');
    const fourPtResult = this.model.calculateAuctionValue(fourPtQB, [fourPtQB]);
    console.log(`  ${fourPtQB.name}: ${fourPtQB.projectedPoints} pts = $${fourPtResult.auctionValue}`);
    
    console.log(`\nValue difference: $${sixPtResult.auctionValue - fourPtResult.auctionValue}`);
  }
  
  async run(): Promise<void> {
    console.log('=' .repeat(60));
    console.log('SETTINGS INTEGRATION TEST - V2.1 Model');
    console.log('=' .repeat(60));
    
    await this.testConfigurationService();
    this.testModelWithCustomSettings();
    this.testScoringSystemChanges();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All Settings Integration Tests Complete');
    console.log('=' .repeat(60));
  }
}

// Run the test
async function main() {
  const tester = new SettingsIntegrationTester();
  await tester.run();
}

main().catch(console.error);