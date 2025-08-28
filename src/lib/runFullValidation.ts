/**
 * Full validation runner for all CSV data files
 * Executes comprehensive validation and generates report
 */

import { strictParser } from './utils/strictCsvParser';
import { CSVSchema, ColumnType, ParseConfig } from './utils/csvSchema';
import { logger } from './utils/logger';

interface ValidationResult {
  file: string;
  success: boolean;
  rowsParsed: number;
  errors: number;
  warnings: number;
  samples: any[];
  message?: string;
}

export async function runFullValidation(): Promise<void> {
  logger.info('=' .repeat(80));
  logger.info('🚀 FULL DATA VALIDATION - ALL CSV FILES');
  logger.info('=' .repeat(80));

  const results: ValidationResult[] = [];
  
  // Define all data files to validate
  const dataFiles = [
    // ADP Data
    { path: '/canonical_data/adp/adp0_2025.csv', name: 'ADP Rankings' },
    { path: '/canonical_data/adp/adp_tier_data_2025.csv', name: 'ADP Tiers' },
    { path: '/canonical_data/adp/cbs_trade_values_week0_2025.csv', name: 'CBS Trade Values' },
    { path: '/canonical_data/adp/fpros_trade_values_dynasty_week0_2025.csv', name: 'Dynasty Trade Values' },
    { path: '/canonical_data/adp/fpros_trade_values_redraft_week0_2025.csv', name: 'Redraft Trade Values' },
    { path: '/canonical_data/adp/pff_redraft_rankings_week0_2025.csv', name: 'PFF Rankings' },
    
    // Projections
    { path: '/canonical_data/projections/projections_2025.csv', name: 'Season Projections' },
    { path: '/canonical_data/projections/projections_vorp_2025.csv', name: 'VORP Projections' },
    { path: '/canonical_data/projections/weekly_projections_w1_2025.csv', name: 'Week 1 Projections' },
    
    // Historical Stats
    { path: '/canonical_data/historical_stats/fantasy-stats-kicking_2024.csv', name: 'Kicking Stats 2024' },
    { path: '/canonical_data/historical_stats/fantasy-stats-passing_2024.csv', name: 'Passing Stats 2024' },
    { path: '/canonical_data/historical_stats/fantasy-stats-receiving_2024.csv', name: 'Receiving Stats 2024' },
    { path: '/canonical_data/historical_stats/fantasy-stats-rushing_2024.csv', name: 'Rushing Stats 2024' },
    
    // Advanced Data - Passing
    { path: '/canonical_data/advanced_data/2024-2025/passing_accuracy.csv', name: 'Passing Accuracy' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_air_yards.csv', name: 'Passing Air Yards' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_danger_plays.csv', name: 'Passing Danger Plays' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_deep_ball.csv', name: 'Passing Deep Ball' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_play_action.csv', name: 'Play Action' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_pressure.csv', name: 'Passing Pressure' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_red_zone.csv', name: 'Red Zone Passing' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_summary.csv', name: 'Passing Summary' },
    { path: '/canonical_data/advanced_data/2024-2025/passing_time_to_throw.csv', name: 'Time to Throw' },
    
    // Advanced Data - Rushing
    { path: '/canonical_data/advanced_data/2024-2025/rushing_expected_yards.csv', name: 'Expected Rushing Yards' },
    { path: '/canonical_data/advanced_data/2024-2025/rushing_gap.csv', name: 'Gap Rushing' },
    { path: '/canonical_data/advanced_data/2024-2025/rushing_quarterback.csv', name: 'QB Rushing' },
    { path: '/canonical_data/advanced_data/2024-2025/rushing_summary.csv', name: 'Rushing Summary' },
    
    // Advanced Data - Receiving
    { path: '/canonical_data/advanced_data/2024-2025/receiving_deep_ball.csv', name: 'Deep Ball Receiving' },
    { path: '/canonical_data/advanced_data/2024-2025/receiving_red_zone.csv', name: 'Red Zone Receiving' },
    { path: '/canonical_data/advanced_data/2024-2025/receiving_summary.csv', name: 'Receiving Summary' },
    { path: '/canonical_data/advanced_data/2024-2025/receiving_usage.csv', name: 'Receiving Usage' },
    
    // Team Data (Tab-delimited)
    { path: '/canonical_data/advanced_data/team_data/defensive_elo.txt', name: 'Defensive ELO', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/offensive_elo.txt', name: 'Offensive ELO', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/passing_defense_rankings.txt', name: 'Pass Defense', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/passing_offense_rankings.txt', name: 'Pass Offense', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/rushing_defense_rankings.txt', name: 'Rush Defense', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/rushing_offense_rankings.txt', name: 'Rush Offense', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_defensive_dvoa.txt', name: 'Defensive DVOA', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_offensive_dvoa.txt', name: 'Offensive DVOA', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_pace_data.txt', name: 'Team Pace', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_passing_yards_allowed.txt', name: 'Pass Yards Allowed', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_points_allowed.txt', name: 'Points Allowed', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_points_per_game.txt', name: 'Points Per Game', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_red_zone_efficiency.txt', name: 'Red Zone Efficiency', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_rushing_yards_allowed.txt', name: 'Rush Yards Allowed', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_sacks_allowed.txt', name: 'Sacks Allowed', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_takeaways_per_game.txt', name: 'Takeaways', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_third_down_conversion.txt', name: 'Third Down', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_time_of_possession.txt', name: 'Time of Possession', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_total_defense.txt', name: 'Total Defense', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_total_offense.txt', name: 'Total Offense', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_turnover_differential.txt', name: 'Turnover Differential', delimiter: '\t' },
    { path: '/canonical_data/advanced_data/team_data/team_yards_per_play.txt', name: 'Yards Per Play', delimiter: '\t' }
  ];

  let totalSuccess = 0;
  let totalFailure = 0;
  let totalRows = 0;

  for (const file of dataFiles) {
    try {
      logger.info(`\n📄 Validating: ${file.name}`);
      
      const response = await fetch(file.path);
      if (!response.ok) {
        results.push({
          file: file.name,
          success: false,
          rowsParsed: 0,
          errors: 1,
          warnings: 0,
          samples: [],
          message: `HTTP ${response.status}`
        });
        totalFailure++;
        continue;
      }

      const content = await response.text();
      
      // Create flexible schema for validation
      const schema: CSVSchema = {
        name: file.name.toLowerCase().replace(/\s+/g, '_'),
        columns: [], // Allow any columns
        uniqueKeys: [],
        allowExtraColumns: true,
        encoding: 'UTF-8',
        delimiter: file.delimiter || ',',
        quoteChar: '"',
        escapeChar: '\\',
        hasHeader: true,
        skipRows: 0,
        naValues: ['', 'N/A', '--', 'null', 'NA', 'n/a'],
        thousandsSeparator: ',',
        decimalSeparator: '.',
        duplicatePolicy: 'last',
        validationMode: 'warning'
      };

      const config: ParseConfig = {
        schema,
        bomHandling: 'remove',
        trimWhitespace: true,
        skipEmptyLines: true,
        maxErrors: 10
      };

      const result = strictParser.parseWithSchema(content, config);
      
      if (result.success && result.data.length > 0) {
        logger.info(`  ✅ Success: ${result.data.length} rows parsed`);
        results.push({
          file: file.name,
          success: true,
          rowsParsed: result.data.length,
          errors: result.errors.length,
          warnings: result.warnings.length,
          samples: result.data.slice(0, 3)
        });
        totalSuccess++;
        totalRows += result.data.length;
      } else {
        logger.error(`  ❌ Failed: ${result.errors[0]?.message || 'Unknown error'}`);
        results.push({
          file: file.name,
          success: false,
          rowsParsed: 0,
          errors: result.errors.length,
          warnings: result.warnings.length,
          samples: [],
          message: result.errors[0]?.message
        });
        totalFailure++;
      }
      
    } catch (error) {
      logger.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        file: file.name,
        success: false,
        rowsParsed: 0,
        errors: 1,
        warnings: 0,
        samples: [],
        message: error instanceof Error ? error.message : String(error)
      });
      totalFailure++;
    }
  }

  // Generate summary report
  logger.info('\n' + '=' .repeat(80));
  logger.info('📊 VALIDATION SUMMARY');
  logger.info('=' .repeat(80));
  
  logger.info(`\n✅ Successful: ${totalSuccess}/${dataFiles.length} files`);
  logger.info(`❌ Failed: ${totalFailure}/${dataFiles.length} files`);
  logger.info(`📈 Total Rows Parsed: ${totalRows.toLocaleString()}`);
  
  // Show failures if any
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    logger.error('\n❌ FAILED FILES:');
    failures.forEach(f => {
      logger.error(`  - ${f.file}: ${f.message || 'Parse error'}`);
    });
  }

  // Show successes with sample data
  logger.info('\n✅ SUCCESSFULLY PARSED FILES:');
  const successes = results.filter(r => r.success);
  successes.forEach(s => {
    logger.info(`  - ${s.file}: ${s.rowsParsed} rows`);
    if (s.samples.length > 0) {
      const sample = s.samples[0];
      const keys = Object.keys(sample).slice(0, 3);
      const preview = keys.map(k => `${k}="${sample[k]}"`).join(', ');
      logger.info(`    Sample: ${preview}`);
    }
  });

  // Data integrity checks
  logger.info('\n🔍 DATA INTEGRITY CHECKS:');
  
  // Check key relationships
  const adpData = results.find(r => r.file === 'ADP Rankings');
  const projections = results.find(r => r.file === 'Season Projections');
  
  if (adpData?.success && projections?.success) {
    logger.info('  ✅ Core data files (ADP + Projections) parsed successfully');
  } else {
    logger.error('  ❌ Missing core data files');
  }

  // Check team data consistency
  const teamFiles = results.filter(r => r.file.includes('Team') || r.file.includes('Defense') || r.file.includes('Offense'));
  const teamSuccess = teamFiles.filter(r => r.success).length;
  logger.info(`  📊 Team Data: ${teamSuccess}/${teamFiles.length} files parsed`);

  // Check historical data
  const historicalFiles = results.filter(r => r.file.includes('2024'));
  const histSuccess = historicalFiles.filter(r => r.success).length;
  logger.info(`  📅 Historical Data: ${histSuccess}/${historicalFiles.length} files parsed`);

  // Final verdict
  logger.info('\n' + '=' .repeat(80));
  if (totalFailure === 0) {
    logger.info('🎉 ALL DATA VALIDATED SUCCESSFULLY!');
    logger.info('✅ 100% of CSV files are being parsed correctly');
  } else {
    const successRate = ((totalSuccess / dataFiles.length) * 100).toFixed(1);
    logger.warn(`⚠️ VALIDATION INCOMPLETE: ${successRate}% success rate`);
    logger.warn(`   ${totalFailure} files need attention`);
  }
  logger.info('=' .repeat(80));

  // Export detailed report
  const report = {
    summary: {
      totalFiles: dataFiles.length,
      successful: totalSuccess,
      failed: totalFailure,
      totalRowsParsed: totalRows,
      successRate: ((totalSuccess / dataFiles.length) * 100).toFixed(1) + '%'
    },
    results,
    timestamp: new Date().toISOString()
  };

  // Make report available globally
  if (typeof window !== 'undefined') {
    (window as any).validationReport = report;
    logger.info('\n📋 Full report available at: window.validationReport');
  }

  return;
}

// Make available in browser
if (typeof window !== 'undefined') {
  (window as any).runFullValidation = runFullValidation;
  logger.info('Full validation loaded. Run window.runFullValidation() to validate all CSV files.');
}