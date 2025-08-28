/**
 * Enhanced deduplication system for fantasy football data
 * Prioritizes accuracy over simplicity for optimal draft/roster decisions
 */

import { logger } from './utils/logger';

interface DuplicateResolutionStrategy {
  method: 'median' | 'average' | 'weighted_average' | 'most_recent' | 'highest' | 'lowest';
  weights?: Record<string, number>;
  confidenceThreshold?: number;
}

interface PlayerIdentity {
  name: string;
  normalizedName: string;
  position: string;
  team: string;
  alternateNames?: string[];
  previousTeams?: string[];
}

interface DeduplicationResult<T> {
  deduplicated: T[];
  conflicts: ConflictRecord[];
  statistics: DeduplicationStats;
}

interface ConflictRecord {
  playerKey: string;
  conflictType: 'adp' | 'auction' | 'projection' | 'team' | 'position';
  values: any[];
  resolution: any;
  confidence: number;
  requiresReview: boolean;
}

interface DeduplicationStats {
  totalRecords: number;
  uniquePlayers: number;
  duplicatesFound: number;
  conflictsResolved: number;
  flaggedForReview: number;
  dataQualityScore: number;
}

export class FantasyDeduplicator {
  private readonly SOURCE_WEIGHTS = {
    'FantasyPros': 0.40,  // Industry consensus
    'ESPN': 0.25,         // Large user base
    'CBS': 0.20,          // Established experts
    'Yahoo': 0.10,        // Good data
    'Other': 0.05         // Unknown sources
  };

  private readonly ADP_CONFIDENCE_THRESHOLD = 10; // Range for "same" ADP
  private readonly AUCTION_VARIANCE_THRESHOLD = 5; // $ variance threshold

  /**
   * Main deduplication method with fantasy-specific logic
   */
  deduplicateForFantasy<T extends Record<string, any>>(
    data: T[],
    getKey: (item: T) => string,
    getPlayerInfo: (item: T) => Partial<PlayerIdentity>,
    conflictResolution: Record<string, DuplicateResolutionStrategy>
  ): DeduplicationResult<T> {
    const playerMap = new Map<string, T[]>();
    const conflicts: ConflictRecord[] = [];
    
    // Group by primary key
    data.forEach(item => {
      const key = getKey(item);
      if (!playerMap.has(key)) {
        playerMap.set(key, []);
      }
      playerMap.get(key)!.push(item);
    });

    // Process duplicates
    const deduplicated: T[] = [];
    let duplicatesFound = 0;
    let conflictsResolved = 0;
    let flaggedForReview = 0;

    playerMap.forEach((items, key) => {
      if (items.length === 1) {
        deduplicated.push(items[0]);
      } else {
        duplicatesFound += items.length - 1;
        const resolved = this.resolveConflicts(
          items,
          key,
          conflictResolution,
          conflicts
        );
        
        if (resolved.requiresReview) {
          flaggedForReview++;
        }
        conflictsResolved++;
        deduplicated.push(resolved.item);
      }
    });

    // Calculate data quality score
    const dataQualityScore = this.calculateDataQuality(
      data.length,
      deduplicated.length,
      conflicts
    );

    return {
      deduplicated,
      conflicts,
      statistics: {
        totalRecords: data.length,
        uniquePlayers: deduplicated.length,
        duplicatesFound,
        conflictsResolved,
        flaggedForReview,
        dataQualityScore
      }
    };
  }

  /**
   * Resolve conflicts between duplicate entries
   */
  private resolveConflicts<T extends Record<string, any>>(
    items: T[],
    key: string,
    strategies: Record<string, DuplicateResolutionStrategy>,
    conflicts: ConflictRecord[]
  ): { item: T; requiresReview: boolean } {
    const base = { ...items[0] };
    let requiresReview = false;

    // Check each field for conflicts
    Object.keys(strategies).forEach(field => {
      const values = items.map(item => item[field]).filter(v => v !== undefined && v !== null);
      
      if (values.length > 1 && !this.allValuesSame(values)) {
        const strategy = strategies[field];
        const resolved = this.applyStrategy(values, strategy);
        
        const conflict: ConflictRecord = {
          playerKey: key,
          conflictType: this.getConflictType(field),
          values,
          resolution: resolved.value,
          confidence: resolved.confidence,
          requiresReview: resolved.confidence < 0.7
        };
        
        conflicts.push(conflict);
        base[field] = resolved.value;
        
        if (conflict.requiresReview) {
          requiresReview = true;
        }
      }
    });

    return { item: base, requiresReview };
  }

  /**
   * Apply resolution strategy to conflicting values
   */
  private applyStrategy(
    values: any[],
    strategy: DuplicateResolutionStrategy
  ): { value: any; confidence: number } {
    const numericValues = values.filter(v => !isNaN(Number(v))).map(Number);
    
    switch (strategy.method) {
      case 'median':
        return {
          value: this.median(numericValues),
          confidence: this.calculateConfidence(numericValues)
        };
      
      case 'average':
        return {
          value: this.average(numericValues),
          confidence: this.calculateConfidence(numericValues)
        };
      
      case 'weighted_average':
        return {
          value: this.weightedAverage(numericValues, strategy.weights),
          confidence: this.calculateConfidence(numericValues)
        };
      
      case 'highest':
        return {
          value: Math.max(...numericValues),
          confidence: 0.8
        };
      
      case 'lowest':
        return {
          value: Math.min(...numericValues),
          confidence: 0.8
        };
      
      case 'most_recent':
        // Assume last item is most recent
        return {
          value: values[values.length - 1],
          confidence: 0.9
        };
      
      default:
        return {
          value: values[0],
          confidence: 0.5
        };
    }
  }

  /**
   * Calculate median of numeric array
   */
  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate weighted average
   */
  private weightedAverage(
    values: number[],
    weights?: Record<string, number>
  ): number {
    if (values.length === 0) return 0;
    if (!weights) return this.average(values);
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    values.forEach((value, index) => {
      const weight = weights[index] || 1;
      weightedSum += value * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate confidence based on variance
   */
  private calculateConfidence(values: number[]): number {
    if (values.length <= 1) return 1;
    
    const avg = this.average(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avg !== 0 ? stdDev / Math.abs(avg) : 0;
    
    // Higher variation = lower confidence
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  /**
   * Check if all values are essentially the same
   */
  private allValuesSame(values: any[]): boolean {
    if (values.length <= 1) return true;
    
    // For numbers, check if within threshold
    if (values.every(v => !isNaN(Number(v)))) {
      const nums = values.map(Number);
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return (max - min) < 0.01; // Essentially same
    }
    
    // For strings, exact match
    return values.every(v => v === values[0]);
  }

  /**
   * Get conflict type from field name
   */
  private getConflictType(field: string): ConflictRecord['conflictType'] {
    if (field.toLowerCase().includes('adp')) return 'adp';
    if (field.toLowerCase().includes('auction') || field.toLowerCase().includes('value')) return 'auction';
    if (field.toLowerCase().includes('proj') || field.toLowerCase().includes('points')) return 'projection';
    if (field.toLowerCase().includes('team')) return 'team';
    if (field.toLowerCase().includes('position')) return 'position';
    return 'projection';
  }

  /**
   * Calculate overall data quality score
   */
  private calculateDataQuality(
    total: number,
    unique: number,
    conflicts: ConflictRecord[]
  ): number {
    const duplicateRatio = 1 - ((total - unique) / total);
    const highConfidenceRatio = conflicts.filter(c => c.confidence > 0.7).length / 
                                (conflicts.length || 1);
    const reviewRatio = 1 - (conflicts.filter(c => c.requiresReview).length / 
                            (conflicts.length || 1));
    
    return (duplicateRatio * 0.3 + highConfidenceRatio * 0.4 + reviewRatio * 0.3) * 100;
  }

  /**
   * Special handling for position eligibility
   */
  mergePositionEligibility(players: any[]): string[] {
    const positions = new Set<string>();
    players.forEach(p => {
      if (p.position) positions.add(p.position);
      if (p.eligiblePositions) {
        p.eligiblePositions.forEach((pos: string) => positions.add(pos));
      }
    });
    return Array.from(positions);
  }

  /**
   * Handle team changes (trades)
   */
  resolveTeamConflicts(
    players: any[],
    useSleeperAPI: boolean = false
  ): { team: string; confidence: number } {
    // If all same team, high confidence
    const teams = players.map(p => p.team).filter(t => t);
    if (new Set(teams).size === 1) {
      return { team: teams[0], confidence: 1.0 };
    }

    // If we have dates, use most recent
    const withDates = players.filter(p => p.lastUpdated || p.date);
    if (withDates.length > 0) {
      withDates.sort((a, b) => {
        const dateA = new Date(a.lastUpdated || a.date).getTime();
        const dateB = new Date(b.lastUpdated || b.date).getTime();
        return dateB - dateA;
      });
      return { team: withDates[0].team, confidence: 0.9 };
    }

    // Otherwise, use most common or flag for review
    const teamCounts = new Map<string, number>();
    teams.forEach(team => {
      teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
    });
    
    const sortedTeams = Array.from(teamCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    return {
      team: sortedTeams[0][0],
      confidence: sortedTeams[0][1] / teams.length
    };
  }
}

// Export a singleton instance
export const fantasyDeduplicator = new FantasyDeduplicator();

// Usage example
export function deduplicateADPData(adpData: any[]): any {
  return fantasyDeduplicator.deduplicateForFantasy(
    adpData,
    (item) => `${item.name}_${item.position}_${item.team}`,
    (item) => ({
      name: item.name,
      position: item.position,
      team: item.team
    }),
    {
      adp: { method: 'median' },
      auctionValue: { method: 'weighted_average' },
      projectedPoints: { method: 'weighted_average' }
    }
  );
}