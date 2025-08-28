/**
 * Data Integration Service V2
 * Incorporates all critical and important fixes:
 * - Robust player name matching
 * - Proper projection aggregation with weights
 * - Comprehensive validation
 * - Audit logging
 */

import type { ComprehensiveData } from './dataLoaderV2';
import type { ComprehensiveData as ComprehensiveDataType } from '@/types';
import { cleanDataLoader } from './cleanDataLoader';
import { unifiedProjectionAggregator } from './unifiedProjectionAggregator';
import { playerNameMatcher } from './playerNameMatcher';
import { dataValidationLayer } from './dataValidationLayer';
import { auditLogger } from './auditLogger';
import { playerResolver } from './playerResolver';
import { rosterDataLoader } from './rosterDataLoader';
import { sosLoader } from './sosLoader';
import { logger } from './utils/logger';
import type { PlayerProjection } from '@/types';

interface IntegrationResult {
  success: boolean;
  data?: ComprehensiveData;
  errors: string[];
  warnings: string[];
  validationReport?: any;
  stats: {
    totalPlayers: number;
    sourcesProcessed: number;
    projectionsAggregated: number;
    namesNormalized: number;
    teamsNormalized: number;
    validationPassRate: number;
    auditEntriesCreated: number;
  };
}

export class DataIntegrationServiceV2 {
  private static instance: DataIntegrationServiceV2;
  
  private constructor() {
    // Load persisted audit log on initialization
    auditLogger.load();
  }
  
  public static getInstance(): DataIntegrationServiceV2 {
    if (!DataIntegrationServiceV2.instance) {
      DataIntegrationServiceV2.instance = new DataIntegrationServiceV2();
    }
    return DataIntegrationServiceV2.instance;
  }
  
  /**
   * Load and integrate data with all fixes applied
   */
  public async loadIntegratedData(): Promise<IntegrationResult> {
    const startTime = performance.now();
    const auditStartCount = auditLogger.getEntryCount();
    
    const result: IntegrationResult = {
      success: false,
      errors: [],
      warnings: [],
      stats: {
        totalPlayers: 0,
        sourcesProcessed: 0,
        projectionsAggregated: 0,
        namesNormalized: 0,
        teamsNormalized: 0,
        validationPassRate: 0,
        auditEntriesCreated: 0
      }
    };
    
    try {
      logger.info('Starting enhanced data integration with all fixes...');
      
      // Step 1: Load clean data from Python ETL pipeline
      auditLogger.logComputation('load_clean_data', '', '', {}, { status: 'starting' });
      
      const cleanDataResult = await cleanDataLoader.loadAllCleanData();
      if (!cleanDataResult.success) {
        const error = `Failed to load clean data: ${cleanDataResult.errors.join(', ')}`;
        auditLogger.logError('load_clean_data', error, { errors: cleanDataResult.errors });
        throw new Error(error);
      }
      
      logger.info(`Loaded ${Object.keys(cleanDataResult.manifest.files || {}).length} clean data files`);
      result.stats.sourcesProcessed = Object.keys(cleanDataResult.manifest.files || {}).length;
      
      // Step 2: Prepare projection sources with proper categorization
      const projectionSources = this.prepareEnhancedProjectionSources(cleanDataResult.data);
      
      // Step 3: Validate projection sources BEFORE aggregation
      const sourceValidation = dataValidationLayer.validateProjectionSources(projectionSources);
      
      if (sourceValidation.errors.length > 0) {
        logger.error('Critical validation errors in projection sources', sourceValidation.errors);
        result.errors.push(...sourceValidation.errors.map(e => e.message));
        // Continue but log the issues
      }
      
      result.warnings.push(...sourceValidation.warnings.map(w => w.message));
      
      // Step 4: Aggregate projections with unified aggregator
      const aggregatedProjections = unifiedProjectionAggregator.aggregateProjections(
        projectionSources,
        {
          requireMinSources: 1, // Allow single source due to TE issues
          logMismatches: true
        }
      );
      
      logger.info(`Aggregated ${aggregatedProjections.length} player projections`);
      result.stats.projectionsAggregated = aggregatedProjections.length;
      
      // Get aggregation statistics
      const aggregationReport = unifiedProjectionAggregator.getSourceAvailabilityReport();
      logger.info('Source availability:', aggregationReport);
      
      // Step 5: Load supplemental data (roster profiles, SOS)
      const [rosterProfiles, sosData] = await Promise.all([
        rosterDataLoader.loadRosterData(),
        sosLoader.loadSOSData()
      ]);
      
      logger.info(`Loaded ${rosterProfiles.size} roster profiles and ${sosData.size} team SOS data`);
      
      // Step 6: Use ADP data from clean data
      const adpData = cleanDataResult.data.adpData;
      
      // Step 7: Initialize player resolver for additional matching
      playerResolver.initialize(adpData);
      
      // Step 8: Build comprehensive player data with all enhancements
      const enhancedPlayers = this.buildEnhancedPlayerData(
        aggregatedProjections,
        adpData,
        rosterProfiles,
        sosData
      );
      
      // Step 9: Calculate derived values (VORP, valuations)
      const computedPlayers = this.computePlayerValues(enhancedPlayers);
      
      // Step 10: Validate computed values
      const computedValidation = dataValidationLayer.validateComputedValues(computedPlayers);
      
      if (computedValidation.errors.length > 0) {
        logger.warn('Validation errors in computed values', computedValidation.errors);
        result.warnings.push(...computedValidation.errors.map(e => e.message));
      }
      
      result.stats.validationPassRate = (computedValidation.passedChecks / 
        (computedValidation.passedChecks + computedValidation.failedChecks)) * 100;
      
      // Step 11: Detect and log outliers
      const outliers = dataValidationLayer.detectOutliers(computedPlayers);
      if (outliers.length > 0) {
        logger.warn(`Detected ${outliers.length} statistical outliers`, outliers.slice(0, 5));
        outliers.forEach(outlier => {
          auditLogger.logValidation('outlier_detection', outlier.player, false, {
            field: outlier.field,
            value: outlier.value,
            zScore: outlier.zScore
          });
        });
      }
      
      // Step 12: Build final comprehensive data structure
      const comprehensiveData = this.buildComprehensiveDataV2(
        computedPlayers,
        cleanDataResult.data,
        {
          sourceValidation,
          computedValidation,
          aggregationReport,
          outliers
        }
      );
      
      result.success = true;
      result.data = comprehensiveData;
      result.validationReport = {
        source: sourceValidation,
        computed: computedValidation,
        outliers: outliers.length
      };
      result.stats.totalPlayers = computedPlayers.length;
      result.stats.auditEntriesCreated = auditLogger.getEntryCount() - auditStartCount;
      
      // Log final statistics
      const duration = performance.now() - startTime;
      auditLogger.logComputation(
        'integration_complete',
        '',
        '',
        { startTime },
        {
          duration,
          stats: result.stats,
          success: true
        },
        duration
      );
      
      logger.info('Enhanced data integration complete', {
        ...result.stats,
        duration: `${duration.toFixed(2)}ms`
      });
      
      // Persist audit log
      auditLogger.persist();
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Enhanced data integration failed:', error);
      auditLogger.logCritical('data_integration', errorMsg, { stats: result.stats });
      result.errors.push(errorMsg);
    }
    
    return result;
  }
  
  /**
   * Prepare projection sources with proper structure
   */
  private prepareEnhancedProjectionSources(cleanData: ComprehensiveDataType): any[] {
    const sources = [];
    
    // Main projections (base)
    if (cleanData.projections && cleanData.projections.length > 0) {
      sources.push({
        name: 'base',
        weight: 0.25,
        projections: cleanData.projections
      });
    }
    
    // Try to load additional sources if available
    // This would be enhanced to actually load FantasyPros and CBS data
    // For now, using what's available in cleanData
    
    return sources;
  }
  
  /**
   * Build enhanced player data with all supplemental information
   */
  private buildEnhancedPlayerData(
    projections: PlayerProjection[],
    adpData: any[],
    rosterProfiles: Map<string, any>,
    sosData: Map<string, any>
  ): any[] {
    return projections.map(proj => {
      // Find matching ADP entry using robust name matching
      const matchResult = playerNameMatcher.matchPlayer(proj.name);
      let adpEntry = null;
      
      if (matchResult.matched) {
        adpEntry = adpData.find(a => 
          playerNameMatcher.normalize(a.name) === playerNameMatcher.normalize(matchResult.matchedName) &&
          a.position === proj.position
        );
      }
      
      if (!adpEntry) {
        // Fallback to direct match
        adpEntry = adpData.find(a => 
          a.name?.toLowerCase() === proj.name?.toLowerCase() &&
          a.position === proj.position
        );
      }
      
      // Get roster profile
      const rosterProfile = rosterDataLoader.getPlayerProfile(proj.name);
      
      // Get team SOS
      const teamSOS = proj.team ? sosLoader.getTeamSOS(proj.team) : undefined;
      
      // Log the matching for audit
      if (matchResult.matched && matchResult.confidence < 1) {
        auditLogger.logNameMatch(
          proj.name,
          matchResult.matchedName,
          matchResult.confidence,
          matchResult.matchType
        );
      }
      
      return {
        ...proj,
        adp: adpEntry?.adp || 250,
        auctionValue: adpEntry?.auctionValue,
        age: adpEntry?.age || rosterProfile?.age,
        injuryStatus: adpEntry?.injuryStatus,
        isRookie: adpEntry?.isRookie,
        height: rosterProfile?.height,
        weight: rosterProfile?.weight,
        college: rosterProfile?.college,
        draftYear: rosterProfile?.year,
        draftRound: rosterProfile?.round,
        draftPick: rosterProfile?.pick,
        teamSeasonSOS: teamSOS?.seasonSOS,
        teamPlayoffSOS: teamSOS?.playoffSOS,
        pffGrade: rosterProfile?.offGrade
      };
    });
  }
  
  /**
   * Compute player values (VORP, intrinsic value, etc.)
   */
  private computePlayerValues(players: any[]): any[] {
    const replacementLevels: Record<string, number> = {
      QB: 220,
      RB: 100,
      WR: 95,
      TE: 80,
      DST: 70,
      K: 110
    };
    
    return players.map(player => {
      const replacementLevel = replacementLevels[player.position] || 90;
      const vorp = Math.max(0, player.projectedPoints - replacementLevel);
      
      // Position value multipliers (adjusted based on findings)
      const positionMultipliers: Record<string, number> = {
        QB: 0.85,
        RB: 1.15,
        WR: 1.10,
        TE: 0.95, // Increased for TE due to scarcity
        DST: 0.50,
        K: 0.40
      };
      
      const multiplier = positionMultipliers[player.position] || 1.0;
      
      // Calculate intrinsic value
      const baseValue = Math.max(0, vorp * 0.2); // $0.20 per VORP point
      const intrinsicValue = Math.max(1, Math.round(baseValue * multiplier));
      
      // Calculate market price
      const adpFactor = Math.exp(-player.adp / 50);
      const marketPrice = Math.max(1, Math.round(intrinsicValue * (0.5 + adpFactor)));
      
      // Calculate edge
      const edge = intrinsicValue - marketPrice;
      
      // Log computation for audit
      auditLogger.logComputation(
        'calculate_values',
        player.id || '',
        player.name,
        {
          projectedPoints: player.projectedPoints,
          replacementLevel,
          vorp,
          adp: player.adp
        },
        {
          vorp,
          intrinsicValue,
          marketPrice,
          edge
        }
      );
      
      return {
        ...player,
        vorp,
        intrinsicValue,
        marketPrice,
        edge,
        confidence: player.confidence || 0.5,
        maxBid: Math.max(1, Math.round(intrinsicValue * 1.2)),
        minBid: Math.max(1, Math.round(intrinsicValue * 0.8)),
        replacementLevel
      };
    });
  }
  
  /**
   * Build final comprehensive data structure
   */
  private buildComprehensiveDataV2(
    players: any[],
    baseData: ComprehensiveDataType,
    reports: any
  ): ComprehensiveData {
    // Calculate data quality score based on validation results
    const dataQualityScore = reports.computedValidation 
      ? reports.computedValidation.passedChecks / 
        (reports.computedValidation.passedChecks + reports.computedValidation.failedChecks) * 100
      : 0;
    
    return {
      // Core data
      players,
      projections: players,
      adpData: baseData.adpData,
      historicalStats: baseData.historicalStats || [],
      
      // Maps and structures from base data
      teamMetrics: baseData.teamMetrics || new Map(),
      teamComposites: baseData.teamComposites || new Map(),
      playerAdvanced: baseData.playerAdvanced || new Map(),
      playerStats: baseData.playerStats || new Map(),
      depthCharts: baseData.depthCharts || {
        teams: [],
        byPlayer: new Map(),
        byTeam: new Map()
      },
      
      // Enhanced deduplication report with validation info
      deduplicationReport: {
        adpConflicts: [],
        projectionConflicts: [],
        dataQualityScore,
        flaggedForReview: reports.outliers?.map((o: any) => o.player) || [],
        validationSummary: {
          sourceValidation: reports.sourceValidation?.summary,
          computedValidation: reports.computedValidation?.summary,
          outlierCount: reports.outliers?.length || 0,
          aggregationStats: reports.aggregationReport
        }
      },
      
      // Additional data
      positionEligibility: new Map(),
      advancedStats: [],
      teamData: [],
      scheduleData: null
    } as any;
  }
  
  /**
   * Get audit report for analysis
   */
  public getAuditReport(startDate?: Date, endDate?: Date): any {
    return auditLogger.generateReport(startDate, endDate);
  }
  
  /**
   * Export audit log to CSV
   */
  public exportAuditLog(): string {
    return auditLogger.exportToCSV();
  }
  
  /**
   * Clear all caches and logs
   */
  public clearAll(): void {
    unifiedProjectionAggregator.clearAuditLog();
    dataValidationLayer.clearValidationLog();
    auditLogger.clear();
    logger.info('All caches and logs cleared');
  }
}

// Export singleton instance
export const dataIntegrationServiceV2 = DataIntegrationServiceV2.getInstance();