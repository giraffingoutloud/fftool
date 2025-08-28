/**
 * Configuration Service
 * Loads and manages all configuration settings from CSV files
 * Allows runtime updates to valuation model parameters
 */

import Papa from 'papaparse';
import { logger } from './utils/logger';
import { parseCSV, safeParseFloat, safeParseInt, safeParseString } from './utils/csvParsingUtils';

export interface LeagueSettings {
  numTeams: number;
  auctionBudget: number;
  rosterSize: number;
  benchSpots: number;
  regularSeasonWeeks: number;
  playoffWeeks: number;
  starters: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number;
    DST: number;
    K: number;
  };
  rosterLimits: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    DST: number;
    K: number;
  };
  minBid: number;
}

export interface ScoringSystem {
  passing: {
    yards: number;
    touchdowns: number;
    interceptions: number;
  };
  rushing: {
    yards: number;
    touchdowns: number;
    attempts: number;
  };
  receiving: {
    receptions: number;
    yards: number;
    touchdowns: number;
    targets: number;
  };
  misc: {
    twoPointConversions: number;
    fumblesLost: number;
    fumbleRecoveryTd: number;
  };
}

export interface ReplacementLevels {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  DST: number;
  K: number;
}

export interface MarketAdjustments {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  DST: number;
  K: number;
}

export interface TierMultiplier {
  name: string;
  rankStart: number;
  rankEnd: number;
  multiplier: number;
}

export interface ProjectionWeight {
  source: string;
  weight: number;
  enabled: boolean;
}

export interface BudgetAllocation {
  position: string;
  minPercent: number;
  maxPercent: number;
  targetPercent: number;
}

export interface BidRanges {
  maxBidMultiplier: number;
  targetBidMultiplier: number;
  minBidMultiplier: number;
  aggressiveMax: number;
  aggressiveMin: number;
  conservativeMax: number;
  conservativeMin: number;
}

export interface ConfigurationData {
  leagueSettings: LeagueSettings;
  scoringSystem: ScoringSystem;
  replacementLevels: ReplacementLevels;
  marketAdjustments: MarketAdjustments;
  tierMultipliers: TierMultiplier[];
  projectionWeights: ProjectionWeight[];
  budgetAllocations: BudgetAllocation[];
  bidRanges: BidRanges;
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: ConfigurationData | null = null;
  private readonly CONFIG_PATH = '/canonical_data/config';
  
  private constructor() {}
  
  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }
  
  /**
   * Load all configuration files
   */
  public async loadConfiguration(): Promise<ConfigurationData> {
    try {
      logger.info('Loading configuration files...');
      
      const [
        leagueSettings,
        scoringSystem,
        replacementLevels,
        marketAdjustments,
        tierMultipliers,
        projectionWeights,
        budgetAllocations,
        bidRanges
      ] = await Promise.all([
        this.loadLeagueSettings(),
        this.loadScoringSystem(),
        this.loadReplacementLevels(),
        this.loadMarketAdjustments(),
        this.loadTierMultipliers(),
        this.loadProjectionWeights(),
        this.loadBudgetAllocations(),
        this.loadBidRanges()
      ]);
      
      this.config = {
        leagueSettings,
        scoringSystem,
        replacementLevels,
        marketAdjustments,
        tierMultipliers,
        projectionWeights,
        budgetAllocations,
        bidRanges
      };
      
      logger.info('Configuration loaded successfully');
      return this.config;
      
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      // Return default configuration if files not found
      return this.getDefaultConfiguration();
    }
  }
  
  /**
   * Get current configuration
   */
  public getConfiguration(): ConfigurationData {
    if (!this.config) {
      return this.getDefaultConfiguration();
    }
    return this.config;
  }
  
  /**
   * Update configuration (for UI updates)
   */
  public updateConfiguration(updates: Partial<ConfigurationData>): ConfigurationData {
    this.config = {
      ...this.config!,
      ...updates
    };
    
    // Trigger recalculation event
    window.dispatchEvent(new CustomEvent('configurationUpdated', { 
      detail: this.config 
    }));
    
    return this.config;
  }
  
  /**
   * Export configuration to JSON
   */
  public exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }
  
  /**
   * Import configuration from JSON
   */
  public importConfiguration(jsonString: string): ConfigurationData {
    try {
      const imported = JSON.parse(jsonString);
      this.config = imported;
      
      // Trigger recalculation
      window.dispatchEvent(new CustomEvent('configurationUpdated', { 
        detail: this.config 
      }));
      
      return this.config;
    } catch (error) {
      logger.error('Failed to import configuration:', error);
      throw new Error('Invalid configuration format');
    }
  }
  
  // Private loading methods
  
  private async loadLeagueSettings(): Promise<LeagueSettings> {
    const data = await this.loadCSV('league_settings.csv');
    
    const settings: any = {};
    data.forEach((row: any) => {
      const value = parseFloat(row.value);
      
      switch(row.setting_category) {
        case 'league_structure':
          if (row.setting_name === 'num_teams') settings.numTeams = value;
          if (row.setting_name === 'auction_budget') settings.auctionBudget = value;
          if (row.setting_name === 'roster_size') settings.rosterSize = value;
          if (row.setting_name === 'bench_spots') settings.benchSpots = value;
          if (row.setting_name === 'regular_season_weeks') settings.regularSeasonWeeks = value;
          if (row.setting_name === 'playoff_weeks') settings.playoffWeeks = value;
          break;
        case 'starting_lineup':
          if (!settings.starters) settings.starters = {};
          const pos = row.setting_name.replace('_starters', '').toUpperCase();
          settings.starters[pos === 'FLEX' ? 'FLEX' : pos] = value;
          break;
        case 'roster_limits':
          if (!settings.rosterLimits) settings.rosterLimits = {};
          const limitPos = row.setting_name.replace('max_', '').toUpperCase();
          settings.rosterLimits[limitPos] = value;
          break;
        case 'minimum_bid':
          settings.minBid = value;
          break;
      }
    });
    
    return settings as LeagueSettings;
  }
  
  private async loadScoringSystem(): Promise<ScoringSystem> {
    const data = await this.loadCSV('scoring_system.csv');
    
    const scoring: any = {
      passing: {},
      rushing: {},
      receiving: {},
      misc: {}
    };
    
    data.forEach((row: any) => {
      const value = parseFloat(row.points_value);
      
      switch(row.category) {
        case 'passing':
          if (row.stat_name === 'passing_yards') scoring.passing.yards = value;
          if (row.stat_name === 'passing_touchdowns') scoring.passing.touchdowns = value;
          if (row.stat_name === 'interceptions') scoring.passing.interceptions = value;
          break;
        case 'rushing':
          if (row.stat_name === 'rushing_yards') scoring.rushing.yards = value;
          if (row.stat_name === 'rushing_touchdowns') scoring.rushing.touchdowns = value;
          if (row.stat_name === 'rushing_attempts') scoring.rushing.attempts = value;
          break;
        case 'receiving':
          if (row.stat_name === 'receptions') scoring.receiving.receptions = value;
          if (row.stat_name === 'receiving_yards') scoring.receiving.yards = value;
          if (row.stat_name === 'receiving_touchdowns') scoring.receiving.touchdowns = value;
          if (row.stat_name === 'receiving_targets') scoring.receiving.targets = value;
          break;
        case 'misc':
          if (row.stat_name === 'two_point_conversions') scoring.misc.twoPointConversions = value;
          if (row.stat_name === 'fumbles_lost') scoring.misc.fumblesLost = value;
          if (row.stat_name === 'fumble_recovery_td') scoring.misc.fumbleRecoveryTd = value;
          break;
      }
    });
    
    return scoring as ScoringSystem;
  }
  
  private async loadReplacementLevels(): Promise<ReplacementLevels> {
    const data = await this.loadCSV('replacement_levels.csv');
    
    const levels: any = {};
    data.forEach((row: any) => {
      levels[row.position] = parseInt(row.replacement_rank);
    });
    
    return levels as ReplacementLevels;
  }
  
  private async loadMarketAdjustments(): Promise<MarketAdjustments> {
    const data = await this.loadCSV('market_adjustments.csv');
    
    const adjustments: any = {};
    data.forEach((row: any) => {
      adjustments[row.position] = parseFloat(row.market_adjustment);
    });
    
    return adjustments as MarketAdjustments;
  }
  
  private async loadTierMultipliers(): Promise<TierMultiplier[]> {
    const data = await this.loadCSV('tier_multipliers.csv');
    
    return data.map((row: any) => ({
      name: row.tier_name,
      rankStart: parseInt(row.rank_start),
      rankEnd: parseInt(row.rank_end),
      multiplier: parseFloat(row.multiplier)
    }));
  }
  
  private async loadProjectionWeights(): Promise<ProjectionWeight[]> {
    const data = await this.loadCSV('projection_weights.csv');
    
    return data.map((row: any) => ({
      source: row.source_name,
      weight: parseFloat(row.weight),
      enabled: row.enabled === 'true'
    }));
  }
  
  private async loadBudgetAllocations(): Promise<BudgetAllocation[]> {
    const data = await this.loadCSV('budget_allocation.csv');
    
    return data.map((row: any) => ({
      position: row.position,
      minPercent: parseFloat(row.min_percent),
      maxPercent: parseFloat(row.max_percent),
      targetPercent: parseFloat(row.target_percent)
    }));
  }
  
  private async loadBidRanges(): Promise<BidRanges> {
    const data = await this.loadCSV('bid_ranges.csv');
    
    const ranges: any = {};
    data.forEach((row: any) => {
      const value = parseFloat(row.multiplier);
      
      switch(row.range_type) {
        case 'max_bid':
          ranges.maxBidMultiplier = value;
          break;
        case 'target_bid':
          ranges.targetBidMultiplier = value;
          break;
        case 'min_bid':
          ranges.minBidMultiplier = value;
          break;
        case 'aggressive_max':
          ranges.aggressiveMax = value;
          break;
        case 'aggressive_min':
          ranges.aggressiveMin = value;
          break;
        case 'conservative_max':
          ranges.conservativeMax = value;
          break;
        case 'conservative_min':
          ranges.conservativeMin = value;
          break;
      }
    });
    
    return ranges as BidRanges;
  }
  
  private async loadCSV(filename: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.CONFIG_PATH}/${filename}`);
      const text = await response.text();
      
      const result = parseCSV(text, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: 'greedy'
      });
      
      return result.data;
    } catch (error) {
      logger.warn(`Could not load ${filename}, using defaults`);
      return [];
    }
  }
  
  /**
   * Get default configuration (current hardcoded values)
   */
  private getDefaultConfiguration(): ConfigurationData {
    return {
      leagueSettings: {
        numTeams: 12,
        auctionBudget: 200,
        rosterSize: 16,
        benchSpots: 7,
        regularSeasonWeeks: 18,
        playoffWeeks: 3,
        starters: {
          QB: 1,
          RB: 2,
          WR: 2,
          TE: 1,
          FLEX: 1,
          DST: 1,
          K: 1
        },
        rosterLimits: {
          QB: 3,
          RB: 8,
          WR: 8,
          TE: 3,
          DST: 2,
          K: 2
        },
        minBid: 1
      },
      scoringSystem: {
        passing: {
          yards: 0.04,
          touchdowns: 4,
          interceptions: -2
        },
        rushing: {
          yards: 0.1,
          touchdowns: 6,
          attempts: 0
        },
        receiving: {
          receptions: 1,
          yards: 0.1,
          touchdowns: 6,
          targets: 0
        },
        misc: {
          twoPointConversions: 2,
          fumblesLost: -2,
          fumbleRecoveryTd: 6
        }
      },
      replacementLevels: {
        QB: 15,
        RB: 48,
        WR: 60,
        TE: 18,
        DST: 14,
        K: 13
      },
      marketAdjustments: {
        QB: 0.85,
        RB: 1.15,
        WR: 1.00,
        TE: 0.90,
        DST: 0.50,
        K: 0.45
      },
      tierMultipliers: [
        { name: 'elite', rankStart: 1, rankEnd: 3, multiplier: 1.20 },
        { name: 'tier1', rankStart: 4, rankEnd: 8, multiplier: 1.10 },
        { name: 'tier2', rankStart: 9, rankEnd: 20, multiplier: 1.00 },
        { name: 'tier3', rankStart: 21, rankEnd: 36, multiplier: 0.92 },
        { name: 'tier4', rankStart: 37, rankEnd: 60, multiplier: 0.85 },
        { name: 'replacement', rankStart: 61, rankEnd: 999, multiplier: 0.75 }
      ],
      projectionWeights: [
        { source: 'fantasypros', weight: 0.40, enabled: true },
        { source: 'cbs', weight: 0.35, enabled: true },
        { source: 'projections_2025', weight: 0.25, enabled: true }
      ],
      budgetAllocations: [
        { position: 'QB', minPercent: 5, maxPercent: 10, targetPercent: 7 },
        { position: 'RB', minPercent: 45, maxPercent: 50, targetPercent: 48 },
        { position: 'WR', minPercent: 35, maxPercent: 40, targetPercent: 37 },
        { position: 'TE', minPercent: 5, maxPercent: 10, targetPercent: 7 },
        { position: 'DST', minPercent: 0.5, maxPercent: 1.5, targetPercent: 1 },
        { position: 'K', minPercent: 0.5, maxPercent: 1.0, targetPercent: 0.5 }
      ],
      bidRanges: {
        maxBidMultiplier: 1.15,
        targetBidMultiplier: 1.00,
        minBidMultiplier: 0.85,
        aggressiveMax: 1.25,
        aggressiveMin: 0.90,
        conservativeMax: 1.10,
        conservativeMin: 0.80
      }
    };
  }
}

export const configurationService = ConfigurationService.getInstance();