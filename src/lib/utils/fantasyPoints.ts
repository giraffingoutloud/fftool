import { PlayerSeasonStats, Position } from '@/types';

/**
 * Calculate fantasy points from raw statistics based on scoring type.
 * Supports PPR, Half-PPR, and Standard scoring systems.
 */
export function calculateFantasyPoints(
  stats: PlayerSeasonStats, 
  position: Position, 
  scoring: 'PPR' | 'HALF_PPR' | 'STANDARD' = 'PPR'
): number {
  const ppr = scoring === 'PPR' ? 1 : scoring === 'HALF_PPR' ? 0.5 : 0;
  let points = 0;
  
  // Passing stats (primarily for QBs)
  if (stats.passingYards) {
    points += stats.passingYards / 25;  // 1 point per 25 yards
  }
  if (stats.passingTDs) {
    points += stats.passingTDs * 4;  // 4 points per passing TD
  }
  if (stats.interceptions) {
    points -= stats.interceptions * 2;  // -2 points per INT
  }
  
  // Rushing stats
  if (stats.rushingYards) {
    points += stats.rushingYards / 10;  // 1 point per 10 yards
  }
  if (stats.rushingTDs) {
    points += stats.rushingTDs * 6;  // 6 points per rushing TD
  }
  
  // Receiving stats
  if (stats.receivingYards) {
    points += stats.receivingYards / 10;  // 1 point per 10 yards
  }
  if (stats.receivingTDs) {
    points += stats.receivingTDs * 6;  // 6 points per receiving TD
  }
  if (stats.receptions) {
    points += stats.receptions * ppr;  // PPR scoring
  }
  
  // Fumbles lost (if tracked)
  // Note: PlayerSeasonStats doesn't have fumblesLost in the type definition,
  // but we can add it if needed
  
  return Math.max(0, points);
}

/**
 * Calculate weekly average fantasy points.
 */
export function calculateWeeklyAverage(
  totalPoints: number, 
  gamesPlayed: number
): number {
  if (gamesPlayed <= 0) return 0;
  return totalPoints / gamesPlayed;
}