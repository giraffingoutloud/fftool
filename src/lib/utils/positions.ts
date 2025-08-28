import { Position, DepthChartEntry } from '@/types';

/**
 * Get position-specific variance for projection calculations.
 * Higher variance means more volatility in weekly performance.
 */
export function getPositionVariance(position: Position): number {
  switch (position) {
    case 'QB': 
      return 0.25;  // Quarterbacks are relatively consistent
    case 'RB': 
      return 0.35;  // Running backs have moderate variance
    case 'WR': 
      return 0.40;  // Wide receivers are more volatile
    case 'TE': 
      return 0.45;  // Tight ends are most volatile among skill positions
    case 'DST': 
      return 0.50;  // Defenses are highly matchup-dependent
    case 'K': 
      return 0.20;  // Kickers are most consistent
    default: 
      return 0.30;  // Default moderate variance
  }
}

/**
 * Determine a player's role based on depth chart order.
 */
export function getPlayerRole(
  depthOrder: number, 
  position: Position
): 'starter' | 'backup' | 'depth' {
  // Position-specific logic for determining starter status
  switch (position) {
    case 'QB':
    case 'K':
    case 'DST':
      // Only one starter for these positions
      return depthOrder === 1 ? 'starter' : depthOrder === 2 ? 'backup' : 'depth';
    
    case 'RB':
      // Top 2 RBs are typically starters in most systems
      return depthOrder <= 2 ? 'starter' : depthOrder === 3 ? 'backup' : 'depth';
    
    case 'WR':
      // Top 3 WRs are typically starters
      return depthOrder <= 3 ? 'starter' : depthOrder === 4 ? 'backup' : 'depth';
    
    case 'TE':
      // Usually only 1 starting TE
      return depthOrder === 1 ? 'starter' : depthOrder === 2 ? 'backup' : 'depth';
    
    default:
      return depthOrder === 1 ? 'starter' : depthOrder === 2 ? 'backup' : 'depth';
  }
}

/**
 * Check if a position is FLEX-eligible.
 */
export function isFlexEligible(position: Position): boolean {
  return ['RB', 'WR', 'TE'].includes(position);
}

/**
 * Get injury rate for a position (weekly probability).
 */
export function getInjuryRate(position: Position): number {
  const baseRates: Record<Position, number> = {
    'QB': 0.015,  // 1.5% per week
    'RB': 0.035,  // 3.5% per week (highest injury rate)
    'WR': 0.025,  // 2.5% per week
    'TE': 0.020,  // 2.0% per week
    'DST': 0.005, // 0.5% per week
    'K': 0.003    // 0.3% per week (lowest injury rate)
  };
  
  return baseRates[position] || 0.02;  // Default 2% if not found
}

/**
 * Calculate age-adjusted injury multiplier.
 */
export function getAgeInjuryMultiplier(age?: number): number {
  if (!age) return 1.0;
  
  // Injury risk increases 1.5% per year over age 26
  return 1 + Math.max(0, (age - 26) * 0.015);
}