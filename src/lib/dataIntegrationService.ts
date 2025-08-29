/**
 * Data Integration Service
 * Bridges the gap between Python ETL pipeline and TypeScript data aggregation
 * 
 * This service ensures:
 * 1. Clean data from Python ETL is properly loaded
 * 2. ProjectionAggregator combines multiple sources with weights
 * 3. PlayerResolver handles name/team normalization
 * 4. All inconsistencies are properly handled
 */

import type { ComprehensiveData } from './dataLoaderV2';
import type { ComprehensiveData as ComprehensiveDataType } from '@/types';
import { cleanDataLoader } from './cleanDataLoader';
import { ProjectionAggregator } from './projectionAggregator';
import { playerResolver } from './playerResolver';
import { rosterDataLoader } from './rosterDataLoader';
import { sosLoader } from './sosLoader';
import { logger } from './utils/logger';
import type { PlayerProjection } from '@/types';
import { safeParseFloat, safeParseInt } from './utils/csvParsingUtils';
import { loadAllPlayerAdvanced } from './playerAdvancedLoader';

interface IntegrationResult {
  success: boolean;
  data?: ComprehensiveData;
  errors: string[];
  warnings: string[];
  stats: {
    totalPlayers: number;
    sourcesProcessed: number;
    projectionsAggregated: number;
    namesNormalized: number;
    teamsNormalized: number;
  };
}

export class DataIntegrationService {
  private static instance: DataIntegrationService;
  private aggregator: ProjectionAggregator;
  
  private constructor() {
    this.aggregator = new ProjectionAggregator();
  }
  
  public static getInstance(): DataIntegrationService {
    if (!DataIntegrationService.instance) {
      DataIntegrationService.instance = new DataIntegrationService();
    }
    return DataIntegrationService.instance;
  }
  
  /**
   * Load and integrate data from all sources
   * This is the MAIN entry point that properly uses:
   * 1. Clean data from Python ETL
   * 2. Weighted aggregation
   * 3. Name/team normalization
   */
  public async loadIntegratedData(): Promise<IntegrationResult> {
    const result: IntegrationResult = {
      success: false,
      errors: [],
      warnings: [],
      stats: {
        totalPlayers: 0,
        sourcesProcessed: 0,
        projectionsAggregated: 0,
        namesNormalized: 0,
        teamsNormalized: 0
      }
    };
    
    try {
      logger.info('Starting data integration...');
      
      // Step 1: Load clean data from Python ETL pipeline
      const cleanDataResult = await cleanDataLoader.loadAllCleanData();
      if (!cleanDataResult.success) {
        throw new Error(`Failed to load clean data: ${cleanDataResult.errors.join(', ')}`);
      }
      
      logger.info(`Loaded ${Object.keys(cleanDataResult.manifest.files || {}).length} clean data files`);
      result.stats.sourcesProcessed = Object.keys(cleanDataResult.manifest.files || {}).length;
      
      // Step 2: Prepare projection sources for aggregation
      // Use the ComprehensiveData structure from cleanDataResult
      const projectionSources = this.prepareProjectionSourcesFromComprehensive(cleanDataResult.data);
      
      // Step 3: Aggregate projections with weighting
      // The aggregator already handles:
      // - FantasyPros: 40% weight
      // - CBS: 35% weight  
      // - projections_2025: 25% weight
      const aggregatedProjections = this.aggregator.aggregateProjections(projectionSources);
      const validatedProjections = this.aggregator.validateProjections(aggregatedProjections);
      
      logger.info(`Aggregated ${validatedProjections.length} player projections`);
      
      // Debug: Check for problematic players in projections
      const problematicNames = ['Marquise Brown', 'Hollywood Brown', 'Bills DST', 'Cowboys DST', 'Marvin Mims'];
      const foundProblematic = validatedProjections.filter(p => 
        problematicNames.some(name => p.name?.includes(name))
      );
      if (foundProblematic.length > 0) {
        logger.debug('Found problematic players in projections:', foundProblematic.map(p => `${p.name} (${p.position}, ${p.team})`));
      }
      result.stats.projectionsAggregated = validatedProjections.length;
      
      // Step 4: Use ADP data from clean data (already normalized by Python ETL)
      const adpData = cleanDataResult.data.adpData;
      
      // Process ADP data structure
      
      // Step 5: Initialize player resolver for name matching
      logger.info(`Initializing PlayerResolver with ${adpData.length} ADP entries`);
      
      // Check for DSTs in ADP data
      const dstInADP = adpData.filter((p: any) => p.position === 'DST');
      logger.info(`  Found ${dstInADP.length} DST entries in ADP data`);
      
      playerResolver.initialize(adpData);
      
      // Step 5.5: Load roster data for player profiles (height, weight, college, etc.)
      const rosterProfiles = await rosterDataLoader.loadRosterData();
      logger.info(`Loaded ${rosterProfiles.size} player profiles from roster data`);
      
      // Step 5.6: Load strength of schedule data
      const sosData = await sosLoader.loadSOSData();
      logger.info(`Loaded SOS data for ${sosData.size} teams`);
      
      // Step 6: Match and normalize all players
      const normalizedData = this.normalizeAllData({
        projections: validatedProjections,
        adp: adpData,
        cleanData: cleanDataResult.data,
        rosterProfiles: rosterProfiles,
        sosData: sosData
      });
      
      result.stats.namesNormalized = normalizedData.namesNormalized;
      result.stats.teamsNormalized = normalizedData.teamsNormalized;
      
      // Step 7: Use DataLoaderV2 to get the final comprehensive structure
      // But inject our properly integrated data
      const comprehensiveData = await this.buildComprehensiveData(normalizedData);
      
      result.success = true;
      result.data = comprehensiveData;
      result.stats.totalPlayers = comprehensiveData.players.length;
      
      logger.info('Data integration complete', result.stats);
      
      // Log any warnings about mismatches
      if (normalizedData.unmatchedPlayers.length > 0) {
        result.warnings.push(`${normalizedData.unmatchedPlayers.length} players could not be matched across sources`);
        // Log first 10 unmatched players for debugging
        const firstTen = normalizedData.unmatchedPlayers.slice(0, 10);
        logger.warn('Unmatched players:', firstTen);
        
        // Also log details about why they didn't match
        if (normalizedData.unmatchedPlayers.length <= 20) {
          logger.info(`All ${normalizedData.unmatchedPlayers.length} unmatched:`, normalizedData.unmatchedPlayers);
        }
      }
      
    } catch (error) {
      logger.error('Data integration failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    return result;
  }
  
  /**
   * Prepare projection sources from comprehensive clean data
   */
  private prepareProjectionSourcesFromComprehensive(cleanData: ComprehensiveDataType): any[] {
    // Use projections directly from ComprehensiveData
    const sources = [];
    
    // The clean data loader already aggregated projections
    // We just need to format them for the aggregator
    if (cleanData.projections && cleanData.projections.length > 0) {
      // Debug: Check what names are in the projections
      const sampleProjections = cleanData.projections.slice(0, 5);
      logger.debug('Sample projections from cleanData:', sampleProjections.map(p => `${p.name} (${p.position}, ${p.team})`));
      
      // Check for specific problematic players
      const marquise = cleanData.projections.find(p => p.name?.includes('Marquise') || p.name?.includes('Hollywood'));
      const billsDst = cleanData.projections.find(p => p.name?.includes('Bills') && p.position === 'DST');
      if (marquise) logger.debug('Found Marquise/Hollywood:', marquise.name);
      if (billsDst) logger.debug('Found Bills DST:', billsDst.name);
      
      sources.push({
        name: 'clean_aggregated',
        weight: 1.0, // Use full weight since it's already processed
        projections: cleanData.projections
      });
    }
    
    return sources;
  }
  
  /**
   * Legacy: Prepare projection sources from raw clean data files
   */
  private prepareProjectionSources(cleanData: any): any[] {
    const sources = [];
    
    // FantasyPros projections
    const fantasyProsSources = [
      'FantasyPros_Fantasy_Football_Projections_RB.csv',
      'FantasyPros_Fantasy_Football_Projections_WR.csv',
      'FantasyPros_Fantasy_Football_Projections_TE.csv',
      'FantasyPros_Fantasy_Football_Projections_FLX.csv'
    ];
    
    fantasyProsSources.forEach(filename => {
      if (cleanData[filename]) {
        sources.push({
          name: 'fantasypros',
          weight: 0.4,
          projections: this.parseFantasyProsProjections(cleanData[filename])
        });
      }
    });
    
    // CBS projections
    const cbsSources = [
      'qb_projections_2025_cbs.txt',
      'rb_projections_2025_cbs.txt',
      'wr_projections_2025_cbs.txt',
      'te_projections_2025_cbs.txt'
    ];
    
    cbsSources.forEach(filename => {
      if (cleanData[filename]) {
        sources.push({
          name: 'cbs',
          weight: 0.35,
          projections: this.parseCBSProjections(cleanData[filename])
        });
      }
    });
    
    // Main projections file
    if (cleanData['projections_2025.csv']) {
      sources.push({
        name: 'projections_2025',
        weight: 0.25,
        projections: this.parseMainProjections(cleanData['projections_2025.csv'])
      });
    }
    
    return sources.filter(s => s.projections.length > 0);
  }
  
  /**
   * Parse FantasyPros projection format
   */
  private parseFantasyProsProjections(data: any[]): PlayerProjection[] {
    return data.map(row => ({
      id: `${row.Player}_${row.Pos}_${row.Team}`.toLowerCase(),
      name: row.Player || row.player,
      position: row.Pos || row.position,
      team: row.Team || row.team,
      projectedPoints: safeParseFloat(row.FPTS || row.fantasyPoints, 2) ?? 0,
      byeWeek: safeParseInt(row.BYE || row.bye) ?? 0,
      games: safeParseInt(row.G || row.games) ?? 16,
      
      // Position-specific stats
      passingYards: safeParseFloat(row['Pass Yds'] || row.passingYards, 1) ?? 0,
      passingTDs: safeParseFloat(row['Pass TD'] || row.passingTDs, 1) ?? 0,
      rushingYards: safeParseFloat(row['Rush Yds'] || row.rushingYards, 1) ?? 0,
      rushingTDs: safeParseFloat(row['Rush TD'] || row.rushingTDs, 1) ?? 0,
      receivingYards: safeParseFloat(row['Rec Yds'] || row.receivingYards, 1) ?? 0,
      receivingTDs: safeParseFloat(row['Rec TD'] || row.receivingTDs, 1) ?? 0,
      receptions: safeParseFloat(row.Rec || row.receptions, 1) ?? 0,
      targets: safeParseFloat(row.Tgt || row.targets, 1) ?? 0
    }));
  }
  
  /**
   * Parse CBS projection format
   */
  private parseCBSProjections(data: any[]): PlayerProjection[] {
    return data.map(row => ({
      id: `${row.Name || row.Player}_${row.Position}_${row.Team}`.toLowerCase(),
      name: row.Name || row.Player,
      position: row.Position || row.Pos,
      team: row.Team,
      projectedPoints: safeParseFloat(row['Fantasy Points'] || row.FPTS, 2) ?? 0,
      
      // CBS includes more detailed stats
      passingYards: safeParseFloat(row['Passing Yards'], 1) ?? 0,
      passingTDs: safeParseFloat(row['Passing TDs'], 1) ?? 0,
      rushingYards: safeParseFloat(row['Rushing Yards'], 1) ?? 0,
      rushingTDs: safeParseFloat(row['Rushing TDs'], 1) ?? 0,
      receivingYards: safeParseFloat(row['Receiving Yards'], 1) ?? 0,
      receivingTDs: safeParseFloat(row['Receiving TDs'], 1) ?? 0,
      receptions: safeParseFloat(row.Receptions, 1) ?? 0
    }));
  }
  
  /**
   * Parse main projections file
   */
  private parseMainProjections(data: any[]): PlayerProjection[] {
    return data.map(row => ({
      id: `${row.playerName}_${row.position}_${row.teamName}`.toLowerCase(),
      name: row.playerName,
      position: row.position,
      team: row.teamName,
      projectedPoints: safeParseFloat(row.fantasyPoints, 2) ?? 0,
      byeWeek: safeParseInt(row.byeWeek) ?? 0,
      games: safeParseInt(row.games) ?? 16,
      
      passingYards: safeParseFloat(row.passYds, 1) ?? 0,
      passingTDs: safeParseFloat(row.passTd, 1) ?? 0,
      rushingYards: safeParseFloat(row.rushYds, 1) ?? 0,
      rushingTDs: safeParseFloat(row.rushTd, 1) ?? 0,
      receivingYards: safeParseFloat(row.recvYds, 1) ?? 0,
      receivingTDs: safeParseFloat(row.recvTd, 1) ?? 0,
      receptions: safeParseFloat(row.recvReceptions, 1) ?? 0,
      targets: safeParseFloat(row.recvTargets, 1) ?? 0
    }));
  }
  
  /**
   * Load ADP data from clean files
   */
  private loadADPData(cleanData: any): any[] {
    const adpFiles = ['adp0_2025.csv', 'adp3_2025.csv', 'adp5_2025.txt'];
    const allADP = [];
    
    for (const filename of adpFiles) {
      if (cleanData[filename]) {
        allADP.push(...cleanData[filename]);
      }
    }
    
    return allADP;
  }
  
  /**
   * Normalize all data using player resolver
   */
  private normalizeAllData(data: any): any {
    const result = {
      projections: data.projections,
      adp: data.adp,
      namesNormalized: 0,
      teamsNormalized: 0,
      unmatchedPlayers: [] as string[],
      rosterProfiles: data.rosterProfiles
    };
    
    // Track normalizations for reporting
    const nameNormalizations = new Set();
    const teamNormalizations = new Set();
    
    // Normalize projections and merge roster profiles
    data.projections.forEach((proj: any) => {
      // Team normalization (already done by Python ETL but verify)
      const normalizedTeam = playerResolver.normalizeTeam(proj.team);
      if (normalizedTeam !== proj.team) {
        teamNormalizations.add(`${proj.team} -> ${normalizedTeam}`);
        proj.team = normalizedTeam;
      }
      
      // Player matching (normalize position to uppercase for DSTs)
      const normalizedPosition = proj.position?.toUpperCase() || proj.position;
      
      // Debug problematic players
      const isProblematic = normalizedPosition === 'DST' || 
                          proj.name?.includes('Marquise') || 
                          proj.name?.includes('Marvin Mims') ||
                          proj.name?.includes('Luther');
      
      if (isProblematic) {
        logger.info(`Attempting to match: "${proj.name}" (pos: ${proj.position} -> ${normalizedPosition}, team: ${proj.team})`);
      }
      
      const match = playerResolver.findBestMatch(proj.name, proj.team, normalizedPosition);
      
      if (isProblematic) {
        logger.info(`  Match result: ${match.matchType} (confidence: ${match.confidence})`);
        if (match.player) {
          logger.info(`  Matched to: ${match.player.name}`);
        }
      }
      
      // Handle all match types
      if (match.matchType !== 'not_found') {
        // If it's not an exact match, track the normalization
        if (match.matchType !== 'exact' && match.player) {
          nameNormalizations.add(`${proj.name} -> ${match.player.name}`);
          // Update the projection name to the matched ADP name
          proj.name = match.player.name;
        }
        // For exact matches, the name is already correct
      } else {
        // Only add to unmatched if truly not found
        result.unmatchedPlayers.push(proj.name);
      }
      
      // Merge roster profile data if available
      if (data.rosterProfiles) {
        const profile = rosterDataLoader.getPlayerProfile(proj.name);
        if (profile) {
          proj.height = profile.height;
          proj.weight = profile.weight;
          proj.college = profile.college;
          proj.draftYear = profile.year;
          proj.draftRound = profile.round;
          proj.draftPick = profile.pick;
        }
      }
      
      // Add SOS data if available
      if (data.sosData && proj.team) {
        const teamSOS = sosLoader.getTeamSOS(proj.team);
        if (teamSOS) {
          proj.teamSeasonSOS = teamSOS.seasonSOS;
          proj.teamPlayoffSOS = teamSOS.playoffSOS;
          
          // Debug SOS for specific teams
          if (proj.team === 'NYJ' || proj.team === 'SF' || proj.team === 'DET') {
            console.log(`[SOS DEBUG] ${proj.name} (${proj.team}): Season SOS = ${teamSOS.seasonSOS}`);
          }
        } else {
          console.log(`[SOS WARNING] No SOS data for team: ${proj.team}`);
        }
      }
    });
    
    // Also merge roster profiles into ADP data
    data.adp.forEach((adpEntry: any) => {
      if (data.rosterProfiles) {
        const profile = rosterDataLoader.getPlayerProfile(adpEntry.name);
        if (profile) {
          adpEntry.height = profile.height;
          adpEntry.weight = profile.weight;
          adpEntry.college = profile.college;
          adpEntry.draftYear = profile.year;
          adpEntry.draftRound = profile.round;
          adpEntry.draftPick = profile.pick;
        }
      }
      
      // Add SOS data to ADP entries
      if (data.sosData && adpEntry.team) {
        const teamSOS = sosLoader.getTeamSOS(adpEntry.team);
        if (teamSOS) {
          adpEntry.teamSeasonSOS = teamSOS.seasonSOS;
          adpEntry.teamPlayoffSOS = teamSOS.playoffSOS;
        }
      }
    });
    
    result.namesNormalized = nameNormalizations.size;
    result.teamsNormalized = teamNormalizations.size;
    
    return result;
  }
  
  /**
   * Build final comprehensive data structure
   */
  private async buildComprehensiveData(normalizedData: any): Promise<ComprehensiveData> {
    // Build the comprehensive data structure directly
    // This avoids circular dependency with DataLoaderV2
    
    // Load advanced stats
    console.log('[DataIntegrationService] Loading player advanced stats...');
    const playerAdvancedMap = await loadAllPlayerAdvanced();
    console.log('[DataIntegrationService] Loaded advanced stats:', playerAdvancedMap.size);
    
    const comprehensiveData: ComprehensiveData = {
      // Core data from integration
      players: normalizedData.projections,
      projections: normalizedData.projections,
      adpData: normalizedData.adp,
      historicalStats: [],
      
      // Initialize empty structures for compatibility
      teamMetrics: new Map(),
      teamComposites: new Map(),
      playerAdvanced: playerAdvancedMap,
      playerStats: new Map(),
      depthCharts: {
        teams: [],
        byPlayer: new Map(),
        byTeam: new Map()
      },
      
      // Deduplication report
      deduplicationReport: {
        adpConflicts: [],
        projectionConflicts: [],
        dataQualityScore: this.calculateDataQualityScore(normalizedData),
        flaggedForReview: normalizedData.unmatchedPlayers || []
      },
      
      // Position eligibility
      positionEligibility: new Map(),
      
      // Legacy compatibility
      advancedStats: [],
      teamData: [],
      scheduleData: null
    };
    
    return comprehensiveData;
  }
  
  /**
   * Calculate data quality score
   */
  private calculateDataQualityScore(data: any): number {
    let score = 100;
    
    // Deduct for unmatched players
    if (data.unmatchedPlayers && data.unmatchedPlayers.length > 0) {
      score -= Math.min(20, data.unmatchedPlayers.length / 10);
    }
    
    // Deduct for missing projections
    const playersWithProjections = data.projections.filter((p: any) => p.projectedPoints > 0).length;
    const projectionCoverage = playersWithProjections / Math.max(1, data.projections.length);
    score = score * projectionCoverage;
    
    return Math.round(Math.max(0, score));
  }
}

// Export singleton instance
export const dataIntegrationService = DataIntegrationService.getInstance();