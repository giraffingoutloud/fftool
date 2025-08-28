/**
 * Unified Projection Aggregator
 * Implements proper weighted aggregation with source tracking and fallback logic
 */

import { playerNameMatcher } from './playerNameMatcher';
import { logger } from './utils/logger';
import type { PlayerProjection } from '@/types';

interface ProjectionSource {
  name: string;
  weight: number;
  projections: PlayerProjection[];
}

interface AggregationResult {
  projection: PlayerProjection;
  sourcesUsed: string[];
  totalWeight: number;
  confidence: number;
  warnings: string[];
}

interface AggregationAudit {
  playerId: string;
  playerName: string;
  position: string;
  sources: {
    name: string;
    found: boolean;
    points?: number;
    weight: number;
  }[];
  finalPoints: number;
  totalWeight: number;
  confidence: number;
  timestamp: Date;
}

export class UnifiedProjectionAggregator {
  private static instance: UnifiedProjectionAggregator;
  
  // Standard weights for aggregation
  private readonly WEIGHTS = {
    fantasypros: 0.40,
    cbs: 0.35,
    base: 0.25,
    espn: 0.15,
    sleeper: 0.10
  };
  
  // Minimum confidence threshold
  private readonly MIN_CONFIDENCE = 0.6;
  
  // Audit log
  private auditLog: AggregationAudit[] = [];
  
  // Source availability tracking
  private sourceAvailability: Map<string, number> = new Map();
  
  private constructor() {}
  
  public static getInstance(): UnifiedProjectionAggregator {
    if (!UnifiedProjectionAggregator.instance) {
      UnifiedProjectionAggregator.instance = new UnifiedProjectionAggregator();
    }
    return UnifiedProjectionAggregator.instance;
  }
  
  /**
   * Aggregate projections from multiple sources
   */
  public aggregateProjections(
    sources: ProjectionSource[],
    options?: {
      requireMinSources?: number;
      customWeights?: Record<string, number>;
      logMismatches?: boolean;
    }
  ): PlayerProjection[] {
    const requireMinSources = options?.requireMinSources ?? 2;
    const weights = options?.customWeights || this.WEIGHTS;
    const logMismatches = options?.logMismatches ?? true;
    
    // Build a map of all unique players
    const allPlayers = new Map<string, {
      name: string;
      team: string;
      position: string;
    }>();
    
    // Collect all unique players from all sources
    sources.forEach(source => {
      source.projections.forEach(proj => {
        const key = this.createPlayerKey(proj.name, proj.position, proj.team);
        if (!allPlayers.has(key)) {
          allPlayers.set(key, {
            name: proj.name,
            team: proj.team,
            position: proj.position
          });
        }
      });
    });
    
    // Aggregate for each player
    const aggregatedProjections: PlayerProjection[] = [];
    
    allPlayers.forEach((playerInfo, playerKey) => {
      const result = this.aggregatePlayerProjection(
        playerInfo,
        sources,
        weights,
        requireMinSources,
        logMismatches
      );
      
      if (result && result.confidence >= this.MIN_CONFIDENCE) {
        aggregatedProjections.push(result.projection);
      }
    });
    
    // Log aggregation statistics
    this.logAggregationStats(aggregatedProjections.length);
    
    return aggregatedProjections;
  }
  
  /**
   * Aggregate projection for a single player
   */
  private aggregatePlayerProjection(
    playerInfo: { name: string; team: string; position: string },
    sources: ProjectionSource[],
    weights: Record<string, number>,
    requireMinSources: number,
    logMismatches: boolean
  ): AggregationResult | null {
    const audit: AggregationAudit = {
      playerId: this.createPlayerKey(playerInfo.name, playerInfo.position, playerInfo.team),
      playerName: playerInfo.name,
      position: playerInfo.position,
      sources: [],
      finalPoints: 0,
      totalWeight: 0,
      confidence: 0,
      timestamp: new Date()
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    const sourcesUsed: string[] = [];
    const warnings: string[] = [];
    const projectionValues: Record<string, number> = {};
    
    // Try to find player in each source
    sources.forEach(source => {
      const projection = this.findPlayerInSource(
        playerInfo.name,
        playerInfo.position,
        source.projections
      );
      
      const sourceWeight = weights[source.name.toLowerCase()] || source.weight || 0;
      
      audit.sources.push({
        name: source.name,
        found: !!projection,
        points: projection?.projectedPoints,
        weight: sourceWeight
      });
      
      if (projection) {
        const points = projection.projectedPoints || 0;
        weightedSum += points * sourceWeight;
        totalWeight += sourceWeight;
        sourcesUsed.push(source.name);
        projectionValues[source.name] = points;
        
        // Track source availability
        this.sourceAvailability.set(
          source.name,
          (this.sourceAvailability.get(source.name) || 0) + 1
        );
      } else if (logMismatches) {
        warnings.push(`Player ${playerInfo.name} not found in ${source.name}`);
      }
    });
    
    // Check if we have enough sources
    if (sourcesUsed.length < requireMinSources) {
      if (logMismatches) {
        logger.warn('Insufficient sources for player', {
          player: playerInfo.name,
          sourcesFound: sourcesUsed.length,
          required: requireMinSources
        });
      }
      return null;
    }
    
    // Calculate final projection
    const finalPoints = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Calculate confidence based on sources used and weight coverage
    const confidence = this.calculateConfidence(
      sourcesUsed.length,
      totalWeight,
      projectionValues
    );
    
    // Update audit
    audit.finalPoints = finalPoints;
    audit.totalWeight = totalWeight;
    audit.confidence = confidence;
    this.auditLog.push(audit);
    
    // Create aggregated projection
    const aggregatedProjection: PlayerProjection = {
      id: this.createPlayerKey(playerInfo.name, playerInfo.position, playerInfo.team),
      name: playerInfo.name,
      team: playerInfo.team,
      position: playerInfo.position as any,
      projectedPoints: finalPoints,
      confidence: confidence,
      floorPoints: this.calculateFloor(projectionValues),
      ceilingPoints: this.calculateCeiling(projectionValues),
      standardDeviation: this.calculateStdDev(projectionValues)
    };
    
    return {
      projection: aggregatedProjection,
      sourcesUsed,
      totalWeight,
      confidence,
      warnings
    };
  }
  
  /**
   * Find player in a source using robust name matching
   */
  private findPlayerInSource(
    playerName: string,
    position: string,
    projections: PlayerProjection[]
  ): PlayerProjection | null {
    // First try exact match
    const exactMatch = projections.find(p => 
      playerNameMatcher.normalize(p.name) === playerNameMatcher.normalize(playerName) &&
      p.position === position
    );
    
    if (exactMatch) return exactMatch;
    
    // Try alias matching
    const matchResult = playerNameMatcher.matchPlayer(playerName);
    if (matchResult.matched) {
      const aliasMatch = projections.find(p => 
        playerNameMatcher.normalize(p.name) === playerNameMatcher.normalize(matchResult.matchedName) &&
        p.position === position
      );
      if (aliasMatch) return aliasMatch;
    }
    
    // Try fuzzy matching with high confidence
    const candidates = projections
      .filter(p => p.position === position)
      .map(p => p.name);
    
    const fuzzyResult = playerNameMatcher.matchPlayer(playerName, candidates);
    if (fuzzyResult.matched && fuzzyResult.confidence > 0.9) {
      return projections.find(p => 
        p.name === fuzzyResult.matchedName && p.position === position
      ) || null;
    }
    
    return null;
  }
  
  /**
   * Create unique key for player
   */
  private createPlayerKey(name: string, position: string, team: string): string {
    return `${playerNameMatcher.normalize(name)}_${position}_${team}`.toLowerCase();
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    sourcesUsed: number,
    totalWeight: number,
    projectionValues: Record<string, number>
  ): number {
    // Base confidence from source count
    const sourceConfidence = Math.min(1, sourcesUsed / 3);
    
    // Weight coverage confidence
    const weightConfidence = Math.min(1, totalWeight);
    
    // Consistency confidence (low variance = high confidence)
    const values = Object.values(projectionValues);
    if (values.length > 1) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
      const consistencyConfidence = Math.max(0, 1 - coefficientOfVariation);
      
      return (sourceConfidence * 0.3 + weightConfidence * 0.4 + consistencyConfidence * 0.3);
    }
    
    return sourceConfidence * 0.5 + weightConfidence * 0.5;
  }
  
  /**
   * Calculate floor projection (25th percentile)
   */
  private calculateFloor(projectionValues: Record<string, number>): number {
    const values = Object.values(projectionValues).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0] * 0.85;
    
    const index = Math.floor(values.length * 0.25);
    return values[index];
  }
  
  /**
   * Calculate ceiling projection (75th percentile)
   */
  private calculateCeiling(projectionValues: Record<string, number>): number {
    const values = Object.values(projectionValues).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0] * 1.15;
    
    const index = Math.ceil(values.length * 0.75) - 1;
    return values[index];
  }
  
  /**
   * Calculate standard deviation
   */
  private calculateStdDev(projectionValues: Record<string, number>): number {
    const values = Object.values(projectionValues);
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Log aggregation statistics
   */
  private logAggregationStats(totalPlayers: number): void {
    const sourceStats: Record<string, { found: number; missing: number }> = {};
    
    this.auditLog.forEach(audit => {
      audit.sources.forEach(source => {
        if (!sourceStats[source.name]) {
          sourceStats[source.name] = { found: 0, missing: 0 };
        }
        if (source.found) {
          sourceStats[source.name].found++;
        } else {
          sourceStats[source.name].missing++;
        }
      });
    });
    
    logger.info('Aggregation Statistics', {
      totalPlayers,
      totalAudits: this.auditLog.length,
      sourceStats,
      averageConfidence: this.auditLog.reduce((sum, a) => sum + a.confidence, 0) / this.auditLog.length
    });
  }
  
  /**
   * Get audit log for analysis
   */
  public getAuditLog(): AggregationAudit[] {
    return [...this.auditLog];
  }
  
  /**
   * Clear audit log
   */
  public clearAuditLog(): void {
    this.auditLog = [];
    this.sourceAvailability.clear();
  }
  
  /**
   * Get source availability report
   */
  public getSourceAvailabilityReport(): Record<string, {
    playersFound: number;
    percentage: number;
  }> {
    const totalPlayers = this.auditLog.length;
    const report: Record<string, any> = {};
    
    this.sourceAvailability.forEach((count, source) => {
      report[source] = {
        playersFound: count,
        percentage: totalPlayers > 0 ? (count / totalPlayers * 100).toFixed(2) + '%' : '0%'
      };
    });
    
    return report;
  }
}

export const unifiedProjectionAggregator = UnifiedProjectionAggregator.getInstance();