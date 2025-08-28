import { 
  PlayerProjection, 
  PlayerSeasonStats, 
  PlayerAdvanced,
  TeamComposite,
  Position,
  DepthChartEntry
} from '@/types';
import { getPlayerRole } from './depthChartsLoader';
import { generatePlayerId } from './utils/playerId';
import { calculateFantasyPoints } from './utils/fantasyPoints';

interface SynthesisInput {
  stats: PlayerSeasonStats;
  advanced?: PlayerAdvanced;
  depthChart?: DepthChartEntry;
  teamComposite?: TeamComposite;
}

// Calculate confidence based on available data and consistency
function calculateConfidence(input: SynthesisInput): number {
  let confidence = 0.5; // Base confidence
  
  // More games played = more reliable data
  if (input.stats.games) {
    if (input.stats.games >= 15) confidence += 0.15;
    else if (input.stats.games >= 12) confidence += 0.10;
    else if (input.stats.games >= 8) confidence += 0.05;
  }
  
  // Having advanced stats increases confidence
  if (input.advanced) confidence += 0.10;
  
  // Depth chart position affects confidence
  if (input.depthChart) {
    const role = getPlayerRole(input.depthChart.depthOrder, input.stats.position);
    if (role === 'starter') confidence += 0.15;
    else if (role === 'backup') confidence += 0.05;
    else confidence -= 0.05;
  }
  
  // Team situation clarity
  if (input.teamComposite) {
    // Stable, good teams are more predictable
    if (input.teamComposite.offenseQualityIndex > 0.5) confidence += 0.05;
    if (Math.abs(input.teamComposite.trendIndex) < 0.05) confidence += 0.05; // Stable trend
  }
  
  return Math.min(0.95, Math.max(0.3, confidence));
}

// Calculate floor and ceiling based on historical variance
function calculateFloorCeiling(
  basePoints: number, 
  confidence: number,
  position: Position
): { floor: number; ceiling: number } {
  // Position-specific variance factors
  const varianceFactors: Record<Position, number> = {
    QB: 0.25,
    RB: 0.35,
    WR: 0.40,
    TE: 0.35,
    DST: 0.30,
    K: 0.20
  };
  
  const variance = varianceFactors[position] || 0.30;
  
  // Higher confidence = tighter range
  const adjustedVariance = variance * (2 - confidence);
  
  const floor = basePoints * (1 - adjustedVariance);
  const ceiling = basePoints * (1 + adjustedVariance * 0.7); // Ceiling is less extreme
  
  return {
    floor: Math.max(0, floor),
    ceiling
  };
}

// Apply team trend adjustment
function applyTeamTrendAdjustment(
  basePoints: number,
  teamComposite?: TeamComposite
): number {
  if (!teamComposite) return basePoints;
  
  // Very conservative trend adjustment (max ±5%)
  const trendMultiplier = 1 + Math.min(0.05, Math.max(-0.05, teamComposite.trendIndex));
  
  // Quality adjustment (max ±10% based on offense quality)
  const qualityMultiplier = 1 + (teamComposite.offenseQualityIndex * 0.1);
  
  return basePoints * trendMultiplier * qualityMultiplier;
}

// Main synthesis function
export function synthesizeProjection(input: SynthesisInput): PlayerProjection {
  const { stats, advanced, depthChart, teamComposite } = input;
  
  // Use FPTS as baseline (deterministic from canonical data)
  let projectedPoints = stats.fantasyPoints || 0;
  
  // If we only have per-game average, project for 17 games
  if (!projectedPoints && stats.fantasyPointsPerGame) {
    projectedPoints = stats.fantasyPointsPerGame * 17;
  }
  
  // Apply team trend adjustment (very conservative)
  projectedPoints = applyTeamTrendAdjustment(projectedPoints, teamComposite);
  
  // Calculate confidence
  const confidence = calculateConfidence(input);
  
  // Calculate floor and ceiling
  const { floor, ceiling } = calculateFloorCeiling(projectedPoints, confidence, stats.position);
  
  // Calculate standard deviation
  const standardDeviation = (ceiling - floor) / 4; // Roughly 95% within floor-ceiling
  
  // Generate weekly projections (simple equal distribution for now)
  const weeklyProjections: number[] = [];
  const avgWeekly = projectedPoints / 17;
  const weeklyStdDev = standardDeviation / Math.sqrt(17);
  
  for (let week = 1; week <= 17; week++) {
    // Add some variance but keep it deterministic based on week number
    const weekVariance = Math.sin(week * 0.5) * weeklyStdDev * 0.5;
    weeklyProjections.push(Math.max(0, avgWeekly + weekVariance));
  }
  
  // Determine bye week (could be enhanced with actual schedule data)
  const byeWeek = stats.position === 'DST' || stats.position === 'K' ? 
    undefined : 
    (5 + (stats.team?.charCodeAt(0) || 0) % 10); // Deterministic but spread out
  
  return {
    id: generatePlayerId(stats.name, stats.position, stats.team || 'FA'),
    name: stats.name,
    team: stats.team || 'FA',
    position: stats.position,
    projectedPoints,
    weeklyProjections,
    floorPoints: floor,
    ceilingPoints: ceiling,
    standardDeviation,
    byeWeek,
    confidence
  };
}

// Batch synthesis for all players
export async function synthesizeAllProjections(
  statsMap: Map<string, PlayerSeasonStats>,
  advancedMap: Map<string, PlayerAdvanced>,
  depthChartMap: Map<string, DepthChartEntry>,
  teamComposites: Map<string, TeamComposite>
): Promise<PlayerProjection[]> {
  const projections: PlayerProjection[] = [];
  
  // Process all players from stats
  for (const [key, stats] of statsMap.entries()) {
    const advanced = advancedMap.get(key);
    const depthChart = depthChartMap.get(key);
    const teamComposite = stats.team ? teamComposites.get(stats.team) : undefined;
    
    const projection = synthesizeProjection({
      stats,
      advanced,
      depthChart,
      teamComposite
    });
    
    projections.push(projection);
  }
  
  // Also check for players in depth charts not in stats (rookies, etc.)
  for (const [key, depthEntry] of depthChartMap.entries()) {
    if (!statsMap.has(key)) {
      // Create minimal projection for depth chart only players
      const [name, position] = key.split('_');
      const teamComposite = teamComposites.get(depthEntry.team);
      
      // Very conservative projection for players without stats
      const role = getPlayerRole(depthEntry.depthOrder, depthEntry.position);
      let baseProjection = 0;
      
      // Assign minimal projections based on role
      if (role === 'starter') {
        const positionBaselines: Record<Position, number> = {
          QB: 150,
          RB: 120,
          WR: 100,
          TE: 80,
          DST: 80,
          K: 100
        };
        baseProjection = positionBaselines[depthEntry.position] || 50;
      } else if (role === 'backup') {
        baseProjection = 30;
      } else {
        baseProjection = 10;
      }
      
      const projection: PlayerProjection = {
        id: generatePlayerId(depthEntry.name, depthEntry.position, depthEntry.team),
        name: depthEntry.name,
        team: depthEntry.team,
        position: depthEntry.position,
        projectedPoints: baseProjection,
        floorPoints: baseProjection * 0.5,
        ceilingPoints: baseProjection * 1.5,
        standardDeviation: baseProjection * 0.25,
        confidence: 0.3 // Low confidence for stats-less players
      };
      
      projections.push(projection);
    }
  }
  
  return projections;
}

// Extension to PlayerProjection for confidence tracking
declare module '@/types' {
  interface PlayerProjection {
    confidence?: number;
  }
}