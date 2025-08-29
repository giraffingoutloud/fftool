import { PlayerProjection } from '@/types';

interface ProjectionSource {
  name: string;
  weight: number;
  projections: PlayerProjection[];
}

interface AggregatedProjection {
  player: string;
  position: string;
  team: string;
  sources: Map<string, PlayerProjection>;
  weightedAverage: PlayerProjection;
}

/**
 * Aggregates projections from multiple sources using weighted averaging
 * Priority/Weight:
 * - FantasyPros: 0.4 (most comprehensive)
 * - CBS: 0.35 (detailed position-specific)
 * - projections_2025: 0.25 (good baseline)
 */
export class ProjectionAggregator {
  private readonly SOURCE_WEIGHTS = {
    'fantasypros': 0.40,
    'cbs': 0.35,
    'projections_2025': 0.25,
    'flx': 0.0  // FLX is just duplicates, use for validation only
  };

  /**
   * Aggregate projections from multiple sources
   */
  aggregateProjections(sources: ProjectionSource[]): PlayerProjection[] {
    // Group projections by player (normalized name + position)
    const playerMap = new Map<string, AggregatedProjection>();
    
    for (const source of sources) {
      for (const proj of source.projections) {
        const key = this.getPlayerKey(proj);
        
        if (!playerMap.has(key)) {
          playerMap.set(key, {
            player: proj.name,
            position: proj.position,
            team: proj.team || 'FA',
            sources: new Map(),
            weightedAverage: {} as PlayerProjection
          });
        }
        
        const aggregated = playerMap.get(key)!;
        aggregated.sources.set(source.name, proj);
      }
    }
    
    // Calculate weighted averages
    const results: PlayerProjection[] = [];
    
    for (const [key, aggregated] of playerMap) {
      const weightedProj = this.calculateWeightedAverage(aggregated);
      
      // Only include if we have reasonable confidence (at least 1 source)
      if (aggregated.sources.size > 0 && weightedProj.projectedPoints > 0) {
        results.push(weightedProj);
      }
    }
    
    // Sort by projected points descending
    results.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
    
    return results;
  }
  
  /**
   * Calculate weighted average of projections
   */
  private calculateWeightedAverage(aggregated: AggregatedProjection): PlayerProjection {
    let totalWeight = 0;
    let weightedPoints = 0;
    let weightedFloor = 0;
    let weightedCeiling = 0;
    
    // Aggregate numeric values
    const numericFields: {[key: string]: number} = {
      projectedPoints: 0,
      floorPoints: 0,
      ceilingPoints: 0,
      passingYards: 0,
      passingTDs: 0,
      rushingYards: 0,
      rushingTDs: 0,
      receivingYards: 0,
      receivingTDs: 0,
      receptions: 0,
      targets: 0,
      carries: 0
    };
    
    // Calculate weighted sums
    for (const [sourceName, proj] of aggregated.sources) {
      const weight = this.getSourceWeight(sourceName);
      totalWeight += weight;
      
      // Weight all numeric fields
      for (const field in numericFields) {
        const value = (proj as any)[field];
        if (value !== undefined && value !== null && !isNaN(value)) {
          numericFields[field] += value * weight;
        }
      }
    }
    
    // Calculate weighted averages
    if (totalWeight > 0) {
      for (const field in numericFields) {
        numericFields[field] = numericFields[field] / totalWeight;
      }
    }
    
    // Find the most complete/recent source for non-numeric fields
    const bestSource = this.getBestSource(aggregated.sources);
    
    // Build final projection
    const result: PlayerProjection = {
      id: `${this.normalizePlayerName(aggregated.player)}_${aggregated.position}_${aggregated.team}`,
      name: aggregated.player,
      position: aggregated.position,
      team: aggregated.team,
      projectedPoints: Math.round(numericFields.projectedPoints * 10) / 10, // Round to 1 decimal
      floorPoints: numericFields.floorPoints,
      ceilingPoints: numericFields.ceilingPoints,
      confidence: this.calculateConfidence(aggregated.sources),
      
      // Copy over other fields from best source
      byeWeek: bestSource?.byeWeek,
      age: bestSource?.age,
      injuryStatus: bestSource?.injuryStatus,
      isRookie: bestSource?.isRookie,
      games: bestSource?.games,
      teamSeasonSOS: (() => {
        const sos = bestSource?.teamSeasonSOS || 0;
        // Debug logging for key players
        if (basePlayerId.includes('mahomes') || basePlayerId.includes('jefferson') || basePlayerId.includes('mccaffrey')) {
          console.log(`Aggregator SOS: ${basePlayerId} -> SOS = ${sos} (from ${bestSource?.source || 'unknown'})`);
        }
        return sos;
      })(),  // Preserve SOS data
      
      // Include averaged stats
      passingYards: numericFields.passingYards > 0 ? Math.round(numericFields.passingYards) : undefined,
      passingTDs: numericFields.passingTDs > 0 ? Math.round(numericFields.passingTDs * 10) / 10 : undefined,
      rushingYards: numericFields.rushingYards > 0 ? Math.round(numericFields.rushingYards) : undefined,
      rushingTDs: numericFields.rushingTDs > 0 ? Math.round(numericFields.rushingTDs * 10) / 10 : undefined,
      receivingYards: numericFields.receivingYards > 0 ? Math.round(numericFields.receivingYards) : undefined,
      receivingTDs: numericFields.receivingTDs > 0 ? Math.round(numericFields.receivingTDs * 10) / 10 : undefined,
      receptions: numericFields.receptions > 0 ? Math.round(numericFields.receptions) : undefined
    };
    
    // Calculate floor and ceiling if not provided
    if (!result.floorPoints && result.projectedPoints > 0) {
      result.floorPoints = Math.round(result.projectedPoints * 0.75);
    }
    if (!result.ceilingPoints && result.projectedPoints > 0) {
      result.ceilingPoints = Math.round(result.projectedPoints * 1.25);
    }
    
    return result;
  }
  
  /**
   * Get weight for a source
   */
  private getSourceWeight(sourceName: string): number {
    const normalized = sourceName.toLowerCase();
    
    if (normalized.includes('fantasypros')) return this.SOURCE_WEIGHTS.fantasypros;
    if (normalized.includes('cbs')) return this.SOURCE_WEIGHTS.cbs;
    if (normalized.includes('projections_2025')) return this.SOURCE_WEIGHTS.projections_2025;
    if (normalized.includes('flx')) return this.SOURCE_WEIGHTS.flx;
    
    return 0.1; // Default low weight for unknown sources
  }
  
  /**
   * Calculate confidence based on number and agreement of sources
   */
  private calculateConfidence(sources: Map<string, PlayerProjection>): number {
    if (sources.size === 0) return 0;
    if (sources.size === 1) return 0.6;
    
    // Calculate standard deviation of projections
    const projections = Array.from(sources.values()).map(p => p.projectedPoints || 0);
    const mean = projections.reduce((a, b) => a + b, 0) / projections.length;
    const variance = projections.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / projections.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    
    // More sources = higher confidence
    const sourceFactor = Math.min(1, sources.size / 3);
    
    // Calculate final confidence
    let confidence = sourceFactor * 0.5; // Base from number of sources
    
    // Add confidence based on agreement
    if (coefficientOfVariation < 0.1) confidence += 0.4;  // Very high agreement
    else if (coefficientOfVariation < 0.2) confidence += 0.3;  // High agreement
    else if (coefficientOfVariation < 0.3) confidence += 0.2;  // Moderate agreement
    else if (coefficientOfVariation < 0.5) confidence += 0.1;  // Low agreement
    
    return Math.min(0.95, Math.max(0.3, confidence));
  }
  
  /**
   * Get the best/most complete source for non-numeric fields
   */
  private getBestSource(sources: Map<string, PlayerProjection>): PlayerProjection | undefined {
    let bestSource: PlayerProjection | undefined;
    let bestScore = -1;
    
    for (const [sourceName, proj] of sources) {
      let score = 0;
      
      // Prefer FantasyPros
      if (sourceName.includes('fantasypros')) score += 3;
      else if (sourceName.includes('cbs')) score += 2;
      else if (sourceName.includes('projections_2025')) score += 1;
      
      // Prefer sources with more complete data
      if (proj.byeWeek) score++;
      if (proj.team && proj.team !== 'FA') score++;
      if (proj.age) score++;
      if (proj.games) score++;
      if (proj.injuryStatus) score++;
      
      if (score > bestScore) {
        bestScore = score;
        bestSource = proj;
      }
    }
    
    return bestSource;
  }
  
  /**
   * Get normalized player key for matching
   */
  private getPlayerKey(proj: PlayerProjection): string {
    return `${this.normalizePlayerName(proj.name)}_${proj.position}`;
  }
  
  /**
   * Normalize player name for matching
   */
  private normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/jr$/g, '')
      .replace(/sr$/g, '')
      .replace(/ii$/g, '')
      .replace(/iii$/g, '')
      .replace(/iv$/g, '')
      .replace(/v$/g, '');
  }
  
  /**
   * Validate projections are realistic
   */
  validateProjections(projections: PlayerProjection[]): PlayerProjection[] {
    return projections.filter(proj => {
      // Check for realistic ranges by position
      const maxPoints = {
        'QB': 450,
        'RB': 400,
        'WR': 400,
        'TE': 300,
        'K': 200,
        'DST': 200,
        'DEF': 200
      }[proj.position] || 350;
      
      if (proj.projectedPoints <= 0 || proj.projectedPoints > maxPoints) {
        console.warn(`Invalid projection for ${proj.name}: ${proj.projectedPoints} points`);
        return false;
      }
      
      return true;
    });
  }
}