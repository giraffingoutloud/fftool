import { Position } from '@/types';

/**
 * Generate a consistent player ID from name, team, and position.
 * Used for creating stable keys across different data sources.
 */
export function generatePlayerId(
  name: string, 
  team?: string, 
  position?: Position | string
): string {
  const normalize = (s?: string) => 
    (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return `${normalize(name)}_${normalize(team)}_${normalize(position)}`;
}

/**
 * Generate a simplified player key from name and position only.
 * Useful when team info might not be available or consistent.
 */
export function generatePlayerKey(name: string, position: Position | string): string {
  const normalize = (s: string) => 
    s.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return `${normalize(name)}_${normalize(position)}`;
}