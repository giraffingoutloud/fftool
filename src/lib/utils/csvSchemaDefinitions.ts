/**
 * CSV Schema Definitions
 * Defines the expected structure and validation rules for all CSV data files
 */

import { ColumnSchema } from './csvParsingUtils';

/**
 * Schema for projections_2025.csv
 */
export const PROJECTIONS_SCHEMA: ColumnSchema[] = [
  { name: 'playerName', type: 'string', required: true },
  { name: 'position', type: 'string', required: true, allowedValues: ['QB', 'RB', 'WR', 'TE', 'DST', 'K'] },
  { name: 'teamName', type: 'string', required: true, pattern: /^[A-Z]{2,3}$/ },
  { name: 'byeWeek', type: 'number', required: false, min: 1, max: 18 },
  { name: 'fantasyPoints', type: 'number', required: true, min: 0, max: 600 },
  { name: 'games', type: 'number', required: false, min: 0, max: 17 },
  { name: 'passYds', type: 'number', required: false, min: 0, max: 6000 },
  { name: 'passTd', type: 'number', required: false, min: 0, max: 60 },
  { name: 'passInt', type: 'number', required: false, min: 0, max: 40 },
  { name: 'rushYds', type: 'number', required: false, min: 0, max: 2500 },
  { name: 'rushTd', type: 'number', required: false, min: 0, max: 30 },
  { name: 'recvReceptions', type: 'number', required: false, min: 0, max: 150 },
  { name: 'recvYds', type: 'number', required: false, min: 0, max: 2000 },
  { name: 'recvTd', type: 'number', required: false, min: 0, max: 20 },
  { name: 'recvTargets', type: 'number', required: false, min: 0, max: 200 },
  { name: 'auctionValue', type: 'number', required: false, min: 0, max: 100 }
];

/**
 * Schema for adp0_2025.csv
 */
export const ADP0_SCHEMA: ColumnSchema[] = [
  { name: 'Overall Rank', type: 'number', required: true, min: 1, max: 500 },
  { name: 'Full Name', type: 'string', required: true },
  { name: 'Team Abbreviation', type: 'string', required: true, pattern: /^[A-Z]{2,3}$/ },
  { name: 'Position', type: 'string', required: true, allowedValues: ['QB', 'RB', 'WR', 'TE', 'DST', 'K', 'FB'] },
  { name: 'Position Rank', type: 'number', required: false, min: 1, max: 100 },
  { name: 'ADP', type: 'number', required: false, min: 1, max: 500 }, // Now nullable
  { name: 'Auction Value', type: 'number', required: false, min: 0, max: 300 },
  { name: 'Bye Week', type: 'number', required: false, min: 1, max: 18 },
  { name: 'Is Rookie', type: 'string', required: false, allowedValues: ['Yes', 'No'] }
];

/**
 * Schema for adp1_2025.csv
 */
export const ADP1_SCHEMA: ColumnSchema[] = [
  { name: 'Name', type: 'string', required: true },
  { name: 'Team', type: 'string', required: true },
  { name: 'Pos', type: 'string', required: true },
  { name: 'ESPN', type: 'number', required: false, min: 1, max: 500 },
  { name: 'Sleeper', type: 'number', required: false, min: 1, max: 500 },
  { name: 'Fantrax', type: 'number', required: false, min: 1, max: 500 },
  { name: 'MFL', type: 'number', required: false, min: 1, max: 500 },
  { name: 'NFFC', type: 'number', required: false, min: 1, max: 500 },
  { name: 'ESPN_AAV', type: 'number', required: false, min: 0, max: 300 },
  { name: 'MFL_AAV', type: 'number', required: false, min: 0, max: 300 }
];

/**
 * Schema for adp2_2025.csv
 */
export const ADP2_SCHEMA: ColumnSchema[] = [
  { name: 'Name', type: 'string', required: true },
  { name: 'Age', type: 'number', required: false, min: 18, max: 45 },
  { name: 'Status', type: 'string', required: false },
  { name: 'Fantasy Score', type: 'number', required: false, min: 0, max: 600 }
];

/**
 * Schema for adp3_2025.csv
 */
export const ADP3_SCHEMA: ColumnSchema[] = [
  { name: 'ADP', type: 'number', required: false, min: 1, max: 500 },
  { name: 'Player', type: 'string', required: true },
  { name: 'Team', type: 'string', required: true },
  { name: 'Position', type: 'string', required: true }
];

/**
 * Schema for sos_2025.csv - Updated format with normalized SOS values
 */
export const SOS_SCHEMA: ColumnSchema[] = [
  { name: 'Team', type: 'string', required: true },
  { name: 'SOS_Rank', type: 'number', required: true, min: 1, max: 32 },
  { name: 'SOS_Percentage', type: 'number', required: true, min: 0, max: 1 },
  { name: 'SOS_Normalized', type: 'number', required: true, min: 0, max: 10 }
];

/**
 * Schema for fantasy-stats-passing_2024.csv
 */
export const STATS_PASSING_SCHEMA: ColumnSchema[] = [
  { name: 'player', type: 'string', required: true },
  { name: 'team', type: 'string', required: true },
  { name: 'Games', type: 'number', required: false, min: 0, max: 17 },
  { name: 'Completions', type: 'number', required: false, min: 0, max: 500 },
  { name: 'Attempts', type: 'number', required: false, min: 0, max: 750 },
  { name: 'Passing Yards', type: 'number', required: false, min: 0, max: 6000 },
  { name: 'Passing TDs', type: 'number', required: false, min: 0, max: 60 },
  { name: 'Interceptions', type: 'number', required: false, min: 0, max: 40 },
  { name: 'Fantasy Points', type: 'number', required: false, min: 0, max: 600 }
];

/**
 * Schema for fantasy-stats-receiving_rushing_2024.csv
 */
export const STATS_RECEIVING_RUSHING_SCHEMA: ColumnSchema[] = [
  { name: 'player', type: 'string', required: true },
  { name: 'team', type: 'string', required: true },
  { name: 'position', type: 'string', required: true },
  { name: 'Games', type: 'number', required: false, min: 0, max: 17 },
  { name: 'Rushing Attempts', type: 'number', required: false, min: 0, max: 400 },
  { name: 'Rushing Yards', type: 'number', required: false, min: -100, max: 2500 },
  { name: 'Rushing TDs', type: 'number', required: false, min: 0, max: 30 },
  { name: 'Receptions', type: 'number', required: false, min: 0, max: 150 },
  { name: 'Targets', type: 'number', required: false, min: 0, max: 200 },
  { name: 'Receiving Yards', type: 'number', required: false, min: 0, max: 2000 },
  { name: 'Receiving TDs', type: 'number', required: false, min: 0, max: 20 },
  { name: 'Fantasy Points', type: 'number', required: false, min: 0, max: 600 }
];

/**
 * Schema for configuration CSV files
 */
export const CONFIG_LEAGUE_SETTINGS_SCHEMA: ColumnSchema[] = [
  { name: 'setting', type: 'string', required: true },
  { name: 'value', type: 'string', required: true }
];

export const CONFIG_SCORING_SCHEMA: ColumnSchema[] = [
  { name: 'category', type: 'string', required: true },
  { name: 'stat', type: 'string', required: true },
  { name: 'points', type: 'number', required: true, min: -10, max: 10 }
];

export const CONFIG_REPLACEMENT_LEVELS_SCHEMA: ColumnSchema[] = [
  { name: 'position', type: 'string', required: true },
  { name: 'rank', type: 'number', required: true, min: 1, max: 100 }
];

export const CONFIG_MARKET_ADJUSTMENTS_SCHEMA: ColumnSchema[] = [
  { name: 'position', type: 'string', required: true },
  { name: 'multiplier', type: 'number', required: true, min: 0.5, max: 2.0 }
];

export const CONFIG_TIER_MULTIPLIERS_SCHEMA: ColumnSchema[] = [
  { name: 'tier', type: 'string', required: true },
  { name: 'multiplier', type: 'number', required: true, min: 0.8, max: 1.5 }
];

export const CONFIG_PROJECTION_WEIGHTS_SCHEMA: ColumnSchema[] = [
  { name: 'source', type: 'string', required: true },
  { name: 'weight', type: 'number', required: true, min: 0, max: 1 }
];

export const CONFIG_BUDGET_ALLOCATION_SCHEMA: ColumnSchema[] = [
  { name: 'position', type: 'string', required: true },
  { name: 'percentage', type: 'number', required: true, min: 0, max: 100 }
];

export const CONFIG_BID_RANGES_SCHEMA: ColumnSchema[] = [
  { name: 'tier', type: 'string', required: true },
  { name: 'min_multiplier', type: 'number', required: true, min: 0.5, max: 1.5 },
  { name: 'max_multiplier', type: 'number', required: true, min: 0.8, max: 2.0 }
];

/**
 * Map of file names to their schemas
 */
export const FILE_SCHEMAS: Record<string, ColumnSchema[]> = {
  'projections_2025.csv': PROJECTIONS_SCHEMA,
  'adp0_2025.csv': ADP0_SCHEMA,
  'adp1_2025.csv': ADP1_SCHEMA,
  'adp2_2025.csv': ADP2_SCHEMA,
  'adp3_2025.csv': ADP3_SCHEMA,
  'sos_2025.csv': SOS_SCHEMA,
  'fantasy-stats-passing_2024.csv': STATS_PASSING_SCHEMA,
  'fantasy-stats-receiving_rushing_2024.csv': STATS_RECEIVING_RUSHING_SCHEMA,
  'league_settings.csv': CONFIG_LEAGUE_SETTINGS_SCHEMA,
  'scoring_system.csv': CONFIG_SCORING_SCHEMA,
  'replacement_levels.csv': CONFIG_REPLACEMENT_LEVELS_SCHEMA,
  'market_adjustments.csv': CONFIG_MARKET_ADJUSTMENTS_SCHEMA,
  'tier_multipliers.csv': CONFIG_TIER_MULTIPLIERS_SCHEMA,
  'projection_weights.csv': CONFIG_PROJECTION_WEIGHTS_SCHEMA,
  'budget_allocation.csv': CONFIG_BUDGET_ALLOCATION_SCHEMA,
  'bid_ranges.csv': CONFIG_BID_RANGES_SCHEMA
};

/**
 * Get schema for a specific file
 */
export function getSchemaForFile(filename: string): ColumnSchema[] | null {
  // Handle both full paths and just filenames
  const basename = filename.split('/').pop() || filename;
  return FILE_SCHEMAS[basename] || null;
}